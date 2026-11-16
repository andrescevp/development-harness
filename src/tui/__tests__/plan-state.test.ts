/**
 * plan-state.test.ts — selection rules and `PlanState` derivation (§4, §5, §11).
 */
import { describe, expect, it } from 'vitest';
import type { IndexRow, PlanCandidate } from '../plan-model.js';
import { selectPlan } from '../plan-select.js';
import { currentSubTask, derivePlanState, effectiveVerdict, issueFromError, loadingPlanState } from '../plan-state.js';
import { activityOf, candidate, detailsOf, fixture, scanOf, sourceFile } from './helpers.js';

const NOW = '2026-11-15T09:41:12.100Z';

function indexRow(overrides: Partial<IndexRow> = {}): IndexRow {
  return {
    slug: 'checkout-flow',
    title: 'Checkout Flow',
    status: 'In Progress',
    active: true,
    updatedAt: '2026-11-14',
    line: 10,
    ...overrides,
  };
}

function derive(
  candidates: PlanCandidate[],
  options: {
    details?: ReturnType<typeof detailsOf> | null;
    pinnedSlug?: string | null;
    index?: IndexRow[];
    scan?: Parameters<typeof scanOf>[1];
    root?: string | null;
  } = {}
) {
  return derivePlanState({
    root: options.root === undefined ? '/repo' : options.root,
    scan: scanOf(candidates, { index: options.index ?? [], ...options.scan }),
    details: options.details ?? detailsOf(fixture('active-plan.md')),
    pinnedSlug: options.pinnedSlug ?? null,
    sessionID: 'ses_fixture',
    activity: activityOf(),
    now: NOW,
    previousRevision: 4,
  });
}

describe('selectPlan', () => {
  it('selects a single active plan', () => {
    const selection = selectPlan([candidate()], [], null);
    expect(selection).toMatchObject({
      mode: 'single-active',
      source: 'frontmatter',
      selectedSlug: 'checkout-flow',
      suggestedSlug: null,
      pinnedSlug: null,
    });
  });

  it('surfaces multiple active plans with the newest as suggestion', () => {
    const older = candidate({ slug: 'older-plan', updatedAt: '2026-10-21', title: 'Older' });
    const selection = selectPlan([older, candidate()], [], null);
    expect(selection.mode).toBe('multiple');
    expect(selection.selectedSlug).toBeNull();
    expect(selection.suggestedSlug).toBe('checkout-flow');
    expect(selection.candidates.map((entry) => entry.slug)).toEqual(['checkout-flow', 'older-plan']);
  });

  it('prefers an explicit pin over frontmatter and index signals', () => {
    const older = candidate({ slug: 'older-plan', updatedAt: '2026-10-21' });
    const selection = selectPlan([candidate(), older], [indexRow()], 'older-plan');
    expect(selection).toMatchObject({
      mode: 'pinned',
      source: 'pin',
      selectedSlug: 'older-plan',
      pinnedSlug: 'older-plan',
    });
  });

  it('falls through a stale pin and clears it', () => {
    const selection = selectPlan([candidate()], [], 'gone-plan');
    expect(selection.mode).toBe('single-active');
    expect(selection.pinnedSlug).toBeNull();
  });

  it('falls back to a single index-active row', () => {
    const inactive = candidate({ active: false, status: 'Pending' });
    const selection = selectPlan([inactive], [indexRow()], null);
    expect(selection).toMatchObject({ mode: 'index', source: 'index', selectedSlug: 'checkout-flow' });
  });

  it('never auto-promotes an inactive or completed plan', () => {
    expect(selectPlan([candidate({ active: false })], [], null).mode).toBe('none');
    expect(selectPlan([candidate({ status: 'Completed', active: true })], [], null).mode).toBe('none');
    expect(selectPlan([candidate({ valid: false })], [], null).mode).toBe('none');
  });
});

describe('derivePlanState — ready states', () => {
  it('derives counts, progress, position, checklists and status precedence', () => {
    const state = derive([candidate()]);
    expect(state.status).toBe('ready');
    expect(state.reason).toBe('ready');
    expect(state.revision).toBe(5);
    expect(state.plan?.title).toBe('Checkout Flow');
    expect(state.plan?.status).toBe('In Progress');
    expect(state.plan?.updatedAt).toBe('2026-11-14');
    expect(state.plan?.updatedSource).toBe('frontmatter');
    expect(state.plan?.counts).toEqual({
      phases: { total: 2, completed: 1, inProgress: 1, pending: 0 },
      subTasks: { total: 4, completed: 3, inProgress: 1, pending: 0 },
    });
    expect(state.plan?.progress).toEqual({ ratio: 0.75, percent: 75 });
    expect(state.plan?.current).toMatchObject({
      label: 'Phase 2 · 2.2',
      position: '2.2',
      ordinal: { phase: 2, subTask: 2 },
      source: 'in-progress',
    });
    expect(state.plan?.current.subTask?.delegatedTo).toBe('dh-software-engineer');
    expect(state.plan?.phases[1]?.counts).toEqual({ total: 2, completed: 1, inProgress: 1, pending: 0 });
    expect(state.plan?.phases[0]?.line).toBeGreaterThan(0);
    expect(state.plan?.checklists.finalVerification.total).toBe(4);
    expect(state.plan?.checklists.plan.checked).toBe(1);
    expect(currentSubTask(state.plan!)).toMatchObject({ index: '2.2', delegatedTo: 'dh-software-engineer' });
  });

  it('tracks multiple active sub-tasks and exposes them for readers', () => {
    const source = fixture('active-plan.md').replace(
      '#### Sub-Task 2.1: Implement the checkout endpoint\n\n- **Status:** Completed',
      '#### Sub-Task 2.1: Implement the checkout endpoint\n\n- **Status:** In Progress'
    );
    const state = derive([candidate()], { details: detailsOf(source) });

    expect(state.status).toBe('ready');
    expect(state.plan?.activeSubTasks.map((entry) => entry.index).sort()).toEqual(['2.1', '2.2']);
    expect(state.plan?.current.label).toContain('+1');
    expect(state.plan?.current.position).toBe('2.1');
  });

  it('reports the next pending work as `next-pending`, never as active', () => {
    const pending = fixture('active-plan.md')
      .replace(
        '### Phase 2: Checkout Service\n\n- **Status:** In Progress',
        '### Phase 2: Checkout Service\n\n- **Status:** Pending'
      )
      .replace(
        '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** In Progress',
        '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** Pending'
      );
    const state = derive([candidate()], { details: detailsOf(pending) });
    expect(state.plan?.current).toMatchObject({ label: 'Phase 2 · 2.2', source: 'next-pending' });
  });

  it('accepts a started sub-task under a Pending phase and warns', () => {
    const mismatch = fixture('active-plan.md').replace(
      '### Phase 2: Checkout Service\n\n- **Status:** In Progress',
      '### Phase 2: Checkout Service\n\n- **Status:** Pending'
    );
    const state = derive([candidate()], { details: detailsOf(mismatch) });
    expect(state.plan?.current).toMatchObject({ position: '2.2', source: 'next-pending' });
    expect(state.plan?.warnings.map((issue) => issue.code)).toContain('phase-status-mismatch');
  });

  it('marks an all-completed plan as done with a full bar', () => {
    const done = fixture('active-plan.md')
      .replace(
        '### Phase 2: Checkout Service\n\n- **Status:** In Progress',
        '### Phase 2: Checkout Service\n\n- **Status:** Completed'
      )
      .replace(
        '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** In Progress',
        '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** Completed'
      );
    const state = derive([candidate()], { details: detailsOf(done) });
    expect(state.plan?.progress).toEqual({ ratio: 1, percent: 100 });
    expect(state.plan?.current).toMatchObject({ label: 'Completed', position: null, source: 'done', subTask: null });
  });

  it('uses the index reason when selection came from the index table', () => {
    const state = derive([candidate({ active: false, status: 'Pending' })], { index: [indexRow()] });
    expect(state.status).toBe('ready');
    expect(state.reason).toBe('index');
  });

  it('reports the pinned reason for an explicit pin', () => {
    const older = candidate({ slug: 'older-plan', updatedAt: '2026-10-21', path: 'docs/plans/older-plan/plan.md' });
    const olderDetails = detailsOf(fixture('active-plan.md'), {
      slug: 'older-plan',
      absPath: '/repo/docs/plans/older-plan/plan.md',
      plan: sourceFile('docs/plans/older-plan/plan.md', fixture('active-plan.md')),
    });
    const state = derive([candidate(), older], { pinnedSlug: 'older-plan', details: olderDetails });
    expect(state.status).toBe('ready');
    expect(state.reason).toBe('pinned');
    expect(state.plan?.slug).toBe('older-plan');
  });
});

describe('derivePlanState — selector, empty and error states', () => {
  it('exposes the loading snapshot before the first refresh (S1)', () => {
    const state = loadingPlanState(activityOf(), 'ses_fixture', NOW);
    expect(state).toMatchObject({
      status: 'loading',
      reason: 'loading',
      plan: null,
      revision: 0,
      sessionID: 'ses_fixture',
    });
    expect(state.selection.mode).toBe('none');
  });

  it('returns the selector for multiple active plans', () => {
    const older = candidate({ slug: 'older-plan', updatedAt: '2026-10-21', path: 'docs/plans/older-plan/plan.md' });
    const state = derive([candidate(), older]);
    expect(state.status).toBe('selector');
    expect(state.reason).toBe('multiple');
    expect(state.plan).toBeNull();
    expect(state.selection.suggestedSlug).toBe('checkout-flow');
  });

  it('returns the empty state when nothing is active', () => {
    const state = derive([candidate({ active: false })]);
    expect(state.status).toBe('empty');
    expect(state.reason).toBe('empty');
    expect(state.plan).toBeNull();
  });

  it('returns no-workspace and no-plans-dir empty states', () => {
    const noWorkspace = derive([], { root: null });
    expect(noWorkspace.reason).toBe('no-workspace');
    expect(noWorkspace.warnings.map((issue) => issue.code)).toContain('no-workspace');

    const noPlansDir = derive([], { scan: { hasPlansDir: false } });
    expect(noPlansDir.status).toBe('empty');
    expect(noPlansDir.reason).toBe('no-plans-dir');
  });

  it('returns the scan error state when the plans directory is unreadable', () => {
    const state = derive([], {
      scan: {
        hasPlansDir: false,
        errors: [{ code: 'plans-dir-unreadable', severity: 'error', file: 'docs/plans', message: 'denied' }],
      },
    });
    expect(state.status).toBe('error');
    expect(state.reason).toBe('scan-error');
  });

  it('warns when a pin is stale and keeps the regular selection', () => {
    const state = derive([candidate()], { pinnedSlug: 'gone-plan' });
    expect(state.status).toBe('ready');
    expect(state.warnings.map((issue) => issue.code)).toContain('pin-stale');
  });

  it('turns an invalid pinned candidate into a plan-error state', () => {
    const invalid = candidate({
      valid: false,
      issue: {
        code: 'not-a-phased-plan',
        severity: 'error',
        file: 'docs/plans/checkout-flow/plan.md',
        message: 'missing',
      },
    });
    const state = derive([invalid], { details: null, pinnedSlug: 'checkout-flow' });
    expect(state.status).toBe('error');
    expect(state.reason).toBe('plan-error');
    expect(state.errors[0]?.code).toBe('not-a-phased-plan');
  });

  it('maps parser throws to typed issues instead of throwing', () => {
    const malformed = derive([candidate()], { details: detailsOf(fixture('malformed-plan.md')) });
    expect(malformed.status).toBe('error');
    expect(malformed.errors[0]?.code).toBe('invalid-status');

    const legacy = derive([candidate({ path: 'docs/plans/legacy-plan/plan.md' })], {
      details: detailsOf(fixture('legacy-plan.md')),
    });
    expect(legacy.status).toBe('error');
    expect(legacy.errors[0]?.code).toBe('not-a-phased-plan');

    const stripped = issueFromError(
      new Error('/repo/docs/plans/x/plan.md: orphan sub-task 2.1'),
      'docs/plans/x/plan.md',
      '/repo'
    );
    expect(stripped).toMatchObject({ code: 'orphan-subtask', message: 'docs/plans/x/plan.md: orphan sub-task 2.1' });
  });
});

describe('effectiveVerdict', () => {
  it('prefers the review verdict and falls back to the plan-end alignment verdict', () => {
    const review = sourceFile(
      'docs/plans/checkout-flow/tasks/review.md',
      '# Final Plan Review\n\n**Verdict:** Approve\n'
    );
    const alignment = sourceFile(
      'docs/plans/checkout-flow/tasks/review-fast-final.md',
      '# Plan Alignment Review\n\n**Verdict:** Request changes\n'
    );
    const withReview = derive([candidate()], { details: detailsOf(fixture('active-plan.md'), { review }) });
    expect(effectiveVerdict(withReview.plan!)).toBe('Approve');

    const onlyAlignment = derive([candidate()], {
      details: detailsOf(fixture('active-plan.md'), {
        alignment: { preExecution: null, planEnd: alignment },
      }),
    });
    expect(effectiveVerdict(onlyAlignment.plan!)).toBe('Request changes');
  });
});

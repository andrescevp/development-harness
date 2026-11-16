/**
 * sidebar-model.test.ts — card copy, states, widths and truncation for the
 * `sidebar.content` view model (§11 card column, §5.4).
 */
import { describe, expect, it } from 'vitest';
import { planCardLines, sidebarCard, sidebarWidth } from '../components/sidebar-model.js';
import { derivePlanState, loadingPlanState } from '../plan-state.js';
import { activityOf, candidate, detailsOf, fixture, noWorkspaceState, scanOf, sourceFile, stateOf } from './helpers.js';

const NOW = '2026-11-15T09:41:12.100Z';

describe('sidebarWidth', () => {
  it('derives a bounded compact column from the terminal width', () => {
    expect(sidebarWidth(80)).toBe(27);
    expect(sidebarWidth(120)).toBe(38);
    expect(sidebarWidth(40)).toBe(20);
    expect(sidebarWidth(Number.NaN)).toBe(32);
  });
});

describe('planCardLines — multi-plan sections', () => {
  it('renders a compact per-plan block with active-task count', () => {
    const contents = fixture('active-plan.md').replace(
      '#### Sub-Task 2.1: Implement the checkout endpoint\n\n- **Status:** Completed',
      '#### Sub-Task 2.1: Implement the checkout endpoint\n\n- **Status:** In Progress'
    );
    const plan = stateOf([candidate()], { details: detailsOf(contents) }).plan!;
    const lines = planCardLines(plan, 38);
    expect(lines.join('\n')).toContain('Phase');
    expect(lines.join('\n')).toContain('Active: 2 tasks');
    expect(lines.join('\n')).toContain('+1');
    expect(lines.join('\n')).toContain('Agent:');
  });
});

describe('sidebarCard — loading and empty states', () => {
  it('renders one muted loading line before the first refresh (S1)', () => {
    const card = sidebarCard({ state: loadingPlanState(activityOf(), null, NOW) });
    expect(card).toEqual({ heading: 'Plan progress', lines: ['Plans: loading…'] });
  });

  it('renders the no-active-plan hint with the docs/plans pointer (S5)', () => {
    const card = sidebarCard({ state: stateOf([candidate({ active: false })]) });
    expect(card.heading).toBe('Plan progress');
    expect(card.lines).toEqual(['No active plan', 'docs/plans']);
  });

  it('names the missing docs/plans directory and the workspace-root rule (S6)', () => {
    const card = sidebarCard({ state: stateOf([], { scan: { hasPlansDir: false } }), width: 38 });
    expect(card.lines).toEqual(['No docs/plans here', 'start opencode at the workspace root']);
  });

  it('reports a missing workspace without shouting (S6b)', () => {
    expect(sidebarCard({ state: noWorkspaceState(NOW) }).lines).toEqual(['No local workspace']);
  });
});

describe('sidebarCard — selector state', () => {
  it('lists the active plan count, the suggestion and the panel hint (S3)', () => {
    const older = candidate({ slug: 'older-plan', title: 'Older Plan', updatedAt: '2026-10-21' });
    const card = sidebarCard({ state: stateOf([candidate(), older]) });
    expect(card).toEqual({
      heading: 'Plan progress',
      lines: ['2 active plans', 'Suggested: Checkout Flow', 'open /plan-progress'],
    });
  });
});

describe('sidebarCard — ready state', () => {
  it('shows title, path, position, status, bar, counts, agent and activity (S2)', () => {
    const card = sidebarCard({ state: stateOf([candidate()]), width: 38 });
    expect(card.heading).toBe('Checkout Flow');
    expect(card.lines).toEqual([
      'docs/plans/checkout-flow',
      'Phase 2/2 · Sub-Task 2.2/2',
      '▸ In Progress',
      '[████████░░] 3/4 sub-tasks',
      'Agent: dh-software-engineer',
      '▶ Running edit',
    ]);
  });

  it('uses a 4-cell bar and drops the path in a narrow card', () => {
    const card = sidebarCard({ state: stateOf([candidate()]), width: 22 });
    expect(card.lines).toEqual([
      'Phase 2/2 · 2.2/2',
      '▸ In Progress',
      '[███░] 3/4',
      'Agent: dh-software-en…',
      '▶ Running edit',
    ]);
  });

  it('labels unstarted work as Next, never as active', () => {
    const pending = fixture('active-plan.md')
      .replace(
        '### Phase 2: Checkout Service\n\n- **Status:** In Progress',
        '### Phase 2: Checkout Service\n\n- **Status:** Pending'
      )
      .replace(
        '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** In Progress',
        '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** Pending'
      );
    const state = derivePlanState({
      root: '/repo',
      scan: scanOf([candidate({ status: 'Pending' })]),
      details: detailsOf(pending),
      pinnedSlug: null,
      sessionID: 'ses_fixture',
      activity: activityOf(),
      now: NOW,
      previousRevision: 1,
    });
    expect(sidebarCard({ state, width: 38 }).lines[2]).toBe('Next · Pending');
  });

  it('marks a completed plan and renders a full bar', () => {
    const done = fixture('active-plan.md')
      .replace(
        '### Phase 2: Checkout Service\n\n- **Status:** In Progress',
        '### Phase 2: Checkout Service\n\n- **Status:** Completed'
      )
      .replace(
        '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** In Progress',
        '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** Completed'
      );
    const state = derivePlanState({
      root: '/repo',
      scan: scanOf([candidate({ status: 'In Progress' })]),
      details: detailsOf(done),
      pinnedSlug: null,
      sessionID: 'ses_fixture',
      activity: activityOf(),
      now: NOW,
      previousRevision: 1,
    });
    const card = sidebarCard({ state, width: 38 });
    expect(card.lines[1]).toBe('Completed');
    expect(card.lines[2]).toBe('✔ Completed');
    expect(card.lines[3]).toBe('[██████████] 4/4 sub-tasks');
  });

  it('appends the index provenance hint (S4)', () => {
    const state = stateOf([candidate({ active: false })], {
      scan: {
        index: [
          {
            slug: 'checkout-flow',
            title: 'Checkout Flow',
            status: 'In Progress',
            active: true,
            updatedAt: null,
            line: 9,
          },
        ],
      },
    });
    expect(state.reason).toBe('index');
    expect(sidebarCard({ state, width: 38 }).lines[2]).toBe('▸ In Progress · index');
  });

  it('appends the pinned hint and supports an ASCII bar', () => {
    const older = candidate({ slug: 'older-plan', title: 'Older Plan', updatedAt: '2026-10-21' });
    const state = derivePlanState({
      root: '/repo',
      scan: scanOf([candidate(), older]),
      details: detailsOf(fixture('active-plan.md'), {
        slug: 'older-plan',
        absPath: '/repo/docs/plans/older-plan/plan.md',
        plan: sourceFile('docs/plans/older-plan/plan.md', fixture('active-plan.md')),
      }),
      pinnedSlug: 'older-plan',
      sessionID: 'ses_fixture',
      activity: activityOf(),
      now: NOW,
      previousRevision: 1,
    });
    const card = sidebarCard({ state, width: 38, ascii: true });
    expect(card.lines[2]).toBe('▸ In Progress · pinned');
    expect(card.lines[3]).toBe('[########--] 3/4 sub-tasks');
  });

  it('marks a stale activity line', () => {
    const state = derivePlanState({
      root: '/repo',
      scan: scanOf([candidate()]),
      details: detailsOf(fixture('active-plan.md')),
      pinnedSlug: null,
      sessionID: 'ses_fixture',
      activity: activityOf({ status: 'running', summary: 'Running edit', stale: true }),
      now: NOW,
      previousRevision: 1,
    });
    expect(sidebarCard({ state, width: 38 }).lines[5]).toBe('▶ Running edit (stale)');
  });

  it('truncates a long title to the card width', () => {
    const longPlan = fixture('active-plan.md').replace(
      'title: Checkout Flow',
      'title: Checkout Flow With A Very Long Descriptive Title'
    );
    const state = derivePlanState({
      root: '/repo',
      scan: scanOf([candidate()]),
      details: detailsOf(longPlan),
      pinnedSlug: null,
      sessionID: 'ses_fixture',
      activity: activityOf(),
      now: NOW,
      previousRevision: 1,
    });
    expect(sidebarCard({ state, width: 20 }).heading).toBe('Checkout Flow With…');
  });

  it('shows an unassigned marker when no delegated agent is active', () => {
    const done = fixture('active-plan.md')
      .replace(
        '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** In Progress',
        '#### Sub-Task 2.2: Wire payment retries\n\n- **Status:** Completed'
      )
      .replace(
        '### Phase 2: Checkout Service\n\n- **Status:** In Progress',
        '### Phase 2: Checkout Service\n\n- **Status:** Completed'
      );
    const state = derivePlanState({
      root: '/repo',
      scan: scanOf([candidate()]),
      details: detailsOf(done),
      pinnedSlug: null,
      sessionID: 'ses_fixture',
      activity: activityOf({ summary: 'Completed' }),
      now: NOW,
      previousRevision: 1,
    });
    const card = sidebarCard({ state, width: 38 });
    expect(card.lines[4]).toBe('Agent: —');
    expect(card.lines[5]).toBe('◦ Completed');
  });
});

describe('sidebarCard — error states', () => {
  it('names the unreadable plan and the issue code (S7)', () => {
    const invalid = candidate({
      valid: false,
      issue: {
        code: 'not-a-phased-plan',
        severity: 'error',
        file: 'docs/plans/checkout-flow/plan.md',
        message: 'missing',
      },
    });
    const state = derivePlanState({
      root: '/repo',
      scan: scanOf([invalid]),
      details: null,
      pinnedSlug: 'checkout-flow',
      sessionID: null,
      activity: activityOf(),
      now: NOW,
      previousRevision: 1,
    });
    expect(state.status).toBe('error');
    expect(sidebarCard({ state, width: 38 })).toEqual({
      heading: 'Plan progress',
      lines: ['⚠ Plan unreadable: checkout-flow', 'not-a-phased-plan'],
    });
  });

  it('reports an unavailable plans directory (S8)', () => {
    const state = derivePlanState({
      root: '/repo',
      scan: scanOf([], {
        hasPlansDir: false,
        errors: [{ code: 'plans-dir-unreadable', severity: 'error', file: 'docs/plans', message: 'denied' }],
      }),
      details: null,
      pinnedSlug: null,
      sessionID: null,
      activity: activityOf(),
      now: NOW,
      previousRevision: 1,
    });
    expect(sidebarCard({ state })).toEqual({
      heading: 'Plan progress',
      lines: ['⚠ Plans unavailable', 'plans-dir-unreadable'],
    });
  });
});

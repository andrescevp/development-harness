/**
 * panel-model.test.ts — panel header/body/footer copy, states, review/ledger
 * sections and windowed scrolling for the `session.panel` view model
 * (progress-contract §6, §7, §11, §16).
 */
import { describe, expect, it } from 'vitest';
import { PANEL_FOOTER, panelModel } from '../components/panel-model.js';
import type { PlanState } from '../plan-render-model.js';
import { loadingPlanState } from '../plan-state.js';
import { activityOf, candidate, detailsOf, fixture, noWorkspaceState, sourceFile, stateOf } from './helpers.js';

const NOW = '2026-11-15T09:41:12.100Z';
const DISPLAY = '/repo/docs/plans';

function withReviewAndLedger(): PlanState {
  return stateOf([candidate()], {
    details: detailsOf(fixture('active-plan.md'), {
      review: sourceFile('docs/plans/checkout-flow/tasks/review.md', fixture('review.md')),
      ledger: sourceFile('docs/plans/checkout-flow/plan_fast_skip_checks.md', fixture('ledger.md')),
    }),
  });
}

describe('panelModel — loading state', () => {
  it('shows a single loading header and the base keyboard legend (S1)', () => {
    const model = panelModel({
      state: loadingPlanState(activityOf(), 'ses_fixture', NOW),
      width: 80,
      height: 30,
    });
    expect(model.heading).toBe('Plan progress');
    expect(model.header).toEqual(['Loading plan progress…']);
    expect(model.body).toEqual([]);
    expect(model.footer).toBe(PANEL_FOOTER);
    expect(model.scrollable).toBe(false);
  });
});

describe('panelModel — ready state', () => {
  it('renders the plan header, phases, sub-tasks, criteria and checklists (S2)', () => {
    const model = panelModel({ state: stateOf([candidate()]), width: 100, height: 200 });
    expect(model.heading).toBe('Checkout Flow');
    expect(model.header).toEqual([
      'docs/plans/checkout-flow/plan.md · In Progress · 75%',
      '[████████░░] 3/4 sub-tasks · 1/2 phases',
      'Updated 2026-11-14 · frontmatter',
    ]);
    const body = model.body.join('\n');
    expect(body).toContain('✔ Phase 1: Domain and Contracts · Completed (2/2)');
    expect(body).toContain('  ✔ 1.1 Define the order contract · Completed · dh-software-architect');
    expect(body).toContain('    [ ] (done-when) The contract is recorded and referenced by the plan.');
    expect(body).toContain('  ▸ 2.2 Wire payment retries · In Progress · dh-software-engineer');
    expect(body).toContain('Plan checklists — 1/4 checked');
    expect(body).toContain('  [x] Fixture checklists render.');
    expect(body).toContain('Final verification — 1/4 checked');
    expect(body).toContain('Review — no review file');
    expect(body).toContain('Fast mirror — none');
    expect(body).toContain('Updated 2026-11-14 (frontmatter)');
    expect(model.selectable).toBe(false);
  });

  it('renders the review verdict, risk and deferred ledger checks (§7)', () => {
    const model = panelModel({ state: withReviewAndLedger(), width: 120, height: 400 });
    const body = model.body.join('\n');
    expect(body).toContain('Review — Approve with comments · review (final) · risk Low');
    expect(body).toContain('  Approve with comments — no P0/P1 blockers');
    expect(body).toContain('  reviewed against: Sub-task 2.1 from plan.md');
    expect(body).toContain('Ledger — 5 rows · 2 deferred');
    expect(body).toContain('  deferred: dh-domain-check, dh-simplify');
  });

  it('does not present deferred checks as a failure', () => {
    const model = panelModel({ state: withReviewAndLedger(), width: 120, height: 400 });
    expect(model.body.join('\n')).not.toContain('FAIL');
  });

  it('windows the body and clamps the cursor (§16)', () => {
    const state = stateOf([candidate()]);
    const full = panelModel({ state, width: 100, height: 400 });
    const top = panelModel({ state, width: 100, height: 12 });
    expect(top.scrollable).toBe(true);
    expect(top.offset).toBe(0);
    expect(top.body).toHaveLength(7);
    expect(top.maxCursor).toBe(top.total - 7);
    expect(top.footer).toBe(`${PANEL_FOOTER} · [↑↓] scroll`);

    const bottom = panelModel({ state, width: 100, height: 12, cursor: 999 });
    expect(bottom.offset).toBe(bottom.maxCursor);
    expect(bottom.body.at(-1)).toBe(full.body.at(-1));
    expect(full.scrollable).toBe(false);
    expect(full.footer).toBe(PANEL_FOOTER);
  });

  it('truncates every header line to the panel width', () => {
    const model = panelModel({ state: stateOf([candidate()]), width: 24, height: 40 });
    for (const line of [...model.header, ...model.body]) expect(line.length).toBeLessThanOrEqual(24);
  });
});

describe('panelModel — selector state', () => {
  it('numbers candidates, marks the suggestion and advertises pin keys (S3)', () => {
    const older = candidate({ slug: 'older-plan', title: 'Older Plan', updatedAt: '2026-10-21' });
    const model = panelModel({ state: stateOf([candidate(), older]), width: 80, height: 40 });
    expect(model.header).toEqual(['2 active plans — choose one']);
    expect(model.selectable).toBe(true);
    expect(model.body).toEqual([
      '1. checkout-flow · In Progress · 2026-11-14 (suggested)',
      '2. older-plan · In Progress · 2026-10-21',
      'Press 1-9 to pin a plan; the sidebar follows the selection.',
    ]);
    expect(model.footer).toBe(`${PANEL_FOOTER} · [1-9] pin`);
  });

  it('surfaces an invalid candidate as selectable-but-broken', () => {
    const older = candidate({ slug: 'older-plan', title: 'Older Plan', updatedAt: '2026-10-21' });
    const broken = candidate({
      slug: 'broken-plan',
      updatedAt: '2026-10-20',
      valid: false,
      issue: {
        code: 'not-a-phased-plan',
        severity: 'error',
        file: 'docs/plans/broken-plan/plan.md',
        message: 'missing',
      },
    });
    const model = panelModel({ state: stateOf([candidate(), older, broken]), width: 100, height: 40 });
    expect(model.header).toEqual(['3 active plans — choose one']);
    expect(model.body[2]).toContain('broken-plan · In Progress · 2026-10-20 · invalid: not-a-phased-plan');
  });
});

describe('panelModel — empty states', () => {
  it('explains how a plan becomes active (S5)', () => {
    const model = panelModel({
      state: stateOf([candidate({ active: false })]),
      width: 120,
      height: 40,
      displayPath: DISPLAY,
    });
    expect(model.header).toEqual(['No active plan']);
    expect(model.body[0]).toContain(`A plan in ${DISPLAY} must declare \`active: true\``);
  });

  it('names the resolved directory when docs/plans is missing (S6)', () => {
    const model = panelModel({
      state: stateOf([], { scan: { hasPlansDir: false } }),
      width: 120,
      height: 40,
      displayPath: DISPLAY,
    });
    expect(model.header).toEqual([`No docs/plans at ${DISPLAY}`]);
    expect(model.body[0]).toBe('Start opencode at the workspace root so plan files resolve.');
  });

  it('reports a missing workspace (S6b)', () => {
    const model = panelModel({ state: noWorkspaceState(NOW), width: 80, height: 30 });
    expect(model.header).toEqual(['No local workspace']);
    expect(model.body).toEqual(['Remote workspaces are not supported in v1.']);
  });
});

describe('panelModel — error states', () => {
  it('lists the selected plan issue and other selectable candidates (S7)', () => {
    const invalid = candidate({
      slug: 'checkout-flow',
      valid: false,
      issue: {
        code: 'not-a-phased-plan',
        severity: 'error',
        file: 'docs/plans/checkout-flow/plan.md',
        message: 'missing ## Phases',
      },
    });
    const model = panelModel({
      state: stateOf([invalid], { pinnedSlug: 'checkout-flow', details: undefined }),
      width: 120,
      height: 40,
    });
    expect(model.header).toEqual(['⚠ Plan unreadable: checkout-flow']);
    expect(model.body[0]).toContain('✖ not-a-phased-plan docs/plans/checkout-flow/plan.md');
  });

  it('reports an unreadable plans directory (S8)', () => {
    const model = panelModel({
      state: stateOf([], {
        scan: {
          hasPlansDir: false,
          errors: [{ code: 'plans-dir-unreadable', severity: 'error', file: 'docs/plans', message: 'denied' }],
        },
      }),
      width: 120,
      height: 40,
    });
    expect(model.header).toEqual(['⚠ Plans unavailable']);
    expect(model.body[0]).toContain('✖ plans-dir-unreadable');
  });
});

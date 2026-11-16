/**
 * plan-state-verdict.test.ts — effective review verdict fallback chain.
 *
 * Split from plan-state.test.ts to keep both files under the code-file limit.
 */
import { describe, expect, it } from 'vitest';
import type { PlanDetails } from '../plan-model.js';
import { derivePlanState, effectiveVerdict } from '../plan-state.js';
import { activityOf, candidate, detailsOf, fixture, scanOf, sourceFile } from './helpers.js';

const NOW = '2026-11-15T09:41:12.100Z';

function state(details: PlanDetails) {
  return derivePlanState({
    root: '/repo',
    scan: scanOf([candidate()]),
    details,
    pinnedSlug: null,
    sessionID: 'ses_fixture',
    activity: activityOf(),
    now: NOW,
    previousRevision: 4,
  });
}

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
    expect(effectiveVerdict(state(detailsOf(fixture('active-plan.md'), { review })).plan!)).toBe('Approve');

    const onlyAlignment = state(
      detailsOf(fixture('active-plan.md'), { alignment: { preExecution: null, planEnd: alignment } })
    );
    expect(effectiveVerdict(onlyAlignment.plan!)).toBe('Request changes');
  });
});

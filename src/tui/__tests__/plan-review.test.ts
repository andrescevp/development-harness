/**
 * plan-review.test.ts — review verdict, ledger and fast-mirror derivation (§7).
 */
import { describe, expect, it } from 'vitest';
import { computeSourceSha256 } from '../../tools/plan-fast-template.js';
import { parsePlan } from '../../tools/plan-lifecycle.js';
import type { PlanDetails } from '../plan-model.js';
import { deriveFastState, normalizeVerdict, parseAlignment, parseLedger, parseReview } from '../plan-review.js';
import { detailsOf, fixture, sourceFile } from './helpers.js';

const FAST_PATH = 'docs/plans/checkout-flow/plan_fast.md';
const LEDGER_PATH = 'docs/plans/checkout-flow/plan_fast_skip_checks.md';

function mirrorOf(source: string, mutate: (phases: string) => string = (phases) => phases): string {
  const start = source.indexOf('## Phases');
  const end = source.indexOf('## Final Integration & Verification');
  const phases = mutate(source.slice(start, end));
  const sha = computeSourceSha256(source);
  return `---
title: "Checkout Flow — Fast Execution"
slug: checkout-flow
source_plan: plan.md
source_sha256: ${sha}
status: In Progress
active: true
created: 2026-11-10
updated: 2026-11-14
---

# Plan: Checkout Flow (Fast Execution)

${phases}`;
}

function fastDetails(source: string, fastContents: string, overrides: Partial<PlanDetails> = {}): PlanDetails {
  return detailsOf(source, {
    fast: sourceFile(FAST_PATH, fastContents),
    ledger: sourceFile(LEDGER_PATH, fixture('ledger.md')),
    ...overrides,
  });
}

describe('parseReview', () => {
  it('takes the last tolerant verdict and reports scope/risk/raw text', () => {
    const review = parseReview(sourceFile('docs/plans/checkout-flow/tasks/review.md', fixture('review.md')));
    expect(review).toMatchObject({
      present: true,
      verdict: 'Approve with comments',
      verdictRaw: 'Approve with comments — no P0/P1 blockers',
      scope: 'final',
      reviewedAgainst: 'Sub-task 2.1 from plan.md',
      risk: 'Low',
    });
    expect(review.issues).toEqual([]);
  });

  it.each([
    ['**Verdict:** Approve\n', 'Approve'],
    ['**Verdict: Approve with comments**\n', 'Approve with comments'],
    ['**Verdict**: Request changes.\n', 'Request changes'],
    ['- **Verdict:** approve\n', 'Approve'],
  ])('normalizes the verdict spelling %j', (contents, expected) => {
    expect(parseReview(sourceFile('docs/plans/x/tasks/review.md', contents)).verdict).toBe(expected);
  });

  it('keeps unknown verdicts raw and warns instead of guessing', () => {
    const review = parseReview(sourceFile('docs/plans/x/tasks/review.md', '**Verdict:** looks fine to me\n'));
    expect(review.verdict).toBeNull();
    expect(review.verdictRaw).toBe('looks fine to me');
    expect(review.issues.map((issue) => issue.code)).toEqual(['review-malformed']);
  });

  it('classifies final, sub-task and mixed scopes', () => {
    const final = parseReview(
      sourceFile('docs/plans/x/tasks/review.md', '# Final Plan Review\n\n**Verdict:** Approve\n\n## Sign-off Verdict\n')
    );
    expect(final.scope).toBe('final');
    const subtask = parseReview(
      sourceFile('docs/plans/x/tasks/review.md', '# Sub-Task Review\n\n**Verdict:** Approve\n')
    );
    expect(subtask.scope).toBe('subtask');
    const mixed = parseReview(
      sourceFile('docs/plans/x/tasks/review.md', '**Verdict:** Approve\n\n**Verdict:** Request changes\n')
    );
    expect(mixed.scope).toBe('mixed');
    expect(parseReview(null)).toMatchObject({ present: false, verdict: null, path: null });
  });

  it('normalizes verdict prefixes longest-first', () => {
    expect(normalizeVerdict('approve with comments — later')).toBe('Approve with comments');
    expect(normalizeVerdict('Approved')).toBe('Approve');
    expect(normalizeVerdict('nope')).toBeNull();
  });
});

describe('parseLedger', () => {
  it('counts dispositions, lists unresolved checks and keeps every row count', () => {
    const ledger = parseLedger(sourceFile(LEDGER_PATH, fixture('ledger.md')));
    expect(ledger.present).toBe(true);
    expect(ledger.rows).toBe(5);
    expect(ledger.truncated).toBe(false);
    expect(ledger.rowsShown).toHaveLength(5);
    expect(ledger.perCheck['dh-review']).toEqual({
      deferred: 1,
      conditional: 0,
      runPass: 1,
      runFail: 0,
      notApplicable: 0,
    });
    expect(ledger.unresolved).toEqual(['dh-domain-check', 'dh-simplify']);
    expect(ledger.issues).toEqual([]);
  });

  it('shows the last 20 rows and flags truncation', () => {
    const rows = Array.from(
      { length: 25 },
      (_, index) => `| 2026-11-10T10:00:00.000Z | check-${index} | Plan | reason | deferred to end-of-plan |`
    ).join('\n');
    const contents = `| Timestamp | Check | Scope | Reason | Disposition |\n|---|---|---|---|---|\n${rows}\n`;
    const ledger = parseLedger(sourceFile(LEDGER_PATH, contents));
    expect(ledger.rows).toBe(25);
    expect(ledger.rowsShown).toHaveLength(20);
    expect(ledger.rowsShown[0]?.check).toBe('check-5');
    expect(ledger.truncated).toBe(true);
    expect(ledger.unresolved).toHaveLength(25);
  });

  it('marks a malformed ledger without throwing', () => {
    const ledger = parseLedger(sourceFile(LEDGER_PATH, '# no table here\n'));
    expect(ledger.present).toBe(false);
    expect(ledger.issues.map((issue) => issue.code)).toEqual(['ledger-malformed']);
  });
});

describe('deriveFastState', () => {
  const source = fixture('active-plan.md');

  it('compares the stored source hash and mirror statuses', () => {
    const details = fastDetails(source, mirrorOf(source));
    const { fast, warnings } = deriveFastState({ planContents: source, source: parsePlan(source), details });
    expect(fast).toMatchObject({
      present: true,
      stale: false,
      statusesAligned: true,
      updatedAt: '2026-11-14T00:00:00.000Z',
    });
    expect(fast.ledger.rows).toBe(5);
    expect(fast.alignment).toEqual({
      preExecution: { present: false, path: null, verdict: null, date: null },
      planEnd: { present: false, path: null, verdict: null, date: null },
    });
    expect(warnings).toEqual([]);
  });

  it('ignores status-only drift for staleness but flags misalignment', () => {
    const mirror = mirrorOf(source, (phases) =>
      phases.replace(
        '### Phase 2: Checkout Service\n\n- **Status:** In Progress',
        '### Phase 2: Checkout Service\n\n- **Status:** Completed'
      )
    );
    const { fast, warnings } = deriveFastState({
      planContents: source,
      source: parsePlan(source),
      details: fastDetails(source, mirror),
    });
    expect(fast.stale).toBe(false);
    expect(fast.statusesAligned).toBe(false);
    expect(warnings.map((issue) => issue.code)).toContain('mirror-status-mismatch');
  });

  it('marks the mirror stale when the plan body changes', () => {
    const changed = source.replace(
      'Exercise the progress model with a small phased plan.',
      'A different objective now.'
    );
    const { fast } = deriveFastState({
      planContents: changed,
      source: parsePlan(changed),
      details: fastDetails(changed, mirrorOf(source)),
    });
    expect(fast.stale).toBe(true);
  });

  it('reports stale as unknown when the mirror has no source hash', () => {
    const mirror = mirrorOf(source).replace(/^source_sha256:.*\n/m, '');
    const { fast, warnings } = deriveFastState({
      planContents: source,
      source: parsePlan(source),
      details: fastDetails(source, mirror),
    });
    expect(fast.stale).toBeNull();
    expect(warnings.map((issue) => issue.code)).toContain('frontmatter-malformed');
  });

  it('parses fast-alignment files with verdict and created date', () => {
    const alignment = parseAlignment(
      sourceFile(
        'docs/plans/checkout-flow/tasks/review-fast-final.md',
        '---\ncreated: 2026-11-13\n---\n\n# Plan Alignment Review\n\n**Verdict:** Approve\n'
      )
    );
    expect(alignment).toMatchObject({ present: true, verdict: 'Approve', date: '2026-11-13T00:00:00.000Z' });
    expect(parseAlignment(null)).toMatchObject({ present: false, verdict: null, date: null });
  });
});

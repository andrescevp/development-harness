/**
 * plan-checklists.test.ts — checkbox grammar, grouping, caps and criteria (§6).
 */
import { describe, expect, it } from 'vitest';
import { extractChecklists } from '../plan-checklists.js';
import { fixture } from './helpers.js';

const REL = 'docs/plans/synthetic/plan.md';

function planWith(body: string): string {
  return `# Plan: Synthetic

## Phases

### Phase 1: Work

- **Status:** Pending

#### Sub-Task 1.1: Do the work

- **Status:** Pending
${body}
`;
}

describe('extractChecklists', () => {
  it('reads plan checkboxes, joins continuations and scopes sections', () => {
    const extraction = extractChecklists(fixture('active-plan.md'), 'docs/plans/checkout-flow/plan.md');
    expect(extraction.plan.total).toBe(4);
    expect(extraction.plan.checked).toBe(1);
    expect(extraction.plan.truncated).toBe(false);
    expect(extraction.plan.inlineText).toBeNull();

    const joined = extraction.plan.items.find((item) => item.text.startsWith('Continuation lines'));
    expect(joined?.text).toBe('Continuation lines are joined into one item text.');
    expect(joined?.checked).toBe(false);
    expect(joined?.section).toBe('Final Integration & Verification');
    expect(joined?.subTaskIndex).toBeNull();
    expect(joined?.kind).toBe('checkbox');
    expect(joined?.id).toMatch(/#L\d+$/);

    expect(extraction.finalVerification.total).toBe(4);
    expect(extraction.finalVerification.checked).toBe(1);
    expect(extraction.finalVerification.items.map((item) => item.text)).toContain('Top-level verification item.');
  });

  it('groups checkbox items per sub-task', () => {
    const extraction = extractChecklists(planWith('- [ ] First\n- [x] Second\n  - [ ] Nested child\n- [ ] Third'), REL);
    expect(extraction.bySubTask['1.1']?.map((item) => item.text)).toEqual(['First', 'Second', 'Nested child', 'Third']);
    expect(extraction.bySubTask['1.1']?.[1]?.checked).toBe(true);
    expect(extraction.bySubTask['1.1']?.[0]?.subTaskIndex).toBe('1.1');
    expect(extraction.plan.total).toBe(4);
  });

  it('extracts Done When and Acceptance Criteria as unchecked criteria', () => {
    const extraction = extractChecklists(fixture('active-plan.md'), 'docs/plans/checkout-flow/plan.md');
    expect(extraction.criteria['1.1']).toEqual([
      { kind: 'done-when', text: 'The contract is recorded and referenced by the plan.' },
      { kind: 'acceptance', text: 'The contract names every required field.' },
    ]);
    expect(extraction.criteria['2.1']).toEqual([
      { kind: 'acceptance', text: 'POST /checkout returns 201 and is covered by tests.' },
    ]);
    expect(extraction.criteria['2.2']?.map((criterion) => criterion.kind)).toEqual(['done-when', 'acceptance']);
  });

  it('uses inline prose when the Completion Checklist has no checkbox children', () => {
    const extraction = extractChecklists(fixture('inline-checklist-plan.md'), 'docs/plans/inline-checklist/plan.md');
    expect(extraction.finalVerification.items).toEqual([]);
    expect(extraction.finalVerification.inlineText).toBe('7 agents / 30 skills; no raw paths; counts unchanged.');
    expect(extraction.plan.total).toBe(0);
  });

  it('caps items at 50 and text at 200 characters without hiding the truncation', () => {
    const body = Array.from({ length: 60 }, (_, index) => `- [x] Item ${index + 1}`).join('\n');
    const capped = extractChecklists(planWith(body), REL);
    expect(capped.plan).toMatchObject({ total: 50, checked: 50, truncated: true });
    expect(capped.plan.items.at(-1)?.text).toBe('Item 50');

    const long = extractChecklists(planWith(`- [ ] ${'a'.repeat(240)}`), REL);
    const text = long.plan.items[0]?.text ?? '';
    expect(text).toHaveLength(200);
    expect(text.endsWith('…')).toBe(true);
  });

  it('returns empty lists for a plan without checkboxes', () => {
    const extraction = extractChecklists(planWith('- **Objective:** None.'), REL);
    expect(extraction.plan).toMatchObject({ total: 0, checked: 0, truncated: false, inlineText: null });
    expect(extraction.criteria).toEqual({});
  });
});

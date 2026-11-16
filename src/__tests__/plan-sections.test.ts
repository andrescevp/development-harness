/**
 * plan-sections.test.ts — `## Phases` region and fenced-example scoping (R1).
 *
 * The parser must read only the `## Phases` region and must ignore fenced
 * code blocks (``` / ~~~), so format examples in `## Core concepts` — or
 * inside the region — never become phantom phases, sub-tasks, or status
 * markers. Status edits follow the same scoping.
 */
import { describe, expect, it } from 'vitest';
import { parsePlan, setStatus } from '../tools/plan-lifecycle.js';

/** Minimal legacy plan: one real phase after the examples. */
const LEGACY = `---
title: Legacy
slug: legacy
---

## Phases

### Phase 1: Only

- **Status:** Pending

#### Sub-Task 1.1: Legacy task

- **Status:** Pending
- **Delegated to agent:** dh-software-engineer
`;

describe('parsePlan: phases region and fenced examples', () => {
  it('ignores fenced phase/sub-task examples outside `## Phases`', () => {
    const doc = `---
title: Fenced
slug: fenced
---

# Plan: Fenced

## Core concepts

\`\`\`markdown
### Phase 2: Phantom

#### Sub-Task 2.1: Phantom task

- **Status:** In Progress
\`\`\`

~~~markdown
### Phase 3: Tilde phantom

#### Sub-Task 3.1: Tilde task
~~~

## Phases

### Phase 1: Real

- **Status:** Pending

#### Sub-Task 1.1: Real task

- **Status:** Pending
- **Delegated to agent:** dh-software-engineer
`;
    const plan = parsePlan(doc);
    expect(plan.phases.map((p) => p.index)).toEqual([1]);
    expect(plan.phases[0]!.title).toBe('Real');
    expect(plan.phases[0]!.subTasks.map((s) => s.index)).toEqual(['1.1']);
  });

  it('ignores fenced examples inside the phases region', () => {
    const doc = `## Phases

### Phase 1: Real

- **Status:** Pending

\`\`\`markdown
### Phase 9: Fenced phantom

#### Sub-Task 9.1: Fenced phantom task

- **Status:** Completed
\`\`\`

#### Sub-Task 1.1: Real task

- **Status:** Pending
- **Delegated to agent:** dh-software-engineer
`;
    const plan = parsePlan(doc);
    expect(plan.phases.map((p) => p.index)).toEqual([1]);
    expect(plan.phases[0]!.subTasks.map((s) => s.index)).toEqual(['1.1']);
    expect(plan.phases[0]!.status).toBe('Pending');
  });

  it('ignores status bullets inside fenced code when locating the section status', () => {
    const doc = `## Phases

### Phase 1: Real

\`\`\`markdown
- **Status:** Completed
\`\`\`

- **Status:** Pending

#### Sub-Task 1.1: T

- **Status:** Pending
- **Delegated to agent:** dh-software-engineer
`;
    expect(parsePlan(doc).phases[0]!.status).toBe('Pending');
  });

  it('does not edit a fenced phase example when setting a status', () => {
    const fenced = `## Core concepts

\`\`\`markdown
### Phase 1: Example

- **Status:** Pending
\`\`\`

`;
    const result = setStatus(`${fenced}${LEGACY.split('---\n\n')[1]}`, 'phase', '1', 'In Progress');
    expect(result.contents).toContain('### Phase 1: Example\n\n- **Status:** Pending');
    expect(result.plan.phases.map((p) => p.index)).toEqual([1]);
    expect(result.plan.phases[0]!.status).toBe('In Progress');
  });

  it('still rejects a plan without a phases region', () => {
    expect(() => parsePlan(`# Flat\n\n## Sub-Tasks\n\n### Sub-Task 1: Old\n`)).toThrow(/not a phased plan/);
    expect(() => parsePlan('## Phases\n\n#### Sub-Task 9.1: Orphan\n\n- **Status:** Pending\n')).toThrow(
      /orphan|not a phased plan/
    );
  });

  it('does not treat a fenced example as the phases region content', () => {
    const doc = `## Core concepts

\`\`\`markdown
### Phase 2: Phantom
\`\`\`

## Phases

No phases yet.
`;
    expect(() => parsePlan(doc)).toThrow(/no `### Phase N:` headers/);
  });
});

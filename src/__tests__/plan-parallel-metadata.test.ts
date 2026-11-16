/**
 * plan-parallel-metadata.test.ts — parallel plan metadata (R1, R8, AC1).
 *
 * Covers the phase/sub-task fields `Parallelizable`, `Depends on`,
 * `Files/Scope`, and `Isolation`: canonical fixture values, documented
 * defaults for legacy plans, `None` sentinels, invalid-value rejection,
 * CRLF tolerance, and scaffold rendering. Region/fence scoping lives in
 * `plan-sections.test.ts`.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPlanTemplate, parsePlan } from '../tools/plan-lifecycle.js';

// One-line reads keep jscpd from flagging the shared fixture-loading block.
const FIXTURE = fs.readFileSync(new URL('./fixtures/plans/phased-plan.md', import.meta.url), 'utf8');
const TEMPLATE = fs.readFileSync(
  new URL('../../skills/dh-planning/references/phased-plan-template.md', import.meta.url),
  'utf8'
);

/** Minimal legacy plan: no parallel metadata anywhere. */
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
- **Related Requirements:** R1
`;

/** One-phase plan whose phase carries a single extra bullet. */
function withPhaseBullet(bullet: string): string {
  return `## Phases

### Phase 1: P

- **Status:** Pending
${bullet}

#### Sub-Task 1.1: T

- **Status:** Pending
- **Delegated to agent:** dh-software-engineer
`;
}

/** One-phase plan whose sub-task carries a single extra bullet. */
function withSubTaskBullet(bullet: string): string {
  return `## Phases

### Phase 1: P

- **Status:** Pending

#### Sub-Task 1.1: T

- **Status:** Pending
- **Delegated to agent:** dh-software-engineer
${bullet}
`;
}

describe('parallel metadata: canonical fixture', () => {
  it('exposes the phase fields with their declared values', () => {
    const plan = parsePlan(FIXTURE);
    expect(plan.phases[0]!.parallelizable).toBe(false);
    expect(plan.phases[0]!.dependsOn).toEqual([]);
    expect(plan.phases[1]!.parallelizable).toBe(true);
    expect(plan.phases[1]!.dependsOn).toEqual(['1']);
  });

  it('exposes the sub-task fields with their declared values', () => {
    const plan = parsePlan(FIXTURE);
    const t11 = plan.phases[0]!.subTasks.find((s) => s.index === '1.1')!;
    expect(t11.parallelizable).toBe(false);
    expect(t11.dependsOn).toEqual([]);
    expect(t11.filesScope).toEqual([]);
    expect(t11.isolation).toBe('shared');

    const t12 = plan.phases[0]!.subTasks.find((s) => s.index === '1.2')!;
    expect(t12.parallelizable).toBe(true);
    expect(t12.dependsOn).toEqual(['1.1']);

    const t21 = plan.phases[1]!.subTasks[0]!;
    expect(t21.parallelizable).toBe(true);
    expect(t21.dependsOn).toEqual(['1.2']);
    expect(t21.filesScope).toEqual(['src/tools/plan-lifecycle.ts', 'src/tools/plan-template.ts']);
    expect(t21.isolation).toBe('worktree');
  });

  it('keeps parsing parallel metadata in CRLF documents', () => {
    const plan = parsePlan(FIXTURE.split('\n').join('\r\n'));
    expect(plan.phases[1]!.dependsOn).toEqual(['1']);
    expect(plan.phases[1]!.subTasks[0]!.isolation).toBe('worktree');
  });
});

describe('parallel metadata: legacy defaults', () => {
  it('defaults every field when a plan declares none', () => {
    const plan = parsePlan(LEGACY);
    const phase = plan.phases[0]!;
    expect(phase.parallelizable).toBe(false);
    expect(phase.dependsOn).toEqual([]);
    const subTask = phase.subTasks[0]!;
    expect(subTask.parallelizable).toBe(false);
    expect(subTask.dependsOn).toEqual([]);
    expect(subTask.filesScope).toEqual([]);
    expect(subTask.isolation).toBe('shared');
  });

  it('treats `None` as the empty sentinel (case-insensitive)', () => {
    const doc = `## Phases

### Phase 1: P

- **Status:** Pending
- **Parallelizable:** no
- **Depends on:** None

#### Sub-Task 1.1: T

- **Status:** Pending
- **Delegated to agent:** dh-software-engineer
- **Depends on:** none
- **Files/Scope:** None
`;
    const plan = parsePlan(doc);
    expect(plan.phases[0]!.dependsOn).toEqual([]);
    expect(plan.phases[0]!.subTasks[0]!.dependsOn).toEqual([]);
    expect(plan.phases[0]!.subTasks[0]!.filesScope).toEqual([]);
  });

  it('splits and normalizes comma-separated lists (backticks stripped)', () => {
    const doc = withSubTaskBullet('- **Files/Scope:** `apps/web/**`, services/api/**,  tests/api/** ');
    const plan = parsePlan(doc);
    expect(plan.phases[0]!.subTasks[0]!.filesScope).toEqual(['apps/web/**', 'services/api/**', 'tests/api/**']);
  });

  it('keeps brace globs as one entry (commas inside braces do not split)', () => {
    const doc = withSubTaskBullet('- **Files/Scope:** src/**/*.{ts,tsx}, tests/**/*.{ts,tsx}');
    const plan = parsePlan(doc);
    expect(plan.phases[0]!.subTasks[0]!.filesScope).toEqual(['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}']);
  });

  it('rejects unmatched braces in Files/Scope', () => {
    expect(() => parsePlan(withSubTaskBullet('- **Files/Scope:** src/**/*.{ts,tsx'))).toThrow(/unmatched '\{'/);
    expect(() => parsePlan(withSubTaskBullet('- **Files/Scope:** src/**/*.ts,tsx}'))).toThrow(/unmatched '\}'/);
  });
});

describe('parallel metadata: invalid values', () => {
  it('rejects unknown Parallelizable values', () => {
    expect(() => parsePlan(withPhaseBullet('- **Parallelizable:** maybe'))).toThrow(/Parallelizable/);
    expect(() => parsePlan(withSubTaskBullet('- **Parallelizable:** true'))).toThrow(/Parallelizable/);
  });

  it('rejects unknown Isolation values', () => {
    expect(() => parsePlan(withSubTaskBullet('- **Isolation:** vm'))).toThrow(/Isolation/);
  });

  it('rejects empty metadata markers', () => {
    expect(() => parsePlan(withSubTaskBullet('- **Files/Scope:**'))).toThrow(/empty Files\/Scope/);
    expect(() => parsePlan(withSubTaskBullet('- **Depends on:**'))).toThrow(/empty Depends on/);
    expect(() => parsePlan(withSubTaskBullet('- **Isolation:**'))).toThrow(/empty Isolation/);
    expect(() => parsePlan(withSubTaskBullet('- **Parallelizable:**'))).toThrow(/empty Parallelizable/);
  });
});

describe('scaffold and contract', () => {
  it('renders defaults and explicit metadata that parse back', () => {
    const doc = buildPlanTemplate({
      slug: 'parallel-demo',
      title: 'Parallel Demo',
      objective: 'Prove metadata round-trips.',
      phases: [
        { title: 'Alpha', subTasks: [{ title: 'A1', delegatedTo: 'dh-software-engineer' }] },
        {
          title: 'Beta',
          parallelizable: true,
          dependsOn: ['1'],
          subTasks: [
            {
              title: 'B1',
              delegatedTo: 'dh-software-engineer',
              parallelizable: true,
              dependsOn: ['1.1'],
              filesScope: ['apps/web/**', 'services/api/**'],
              isolation: 'worktree',
            },
          ],
        },
      ],
    });
    const plan = parsePlan(doc);
    const alpha = plan.phases[0]!;
    expect(alpha.parallelizable).toBe(false);
    expect(alpha.dependsOn).toEqual([]);
    expect(alpha.subTasks[0]!.parallelizable).toBe(false);
    expect(alpha.subTasks[0]!.isolation).toBe('shared');
    expect(alpha.subTasks[0]!.filesScope).toEqual([]);

    const beta = plan.phases[1]!;
    expect(beta.parallelizable).toBe(true);
    expect(beta.dependsOn).toEqual(['1']);
    const b1 = beta.subTasks[0]!;
    expect(b1.parallelizable).toBe(true);
    expect(b1.dependsOn).toEqual(['1.1']);
    expect(b1.filesScope).toEqual(['apps/web/**', 'services/api/**']);
    expect(b1.isolation).toBe('worktree');
  });

  it('keeps status the first bullet of every rendered section', () => {
    const doc = buildPlanTemplate({
      slug: 'order',
      title: 'Order',
      objective: 'o',
      phases: [{ title: 'P', subTasks: [{ title: 'T', delegatedTo: 'dh-software-engineer' }] }],
    });
    const lines = doc.split('\n');
    const phaseAt = lines.findIndex((line) => line.startsWith('### Phase 1:'));
    expect(lines[phaseAt + 1]).toBe('');
    expect(lines[phaseAt + 2]).toBe('- **Status:** Pending');
    const subAt = lines.findIndex((line) => line.startsWith('#### Sub-Task 1.1:'));
    expect(lines[subAt + 1]).toBe('');
    expect(lines[subAt + 2]).toBe('- **Status:** Pending');
    expect(lines[subAt + 3]).toBe('- **Delegated to agent:** dh-software-engineer');
  });

  it('documents every parallel marker in the template, scaffold, and fixture', () => {
    const scaffold = buildPlanTemplate({
      slug: 'contract',
      title: 'Contract',
      objective: 'o',
      phases: [{ title: 'P', subTasks: [{ title: 'T', delegatedTo: 'dh-software-engineer' }] }],
    });
    for (const marker of ['**Parallelizable:**', '**Depends on:**', '**Files/Scope:**', '**Isolation:**']) {
      expect(TEMPLATE, `template ${marker}`).toContain(marker);
      expect(scaffold, `scaffold ${marker}`).toContain(marker);
      expect(FIXTURE, `fixture ${marker}`).toContain(marker);
    }
  });
});

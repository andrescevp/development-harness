/**
 * plan-validation.test.ts — executable scheduling-metadata validation.
 *
 * `validatePlan` catches what `parsePlan` cannot: dangling/typed refs, cycles,
 * duplicate refs, worktree isolation without a scope, and tasks that can never
 * dispatch inside a parallel phase.
 */
import { describe, expect, it } from 'vitest';
import { parsePlan } from '../tools/plan-lifecycle.js';
import { validatePlan } from '../tools/plan-validation.js';

function plan(phases: string): ReturnType<typeof parsePlan> {
  return parsePlan(`## Phases\n\n${phases}`);
}

function phase(number: number, metadata: string, subTasks: string): string {
  return `### Phase ${number}: P${number}\n\n- **Status:** Pending\n${metadata}\n${subTasks}`;
}

function task(ref: string, metadata = ''): string {
  return `#### Sub-Task ${ref}: T${ref}\n\n- **Status:** Pending\n- **Delegated to agent:** dh-software-engineer\n${metadata}`;
}

function codes(doc: ReturnType<typeof parsePlan>): string[] {
  return validatePlan(doc).map((issue) => issue.code);
}

describe('validatePlan — dependency refs', () => {
  it('accepts a valid legacy plan without errors', () => {
    const issues = validatePlan(plan(phase(1, '', task('1.1'))));
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('rejects a phase dependency expressed as a sub-task ref', () => {
    const doc = plan(phase(1, '- **Depends on:** 1.1', task('1.1')));
    expect(codes(doc)).toContain('invalid-phase-dependency');
  });

  it('rejects a sub-task dependency expressed as a phase ref', () => {
    const doc = plan(phase(1, '', task('1.1', '- **Depends on:** 1')));
    expect(codes(doc)).toContain('invalid-subtask-dependency');
  });

  it('rejects missing dependency targets', () => {
    const doc = plan(
      `${phase(1, '', task('1.1', '- **Depends on:** 1.9'))}\n\n${phase(2, '- **Depends on:** 4', task('2.1'))}`
    );
    expect(codes(doc)).toEqual(expect.arrayContaining(['missing-subtask-dependency', 'missing-phase-dependency']));
  });
});

describe('validatePlan — cycles and duplicates', () => {
  it('rejects a two-task dependency cycle', () => {
    const doc = plan(
      phase(1, '', `${task('1.1', '- **Depends on:** 1.2')}\n\n${task('1.2', '- **Depends on:** 1.1')}`)
    );
    expect(codes(doc)).toContain('cyclic-dependency');
  });

  it('rejects a self dependency', () => {
    const doc = plan(phase(1, '', task('1.1', '- **Depends on:** 1.1')));
    expect(codes(doc)).toContain('cyclic-dependency');
  });

  it('rejects a sequential phase depending on a later sequential phase', () => {
    const doc = plan(`${phase(1, '- **Depends on:** 2', task('1.1'))}\n\n${phase(2, '', task('2.1'))}`);
    expect(codes(doc)).toContain('cyclic-dependency');
  });

  it('rejects forward dependencies that cannot start first', () => {
    const sequentialWaitsLater = plan(
      `${phase(1, '', task('1.1', '- **Depends on:** 2.1'))}\n\n${phase(2, '- **Parallelizable:** yes', task('2.1', '- **Parallelizable:** yes'))}`
    );
    expect(codes(sequentialWaitsLater)).toContain('later-phase-dependency');

    const parallelWaitsSequential = plan(
      `${phase(1, '- **Parallelizable:** yes', task('1.1', '- **Parallelizable:** yes\n- **Depends on:** 2.1'))}\n\n${phase(2, '', task('2.1'))}`
    );
    expect(codes(parallelWaitsSequential)).toContain('later-phase-dependency');
  });

  it('rejects duplicate phase and sub-task refs', () => {
    const doc = plan(`${phase(1, '', task('1.1'))}\n\n${phase(1, '', task('1.1'))}`);
    expect(codes(doc)).toEqual(expect.arrayContaining(['duplicate-phase', 'duplicate-subtask']));
  });
});

describe('validatePlan — eligibility and isolation', () => {
  it('rejects a sequential sub-task inside a parallel phase', () => {
    const doc = plan(phase(1, '- **Parallelizable:** yes', task('1.1')));
    expect(codes(doc)).toContain('sequential-subtask-in-parallel-phase');
  });

  it('warns when a sequential phase declares a parallel sub-task', () => {
    const doc = plan(phase(1, '', task('1.1', '- **Parallelizable:** yes')));
    const issues = validatePlan(doc);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'warning', code: 'parallel-subtask-in-sequential-phase' }),
      ])
    );
  });

  it('rejects worktree isolation without a Files/Scope declaration', () => {
    const doc = plan(phase(1, '', task('1.1', '- **Isolation:** worktree')));
    expect(codes(doc)).toContain('worktree-without-scope');
  });

  it('accepts worktree isolation with a scope', () => {
    const doc = plan(phase(1, '', task('1.1', '- **Isolation:** worktree\n- **Files/Scope:** src/tools/**')));
    expect(validatePlan(doc).filter((issue) => issue.severity === 'error')).toEqual([]);
  });
});

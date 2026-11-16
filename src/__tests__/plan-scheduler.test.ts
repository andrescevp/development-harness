import { describe, expect, it } from 'vitest';
import { phaseReady, type SchedulerPhase, scopesOverlap, subTaskReady } from './helpers/plan-scheduler.js';

const task = (index: string, overrides: Partial<SchedulerPhase['subTasks'][number]> = {}) => ({
  index,
  status: 'Pending' as const,
  parallelizable: false,
  dependsOn: [] as string[],
  ...overrides,
});

const phase = (index: number, overrides: Partial<SchedulerPhase> = {}): SchedulerPhase => ({
  index,
  status: 'Pending',
  parallelizable: false,
  dependsOn: [],
  subTasks: [],
  ...overrides,
});

describe('scope overlap', () => {
  it('treats empty/unknown scopes as overlapping (serialize)', () => {
    expect(scopesOverlap([], ['src/**'])).toBe(true);
    expect(scopesOverlap(['src/**'], [])).toBe(true);
  });

  it('overlaps a directory prefix and a glob below it', () => {
    expect(scopesOverlap(['src/tools/**'], ['src/tools/plan-*.ts'])).toBe(true);
    expect(scopesOverlap(['src/**'], ['src/tools/**'])).toBe(true);
  });

  it('keeps sibling names with a shared text prefix disjoint', () => {
    expect(scopesOverlap(['src/tools'], ['src/tools-extra'])).toBe(false);
    expect(scopesOverlap(['src/**'], ['tests/**'])).toBe(false);
  });

  it('normalizes backticks, backslashes, and trailing slashes', () => {
    expect(scopesOverlap(['`src/tools/`'], ['src\\tools\\plan-*.ts'])).toBe(true);
  });
});

describe('phase readiness', () => {
  it('requires pending status and completed dependencies', () => {
    expect(phaseReady(phase(1), [phase(1)])).toBe(true);
    expect(phaseReady(phase(1, { status: 'In Progress' }), [phase(1)])).toBe(false);
    expect(phaseReady(phase(2, { dependsOn: ['1'] }), [phase(1), phase(2)])).toBe(false);
    expect(phaseReady(phase(2, { dependsOn: ['1'] }), [phase(1, { status: 'Completed' }), phase(2)])).toBe(true);
  });

  it('allows a parallel phase out of order but keeps sequential phases in order', () => {
    const p1 = phase(1);
    const p2 = phase(2, { parallelizable: true });
    expect(phaseReady(p2, [p1, p2])).toBe(true);
    expect(phaseReady(phase(2), [p1, phase(2)])).toBe(false);
    expect(phaseReady(p2, [p1, p2], [phase(1, { status: 'In Progress' })])).toBe(false);
    expect(phaseReady(p2, [p1, p2], [phase(1, { status: 'In Progress', parallelizable: true })])).toBe(true);
    expect(phaseReady(phase(2), [p1, phase(2)], [phase(1, { status: 'In Progress', parallelizable: true })])).toBe(
      false
    );
  });
});

describe('sub-task readiness', () => {
  const active = phase(1, { status: 'In Progress' });

  it('requires an active phase, pending status, and completed deps', () => {
    expect(subTaskReady(task('1.1'), active, [task('1.1')])).toBe(true);
    expect(subTaskReady(task('1.1'), phase(1), [task('1.1')])).toBe(false);
    expect(subTaskReady(task('1.2', { dependsOn: ['1.1'] }), active, [task('1.1'), task('1.2')])).toBe(false);
  });

  it('allows parallel tasks and the next sequential task', () => {
    const parallelPhase = phase(1, { status: 'In Progress', parallelizable: true });
    expect(subTaskReady(task('1.1'), active, [task('1.1')])).toBe(true);
    expect(subTaskReady(task('1.2', { parallelizable: true }), parallelPhase, [task('1.1'), task('1.2')])).toBe(true);
    expect(subTaskReady(task('1.2'), active, [task('1.1', { status: 'Completed' }), task('1.2')])).toBe(true);
  });

  it('does not start a later sequential task while an earlier one is In Progress', () => {
    expect(subTaskReady(task('1.2'), active, [task('1.1', { status: 'In Progress' }), task('1.2')])).toBe(false);
    expect(subTaskReady(task('1.3'), active, [task('1.1', { status: 'Completed' }), task('1.2'), task('1.3')])).toBe(
      false
    );
  });
});

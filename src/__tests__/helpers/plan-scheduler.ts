/**
 * plan-scheduler.ts — pure readiness and scope-overlap oracles for the parallel
 * scheduler contract. The orchestrators are Markdown-driven; these helpers are
 * the executable definition used by tests and available to future tooling.
 */

type SchedulerStatus = 'Pending' | 'In Progress' | 'Completed';

export interface SchedulerSubTask {
  index: string;
  status: SchedulerStatus;
  parallelizable: boolean;
  dependsOn: readonly string[];
}

export interface SchedulerPhase {
  index: number;
  status: SchedulerStatus;
  parallelizable: boolean;
  dependsOn: readonly string[];
  subTasks: readonly SchedulerSubTask[];
}

const COMPLETE = 'Completed';
const PENDING = 'Pending';

/** Normalize a declared file/scope entry for overlap comparisons. */
function normalizeScope(entry: string): string {
  return entry.replaceAll('\\', '/').replaceAll('`', '').trim().replace(/\/+$/, '');
}

/** Literal prefix before the first glob metacharacter. */
function literalPrefix(entry: string): string {
  const normalized = normalizeScope(entry);
  const globAt = normalized.search(/[*?[]/);
  return (globAt === -1 ? normalized : normalized.slice(0, globAt)).replace(/\/+$/, '');
}

/**
 * Conservative overlap test for declared scopes. Empty/unknown entries overlap
 * everything (serialize); a literal directory prefix overlaps its descendants;
 * sibling names that only share a text prefix (`src/tools` vs `src/tools-extra`)
 * do not overlap.
 */
export function scopesOverlap(left: readonly string[], right: readonly string[]): boolean {
  if (left.length === 0 || right.length === 0) return true;

  return left.some((a) =>
    right.some((b) => {
      const pa = literalPrefix(a);
      const pb = literalPrefix(b);
      if (pa === '' || pb === '') return true;
      return pa === pb || pa.startsWith(`${pb}/`) || pb.startsWith(`${pa}/`);
    })
  );
}

/** A phase is ready when pending, dependency-complete, and sequential-next or parallel. */
export function phaseReady(phase: SchedulerPhase, phases: readonly SchedulerPhase[]): boolean {
  if (phase.status !== PENDING) return false;
  if (!phase.dependsOn.every((ref) => phases.find((p) => p.index === Number(ref))?.status === COMPLETE)) return false;
  if (phase.parallelizable) return true;
  return phases.every((other) => other.index >= phase.index || other.status === COMPLETE);
}

/** A sub-task is ready when its phase is active, dependencies are complete, and it is eligible. */
export function subTaskReady(
  task: SchedulerSubTask,
  phase: SchedulerPhase,
  tasks: readonly SchedulerSubTask[]
): boolean {
  if (task.status !== PENDING || phase.status !== 'In Progress') return false;
  if (!task.dependsOn.every((ref) => tasks.find((t) => t.index === ref)?.status === COMPLETE)) return false;
  if (task.parallelizable) return true;
  return tasks.find((t) => t.status === PENDING)?.index === task.index;
}

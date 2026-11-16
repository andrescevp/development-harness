/**
 * plan-validation.ts — executable validation for phased-plan scheduling metadata.
 *
 * `parsePlan` guarantees shape and marker syntax; this module adds the
 * cross-reference rules the parallel scheduler relies on: dependency refs must
 * exist and have the right type, the combined scheduling graph must be acyclic,
 * duplicate refs are rejected, and worktree isolation requires a declared
 * scope. `plan_create` refuses a scaffold with errors; `plan_read` returns the
 * issues so a hand-written plan fails before dispatch instead of at runtime.
 */
import type { PlanDocument } from './plan-lifecycle.js';

type PlanIssueSeverity = 'error' | 'warning';

export interface PlanValidationIssue {
  severity: PlanIssueSeverity;
  /** Stable machine code, e.g. `missing-subtask-dependency`. */
  code: string;
  /** `N` for phases, `N.M` for sub-tasks, `plan` for document-level issues. */
  ref: string;
  message: string;
}

const PHASE_REF = /^\d+$/;
const SUBTASK_REF = /^\d+\.\d+$/;
const TASK_PREFIX = 'task:';
const PHASE_PREFIX = 'phase:';

function issue(severity: PlanIssueSeverity, code: string, ref: string, message: string): PlanValidationIssue {
  return { severity, code, ref, message };
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    else seen.add(value);
  }
  return [...repeated];
}

function refOf(node: string): string {
  return node.startsWith(TASK_PREFIX) ? node.slice(TASK_PREFIX.length) : node.slice(PHASE_PREFIX.length);
}

function addEdge(graph: Map<string, string[]>, from: string, to: string): void {
  const list = graph.get(from);
  if (list) list.push(to);
  else graph.set(from, [to]);
}

/** DFS colouring; report each cycle once, keyed by the sorted node pair. */
function detectCycles(graph: Map<string, string[]>, issues: PlanValidationIssue[]): void {
  const state = new Map<string, 'visiting' | 'done'>();
  const reported = new Set<string>();

  const visit = (node: string): void => {
    state.set(node, 'visiting');
    for (const next of graph.get(node) ?? []) {
      const current = state.get(next);
      if (current === 'visiting') {
        const key = [node, next].sort().join('|');
        if (!reported.has(key)) {
          reported.add(key);
          issues.push(
            issue('error', 'cyclic-dependency', refOf(next), `dependency cycle: ${refOf(node)} → ${refOf(next)}`)
          );
        }
      } else if (current === undefined) {
        visit(next);
      }
    }
    state.set(node, 'done');
  };

  for (const node of graph.keys()) {
    if (state.get(node) === undefined) visit(node);
  }
}

/** Phase-level graph: dependency edges plus sequential phase-order gates. */
function validatePhases(plan: PlanDocument, issues: PlanValidationIssue[]): void {
  const phaseList = plan.phases.map((phase) => String(phase.index));
  const phaseRefs = new Set(phaseList);
  for (const ref of duplicates(phaseList)) {
    issues.push(issue('error', 'duplicate-phase', ref, `phase ${ref} is declared more than once`));
  }

  const graph = new Map<string, string[]>();
  for (const phase of plan.phases) {
    const ref = String(phase.index);
    if (phase.subTasks.length === 0) {
      issues.push(issue('warning', 'empty-phase', ref, `phase ${ref} has no sub-tasks`));
    }
    const seen = new Set<string>();
    for (const raw of phase.dependsOn) {
      const dep = raw.trim();
      if (!PHASE_REF.test(dep)) {
        issues.push(
          issue(
            'error',
            'invalid-phase-dependency',
            ref,
            `phase ${ref} dependency '${raw}' must be a phase number, not a sub-task ref`
          )
        );
        continue;
      }
      if (!phaseRefs.has(dep)) {
        issues.push(issue('error', 'missing-phase-dependency', ref, `phase ${ref} depends on missing phase ${dep}`));
        continue;
      }
      if (Number(dep) === phase.index) {
        issues.push(issue('error', 'cyclic-dependency', ref, `phase ${ref} depends on itself`));
        continue;
      }
      if (seen.has(dep)) {
        issues.push(
          issue('warning', 'duplicate-dependency', ref, `phase ${ref} lists dependency ${dep} more than once`)
        );
        continue;
      }
      seen.add(dep);
      addEdge(graph, `${PHASE_PREFIX}${ref}`, `${PHASE_PREFIX}${dep}`);
    }
    // A sequential phase waits for every earlier phase; combined with a
    // dependency on a later sequential phase this forms a contradiction.
    if (!phase.parallelizable) {
      for (const earlier of plan.phases) {
        if (earlier.index < phase.index) {
          addEdge(graph, `${PHASE_PREFIX}${ref}`, `${PHASE_PREFIX}${earlier.index}`);
        }
      }
    }
  }
  detectCycles(graph, issues);
}

/** Sub-task refs, task graph, worktree scope, and parallel-phase eligibility. */
function validateSubTasks(plan: PlanDocument, issues: PlanValidationIssue[]): void {
  const taskList = plan.phases.flatMap((phase) => phase.subTasks.map((task) => task.index));
  const taskRefs = new Set(taskList);
  for (const ref of duplicates(taskList)) {
    issues.push(issue('error', 'duplicate-subtask', ref, `sub-task ${ref} is declared more than once`));
  }

  const graph = new Map<string, string[]>();
  const taskNode = (ref: string) => `${TASK_PREFIX}${ref}`;

  for (const phase of plan.phases) {
    for (const task of phase.subTasks) {
      const seen = new Set<string>();
      for (const raw of task.dependsOn) {
        const dep = raw.trim();
        if (!SUBTASK_REF.test(dep)) {
          issues.push(
            issue(
              'error',
              'invalid-subtask-dependency',
              task.index,
              `sub-task ${task.index} dependency '${raw}' must be an N.M sub-task id`
            )
          );
          continue;
        }
        if (!taskRefs.has(dep)) {
          issues.push(
            issue(
              'error',
              'missing-subtask-dependency',
              task.index,
              `sub-task ${task.index} depends on missing sub-task ${dep}`
            )
          );
          continue;
        }
        if (dep === task.index) {
          issues.push(issue('error', 'cyclic-dependency', task.index, `sub-task ${task.index} depends on itself`));
          continue;
        }
        if (seen.has(dep)) {
          issues.push(
            issue(
              'warning',
              'duplicate-dependency',
              task.index,
              `sub-task ${task.index} lists dependency ${dep} more than once`
            )
          );
          continue;
        }
        seen.add(dep);
        const targetPhase = plan.phases.find((candidate) => candidate.subTasks.some((target) => target.index === dep));
        if (targetPhase && targetPhase.index > phase.index) {
          if (!phase.parallelizable) {
            issues.push(
              issue(
                'error',
                'later-phase-dependency',
                task.index,
                `sub-task ${task.index} in sequential phase ${phase.index} depends on later phase ${targetPhase.index}; the phase cannot start first`
              )
            );
          }
          if (!targetPhase.parallelizable) {
            issues.push(
              issue(
                'error',
                'later-phase-dependency',
                task.index,
                `sub-task ${task.index} depends on later sequential phase ${targetPhase.index}, which cannot start first`
              )
            );
          }
        }
        addEdge(graph, taskNode(task.index), taskNode(dep));
      }

      if (task.isolation === 'worktree' && task.filesScope.length === 0) {
        issues.push(
          issue(
            'error',
            'worktree-without-scope',
            task.index,
            `sub-task ${task.index} uses Isolation: worktree without a Files/Scope declaration`
          )
        );
      }
      if (phase.parallelizable && !task.parallelizable) {
        issues.push(
          issue(
            'error',
            'sequential-subtask-in-parallel-phase',
            task.index,
            `sub-task ${task.index} is not Parallelizable but phase ${phase.index} is Parallelizable: yes`
          )
        );
      }
      if (!phase.parallelizable && task.parallelizable) {
        issues.push(
          issue(
            'warning',
            'parallel-subtask-in-sequential-phase',
            task.index,
            `sub-task ${task.index} declares Parallelizable: yes inside sequential phase ${phase.index}; it runs sequentially`
          )
        );
      }
    }

    // Phase dependencies gate every sub-task of the dependent phase.
    for (const raw of phase.dependsOn) {
      const dep = raw.trim();
      if (!PHASE_REF.test(dep)) continue;
      const target = plan.phases.find((candidate) => String(candidate.index) === dep);
      if (!target) continue;
      for (const task of phase.subTasks) {
        for (const depTask of target.subTasks) {
          addEdge(graph, taskNode(task.index), taskNode(depTask.index));
        }
      }
    }

    // A sequential phase waits for earlier phases and earlier sub-tasks.
    if (!phase.parallelizable) {
      const earlierTasks = plan.phases
        .filter((candidate) => candidate.index < phase.index)
        .flatMap((candidate) => candidate.subTasks);
      for (const task of phase.subTasks) {
        for (const earlier of earlierTasks) addEdge(graph, taskNode(task.index), taskNode(earlier.index));
        for (const earlier of phase.subTasks) {
          if (earlier.number < task.number) addEdge(graph, taskNode(task.index), taskNode(earlier.index));
        }
      }
    }
  }
  detectCycles(graph, issues);
}

/** Validate one parsed plan; empty when scheduling metadata is sound. */
export function validatePlan(plan: PlanDocument): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];
  validatePhases(plan, issues);
  validateSubTasks(plan, issues);
  return issues;
}

/** Throw when any error-severity issue exists; messages are user-facing. */
export function assertValidPlan(plan: PlanDocument, file = '<plan>'): PlanValidationIssue[] {
  const issues = validatePlan(plan);
  const errors = issues.filter((candidate) => candidate.severity === 'error');
  if (errors.length > 0) {
    throw new Error(`${file}: invalid plan metadata:\n${errors.map((error) => `- ${error.message}`).join('\n')}`);
  }
  return issues;
}

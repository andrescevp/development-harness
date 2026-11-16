# Parallel Scheduler Contract (authoritative)

Both `dh-execute-plan` and `dh-execute-plan-fast` follow this contract. Fast
mode differs only in when gates and ledger rows run, never in readiness,
concurrency, isolation, or status ownership.

## 1. Plan metadata

Phases and sub-tasks may declare:

```markdown
### Phase 2: Backend and frontend

- **Status:** Pending
- **Parallelizable:** yes
- **Depends on:** 1

#### Sub-Task 2.1: API endpoint

- **Status:** Pending
- **Delegated to agent:** dh-software-engineer
- **Parallelizable:** yes
- **Depends on:** 1.3
- **Files/Scope:** services/api/**, tests/api/**
- **Isolation:** shared
```

Defaults when a field is absent (legacy plans): `Parallelizable: no`,
`Depends on: None` (no dependencies), `Files/Scope: None` (unknown), and
`Isolation: shared`. A legacy plan therefore runs exactly as before.

`Parallelizable: yes` is a promise by the plan author that the task is safe to
run alongside another ready task. The scheduler cannot infer semantic
independence.

## 2. Validation (before dispatch)

The executable oracle is `validatePlan` in
`src/tools/plan-validation.ts`; `plan_read` returns its `issues[]` and
`plan_create` rejects any error before writing. Stop and report if any of these
fail:

1. Every phase dependency is a phase number naming an existing phase; every
   sub-task dependency is an `N.M` id naming an existing sub-task.
2. No dependency cycle (phase graph, task graph, and the combined
   sequential-gating graph).
3. A task does not depend on itself, on a later task in a sequential phase, or
   on a later phase that cannot start first (any later phase from a sequential
   phase; a later sequential phase from any phase).
4. `Files/Scope: None` with `Isolation: shared` is treated as unknown and is
   never run concurrently with another shared task.
5. `Isolation: worktree` requires a non-empty `Files/Scope`.
6. A `Parallelizable: yes` phase contains only `Parallelizable: yes` tasks.
7. Every sub-task has a `Delegated to agent` matching `## Agent Selection`.

Unknown values are format errors, not silent defaults.

## 3. Readiness

The executable oracle for these rules is
`src/__tests__/helpers/plan-scheduler.ts` (`phaseReady`, `subTaskReady`, `scopesOverlap`);
keep it in sync with this section.

A **phase** is ready when:

- its status is `Pending`;
- every phase in its `Depends on` is `Completed`;
- it is the next phase in plan order, or `Parallelizable: yes`;
- no incompatible phase is currently active: a sequential phase starts only
  when no phase is active, and a parallel phase starts only when no
  non-parallelizable phase is active;
- it is not blocked by a failed/blocked sub-task.

A **sub-task** is ready when:

- its phase is active (`In Progress` or ready to start);
- its status is `Pending`;
- every sub-task in its `Depends on` is `Completed`;
- if the phase is `Parallelizable: yes`, the task is `Parallelizable: yes`;
- if the phase is sequential, **every earlier sub-task in that phase is
  `Completed`** (not merely the first `Pending` one);
- it does not conflict with a running shared-worktree task.

A phase becomes `In Progress` when its first sub-task starts. It becomes
`Completed` only when **all** its sub-tasks are `Completed`.

## 4. Concurrency and dispatch

- Default limit: **3** concurrent workers.
- Optional override: the orchestrator's explicit request, capped at the hard
  limit of **8**.
- The scheduler computes the ready set each cycle, filters conflicts, and
  dispatches at most `limit - running` workers. Re-check scope conflicts on
  every dispatch, not once per cycle.
- Dispatch order: phase order, then sub-task order, then dependency order;
  the ready queue is FIFO (`shift()`), never LIFO.
- Each dispatch is one `subagent` call using the plan's selected implementation
  agent for that sub-task.
- Before dispatch, the orchestrator marks the sub-task (and its phase) `In
  Progress` and records the worker in an in-memory table:
  `{ subTask, agent, isolation, worktree?, branch? }`.
- Workers never select a different task, never mark statuses, and never commit.

## 5. Worker mode

The orchestrator invokes `dh-execute-plan-task` (or `-fast`) with
`parallel-worker` and the exact `subTask` ID. The worker prompt starts with a
literal mode header — `MODE: parallel-worker subTask=<N.M>` — and the task skill
fails when the header is absent while sibling tasks are active (a prose-only
flag lets a mis-invocation silently take the standalone write path). The task
skill:

1. reads the sub-task brief;
2. resolves its delegated agent;
3. implements with TDD and runs narrow validation;
4. returns a result envelope and stops.

```json
{
  "subTask": "2.1",
  "agent": "dh-software-engineer",
  "status": "completed",
  "filesChanged": ["services/api/..."],
  "validation": ["pnpm test -- ...: pass"],
  "blockers": [],
  "notes": ["..."]
}
```

A blocked worker sets `status: "blocked"` and fills `blockers`; `completed` is
the only success value.

Workers do not write `plan.md`, `plan_fast.md`, the ledger, reviews, or commits
in a shared worktree.

## 6. Isolation

| Case | Policy |
|---|---|
| Two shared tasks, disjoint declared scopes | May run concurrently in the same worktree |
| Two shared tasks, overlapping scopes (prefix/glob) | Serialize; never concurrent |
| Any task with `Files/Scope: None` | Unknown; serialize with other shared tasks |
| `Isolation: worktree` | Dedicated branch/worktree; integrate after completion |
| Two worktree tasks | May run concurrently; integrate in dependency/plan order |

Shared worktree rules:

- **Scope normalization:** convert `\` to `/`, trim whitespace/backticks, strip
  trailing `/`; a bare path is a prefix, `**` matches any depth, `*`/`?` match
  within a segment.
- **Overlap test:** two entries overlap when one normalized literal is a prefix
  of the other, or their literal prefixes intersect in a directory segment
  (`src/tools/**` overlaps `src/tools/plan-*.ts`; `src/tools` does not overlap
  `src/tools-extra`). Any unparseable entry or `Files/Scope: None` is unknown →
  serialize. Conservative false positives are preferred over concurrent edits.
- Workers never commit. The orchestrator serializes commits after a batch (or
  after each task, one at a time).
- Build/test outputs, caches, ports, and lockfiles are not covered by source
  scope; use `Isolation: worktree` for tooling-heavy tasks.
- Do not run concurrent git index operations.

Worktree rules:

- Before the first worktree dispatch, confirm the plan's worktree set with the
  user once and record the confirmation in the run state (handoff: decisions);
  `dh-create-worktree` requires that confirmation and never creates a worktree
  merely because a plan started.
- Create a branch/worktree per task with `dh-create-worktree`, based on the
  current integration head (the main worktree's branch tip after prior
  integration), and record the base commit in the worker table/handoff.
- A `Isolation: worktree` task whose `Depends on` includes another task starts
  only after that dependency is **integrated** (its commit is reachable from the
  main worktree), never from a stale base; rebase onto the integration head
  before dispatch if the dependency completed in another worktree.
- On completion, integrate in dependency/plan order (merge or cherry-pick).
- A conflict stops integration; preserve the worktree/branch for inspection.
- Remove merged worktrees only with confirmation; never delete failed or
  conflicted work.

## 7. Review fan-in (standard mode)

- A completed worker result is reviewed by `dh-review` with the exact
  `subTask: "<N.M>"` and the envelope's `filesChanged`; code quality goes to
  `dh-code-review` through the selected reviewer.
- Each review writes its own `tasks/review-<N.M>.md`; the orchestrator reads
  that exact report. The aggregate `tasks/review.md` stays reserved for a
  legacy single-active review and the final sign-off.
- Reviews may run concurrently, but status writes and commits are serialized.
- The review diff is scoped to the envelope's `filesChanged` (or the task
  branch for `Isolation: worktree`) so another worker's uncommitted work never
  enters the verdict.
- P0/P1 findings stop new dispatch; in-flight work drains; the task stays
  `In Progress` and the phase stays open.
- No finding → mark the sub-task `Completed`; close the phase only when all its
  sub-tasks are complete.

## 8. Failure drain

On a blocking failure (worker blocked, validation strikes, P0/P1 review):

1. Stop scheduling new work; do not mark any undispatched task `In Progress`.
2. Let in-flight workers finish or time out.
3. Record their results; do not mark blocked work `Completed`.
4. Leave failed/blocked tasks `In Progress` and their phase open.
5. Preserve worktrees/branches and recommend `dh-pause-plan`.

Never mark a phase `Completed` around a blocker.

## 9. Fast mode differences

- No per-task `dh-review`, `dh-simplify`, `dh-code-review`, `dh-preflight`,
  `dh-artifact-check`, or `dh-domain-check`.
- The orchestrator writes the six per-task ledger rows **serially** after each
  result; workers never append.
- Dual status writes (`plan.md` + `plan_fast.md`) are orchestrator-only and
  serialized.
- End gates run once across the plan after all tasks are done.
- `plan_fast_sync` must accept multiple `In Progress` entries during the run and
  exact equality at close.

## 10. Resume

When one or more sub-tasks are `In Progress`:

- collect **all** active tasks, not just the first;
- reconcile worktrees/branches from the handoff;
- revalidate completed-but-unreviewed work before marking it;
- resume or re-dispatch each active task without duplicates;
- keep phases open until all their sub-tasks are `Completed`.

A paused handoff takes precedence; `dh-resume-plan` rehydrates the active-task
table and re-enters the scheduler.

## 11. Pseudocode

```text
validate(plan)                         # plan-validation.ts: refs, cycles, scope/isolation
confirm_worktree_set_once()           # before the first worktree dispatch
running = {}
completed = set(Completed ids)

loop:
  close_phases_where_all_subtasks_completed()
  readyPhases = phases.filter(p => p.status == "In Progress")
    + phases.filter(phase_ready)
  ready = readyPhases
    .flatMap(phase => phase.subTasks.filter(task_ready))
    .sort(phase, task, dependencies)   # FIFO: shift() below

  while not stop_new_dispatch and ready and len(running) < limit:
    task = ready.shift()
    if scope_conflicts(task, running): continue
    mark(task, phase, "In Progress")   # serialized
    running.add(dispatch_worker(task, task.isolation))

  if running is empty:
    if all_subtasks_completed(): run_end_gates(); break
    if blocked: report_and_stop()
    if no_ready: report_deadlock_or_missing_metadata(); stop

  result = wait_any(running)
  running.remove(result.task)
  if result.status == blocked: blocked.add(result); stop_new_dispatch = true
  else: queue_review_or_complete(result)
```

## 12. Examples

**Legacy sequential plan:** every field absent → `Parallelizable: no`,
`Depends on: None`, `Files/Scope: None`, `Isolation: shared`. Only the first
`Pending` sub-task of the active phase is ready, and only after every earlier
sub-task in that phase is `Completed`; behavior matches today.

**Parallel phase:** Phase 2 is `Parallelizable: yes`, `Depends on: 1`; tasks 2.1
and 2.2 both depend on 1.3 and declare disjoint `Files/Scope`. Both are ready
after 1.3 completes and run concurrently under the shared-worktree rule.

**Worktree task:** Task 2.3 declares `Isolation: worktree` and a scope
overlapping 2.1. It runs in its own branch/worktree; after completion it is
merged after 2.1/2.2 in plan order. A conflict stops integration.

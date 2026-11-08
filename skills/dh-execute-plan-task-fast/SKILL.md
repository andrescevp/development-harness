---
name: dh-execute-plan-task-fast
description: >
  Execute exactly one sub-task from docs/plans/<slug>/plan_fast.md in fast mode: read the fast mirror first, select the active sub-task (In Progress first), record the six per-task skipped-check rows, delegate implementation to @dh-software-engineer with TDD, run only a narrow sanity check, and update status in both plans via dh_plan_fast_update_status. Use for the next fast sub-task or continuing fast execution — no per-task review, simplify, code-review, preflight, artifact-check, or domain-check.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, edit, bash
metadata:
  audience: developers
  workflow: development
---

Execute one self-contained sub-task in **fast mode**, driven by the
`plan_fast.md` execution mirror. Critical verification is deferred to the end
of the plan by `dh-execute-plan-fast`; this skill only implements, sanity-checks,
and records status.

## Core Rules

- **Rule 1 — always read `plan_fast.md` first.** Read it with
  `dh_plan_fast_read` (fallback: manual read); it returns the plan,
  `source_sha256`, `stale`, and the skip-checks path. If it does not exist,
  **stop** and instruct `dh-execute-plan-fast` to create it from `plan.md`
  using its template. **Never execute from `plan.md` alone.**
- **`plan.md` is the scope truth (content read-only).** Read it only to confirm
  the sub-task brief, requirements, and scope boundaries; fast mode never edits
  its content and only mirrors status markers into it. If `plan.md` and
  `plan_fast.md` disagree on scope, requirements, or acceptance criteria, stop
  and report the misalignment — do not choose one silently and do not edit
  `plan.md` content.
- **`plan_fast.md` is the execution source.** Treat the mirrored sub-task entry
  as the full implementation brief (objective, requirements, in/out of scope,
  instructions, acceptance criteria, cautionary points, testing suggestions,
  done-when).
- **ALL implementation is delegated to `@dh-software-engineer`** (the harness's
  single task executor). There is no complexity- or type-based builder split:
  simple, standard, complex, and non-software work all go to
  `@dh-software-engineer`.
- **Detect project type once** from the full marker list used by
  `dh-execute-plan-task`: `package.json`, `pyproject.toml`, `Cargo.toml`,
  `composer.json`, `go.mod`, `CMakeLists.txt`, `setup.py`, `setup.cfg`,
  `Gemfile`, `project.clj`, `deps.edn`, `mix.exs`, `pubspec.yaml`,
  `Build.scala`, `build.gradle`, `*.csproj`, `*.sln`. Report the detected type
  to the orchestrator (it governs the end gates); it never changes who
  implements and adds no gates here.
- **No per-task gates.** Do not run `dh-review`, `dh-simplify`,
  `dh-code-review`, `dh-preflight`, `dh-artifact-check`, or `dh-domain-check`.
  Keep the smallest relevant validation (tests/lint for the changed files)
  through `@dh-executor`; it is a sanity check, not a review gate.
- **Skip-check ledger:** after selecting the sub-task, append its six per-task
  rows with `dh_plan_fast_skip_check` (one call, `checks: [...]`, scope
  `Sub-Task N.M`, reason `fast mode defers per-task verification`).
  Disposition `end-of-plan`; for non-software, `dh-simplify`,
  `dh-code-review`, and `dh-domain-check` use `not applicable (non-software)`.
  Append-only; never delete rows.
- **Status lifecycle (both plans, one write):** use
  `dh_plan_fast_update_status` (`{ slug, target, index, status }`) for
  `In Progress` and `Completed`; it updates **both plans** and reverts on a
  failed mirror write. On a phase's first sub-task also set the phase and the
  plan frontmatter `status: In Progress` in both files. Fallback: manual dual
  edit with retry/revert. Never update only one plan; never close a phase
  while a sub-task is open.
- **Pause/resume:** on a hard blocker run `dh-pause-plan`. `dh-resume-plan`
  defaults to standard execution and re-enters **fast mode** after marking the
  handoff `resumed` when `plan_fast.md` exists.
- **If all sub-tasks are `Completed`**, hand back to `dh-execute-plan-fast` for
  end-of-plan verification. Do not run alignment review, simplify, code-review,
  preflight, artifact-check, or final review yourself.
- Do not modify files outside the sub-task scope; verify dependencies on
  earlier sub-tasks are `Completed` before starting.

## Workflow

### Step 1: Read the fast mirror and confirm the plan

1. Read `plan_fast.md` first with `dh_plan_fast_read` (Rule 1); confirm
   `stale: false`, `source_sha256`, and the skip-checks path. Missing or stale
   → stop and direct the caller to `dh-execute-plan-fast`.
2. Confirm `./docs/plans/<plan-slug>/plan.md` exists. Missing → stop and
   suggest `dh-planning`; a mirror without its source plan is not executable.
3. Read the matching sub-task in `plan.md` and confirm both plans parse and
   agree on its ID, title, requirements, and scope. A mismatch is an alignment
   blocker: stop and send the caller back to `dh-execute-plan-fast` Step 4.

### Step 2: Select the active sub-task and record skipped checks

Use the phase-aware priority on `plan_fast.md`:

1. First phase marked `In Progress` → its first `In Progress` sub-task, else
   its first `Pending` sub-task. If one is `In Progress`, resume it without
   resetting; run `dh_plan_fast_sync` (fast→plan) if the mirror is ahead, but
   stop and ask if `plan.md` is ahead.
2. No `In Progress` phase → the first sub-task of the first `Pending` phase.
   Mark it and its phase `In Progress` with `dh_plan_fast_update_status` (both
   plans).
3. Multiple `In Progress` phases/sub-tasks, or **out-of-order** statuses (a
   later sub-task advanced while an earlier one is still `Pending`) → stop and
   ask; never silently resume the earlier `Pending` task.
4. No `In Progress` or `Pending` sub-tasks → report completion and hand back to
   `dh-execute-plan-fast` for final verification.
5. **Record the six per-task checks** in `plan_fast_skip_checks.md` with one
   `dh_plan_fast_skip_check` call: `checks: [dh-review, dh-simplify,
   dh-code-review, dh-domain-check, dh-preflight, dh-artifact-check]`, scope
   `Sub-Task N.M`, reason `fast mode defers per-task verification`, and the
   dispositions from the Core Rule. Missing ledger → stop; the orchestrator
   recreates it before any work.

### Step 3: Implement through the single executor

- Delegate the full sub-task brief from `plan_fast.md` to
  `@dh-software-engineer`; include the project type and `CODE_RULES.md`
  guidance when present.
- The implementation follows the `dh-coding` skill inside that pass (failing
  test first, then the minimal change; TDD).
- Stay within the sub-task's in-scope boundaries. Do not widen scope, add
  sub-tasks, or refactor unrelated code.
- Do not implement the work yourself and do not seek another builder:
  `@dh-software-engineer` is the only executor.
- Ask `@dh-executor` to run only the smallest relevant validation for the
  changed files (targeted tests, linters, type checks). Do **not** run the full
  preflight or artifact checks.
- If validation fails 3 consecutive times, stop and report the full error
  output. Do not mark the sub-task `Completed`; recommend `dh-pause-plan` to
  preserve state before the session ends.

### Step 4: Update both plans

1. Mark the sub-task `Completed` with `dh_plan_fast_update_status`
   (`{ slug, target: "subtask", index: "N.M", status: "Completed" }`); it
   updates **both plans** and reverts on a failed mirror write. Fallback:
   manual dual edit with retry/revert.
2. If ALL sub-tasks of the phase are now `Completed`, close the phase via the
   same tool (`target: "phase"`, index `"N"`); otherwise leave it `In Progress`.
3. Retry a failed write **once**. If it still fails, revert the first write
   (sub-task/phase back to `In Progress`/`Pending`) and stop — never leave
   `plan_fast.md` and `plan.md` diverging. Re-read both files and the ledger
   before reporting.

### Step 5: Report and hand off

Report: sub-task ID/title, detected project type, skip-checks ledger path,
implementation summary, narrow validation result, and the dual-status
confirmation. Then either:

- **Next sub-task exists:** name it and stop — the caller (or the next
  invocation) continues with Step 1.
- **All sub-tasks `Completed`:** state that execution is done and instruct the
  caller to continue with `dh-execute-plan-fast` **Step 6** (end-of-plan
  critical verification). Do not start that verification here.

## Execution Delegation Guide

**Single executor policy:** every sub-task — software, non-software, simple,
standard, complex — is implemented by `@dh-software-engineer`.

| Work | Delegate to | Per-task post-steps |
|---|---|---|
| Software (any complexity) | `@dh-software-engineer` | Narrow validation via `@dh-executor` only |
| Non-software | `@dh-software-engineer` | Narrow validation via `@dh-executor` only |

No per-task `dh-domain-check`, `dh-simplify`, `dh-create-documentation`,
`dh-review`, or `dh-code-review` runs here. `dh-domain-check` is deferred to
plan end **only for architectural multi-module plans**; otherwise it is
explicitly not applicable. The other gates run once in the orchestrator's final
verification.

## Error Handling

- **Missing `plan_fast.md` or ledger:** stop; instruct
  `dh-execute-plan-fast` to create them. Never fall back to `plan.md` alone and
  never claim skipped checks without ledger evidence.
- **Stale mirror** (`stale: true` or hash mismatch): stop; the orchestrator
  realigns before any execution.
- **Missing `plan.md`:** stop; suggest `dh-planning`. The mirror is not a
  substitute for the source plan.
- **Ambiguous state** (multiple `In Progress`, unknown statuses, sub-task
  missing from either file): stop and ask; do not guess.
- **Task failure** (3 consecutive validation failures): stop, report the error
  output, leave the sub-task `In Progress`, and recommend `dh-pause-plan`.
- **Status write failure after retry:** stop, revert the first write, report
  the file and target, and re-read both plans. Never leave them diverging.
- **Scope disagreement between plans:** stop and report it as an alignment
  blocker; the orchestrator fixes the mirror (or asks the user), not this skill.

## Loop Integration (bundled)

This is the **fast alternative** to loop step 2: it runs `dh-execute-plan-task`
work without the immediate 2.2/2.3 gates. The deferred gates run once in
`dh-execute-plan-fast` Steps 6–7: plan-end alignment, simplify/code-review
(software), domain-check (architectural software plans only), preflight +
artifact-check, final review, docs/evolution notes, and semver.

**Hard blockers still halt automation.** Three consecutive validation failures,
unresolved scope/alignment conflicts, or missing preconditions → stop and ask
for guidance. Never mark a sub-task or phase `Completed` around a blocker, and
never skip a deferred gate.

## References

- `dh-execute-plan-fast` skill: orchestrator that creates/aligns `plan_fast.md`, seeds the ledger, and runs end-of-plan verification.
- `dh-execute-plan-task` skill: standard per-task variant with immediate simplify/review gates (for contrast).
- [`../dh-execute-plan-fast/references/plan-fast-template.md`](../dh-execute-plan-fast/references/plan-fast-template.md): the `plan_fast.md` contract.
- [`../dh-execute-plan-fast/references/plan-fast-skip-checks.md`](../dh-execute-plan-fast/references/plan-fast-skip-checks.md): the ledger contract and manual fallback.
- Fast tools: `dh_plan_fast_read`, `dh_plan_fast_update_status`, `dh_plan_fast_skip_check`.
- `dh-coding` skill: TDD and `CODE_RULES.md` enforcement used by `@dh-software-engineer`.

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to `@dh-documentor` — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).

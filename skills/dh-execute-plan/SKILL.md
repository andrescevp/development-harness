---
name: dh-execute-plan
description: >
  Orchestrate full plan execution: read plan.md, iterate sub-tasks delegating execution and review, resume on interruption, final-review sign-off, update index.md. Use when the user says 'execute plan', 'run the plan', or 'finish all tasks'.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, edit, bash
metadata:
  audience: developers
  workflow: development
---

Orchestrate the complete execution of a plan from start to finish. Iterate through all phases and their sub-tasks in order, delegate execution and review, handle interruptions, and produce a final sign-off.

## Core Rules

- Create a feature branch per plan execution
  - Check you are in main branch and create the feature branch.
  - If not in feature branch, ask user permission to continue before any change.
  - if working in monorepos with git submodules create a branch per submodule along with the branch of the main repository to align and trace commints between repositories.
- Read the plan with the `dh_plan_read` tool (`{ slug }` → structured JSON: meta, phases[].title/status, subTasks[].phase/title/status). Fallback when the tool is unavailable: read `./docs/plans/<plan-slug>/plan.md` manually, following the phased template markers (`## Phases` → `### Phase N: <title>` → `#### Sub-Task N.M: <title>` with `- **Status:**` bullets).
- If the plan file does not exist, stop and report — suggest running the `dh-planning` skill first.
- Iterate **phases in order**; within each phase, iterate its sub-tasks in order.
- Phase lifecycle: a phase becomes `In Progress` when its first sub-task starts; it becomes `Completed` only when ALL its sub-tasks are `Completed`.
- Do not re-execute sub-tasks already marked `Completed`.
- If a sub-task is marked `In Progress`, resume from it (don't restart from the beginning).
- Update statuses with the `dh_plan_update_status` tool (`{ slug, target: "phase"|"subtask", index: "N"|"N.M", status }`): mark a sub-task `In Progress` before execution, `Completed` after its review passes, and a phase `Completed` only when all its sub-tasks are `Completed`. Fallback when the tool is unavailable: manual plan.md edits following the marker rules (only blank lines precede status bullets).
- After each sub-task execution, run the `dh-review` skill before proceeding to the next.
- If a review produces P0/P1 findings, stop and report — do not continue to the next sub-task (a blocked sub-task blocks its phase).
- After the final sub-task, run the `dh-final-review` skill for sign-off.
- Update `./docs/plans/index.md` when the plan is fully complete.
- **Project type awareness is delegated to `dh-execute-plan-task`.** The orchestrator does not re-detect project type — it relies on `dh-execute-plan-task` to handle agent selection based on whether the project is software or non-software. Do not hardcode agent choices (e.g., `@senior-engineer`) in the orchestration loop that would conflict with this.
- **After plan completion (all projects):** invokes `evolve` and `state-sync` to capture what was learned and update documentation. This ensures knowledge persists beyond the active session.
- **After plan completion (software projects only):** invokes `dh-create-documentation` for generating/updating project docs, and `semver` for determining the next version bump.

## Workflow

### Step 1: Read plan and assess state

Read the plan (via `dh_plan_read`; fallback: manual read) and determine the starting point using this ordered priority:

1. If all sub-tasks are `Completed` (every phase `Completed`), run `dh-final-review` skill only and proceed to Step 3. Skip the execution loop.
2. Resume mode: if one or more phases are `In Progress`, start from the FIRST `In Progress` phase, then its FIRST sub-task marked `In Progress` or `Pending`.
3. If all phases are `Pending` (all sub-tasks `Pending`), start from Phase 1's first sub-task.
4. If the plan has no phases/sub-tasks, or every phase/sub-task has an unrecognized status, report the ambiguous state and stop.

### Step 2: Execution loop

Iterate **phases in order** (skip phases already `Completed`); within each phase, iterate its sub-tasks starting from the determined starting point:

0. **Mark In Progress**: Ensure the active sub-task is marked `In Progress` via `dh_plan_update_status` (`target: "subtask"`). If it is already `In Progress` (resume), leave the state. Marking the first sub-task of a phase also moves that phase to `In Progress` (phase lifecycle). Fallback: manual plan.md edit per the marker rules. This ensures resume works if interrupted.

1. **Execute**: Follow the `dh-execute-plan-task` skill to implement this sub-task. Since this is called from the orchestrator, `dh-execute-plan-task` skips its internal review and completion steps (per its orchestration guard).

2. **Verify**: Run the `dh-review` skill to verify the sub-task result against its acceptance criteria and produce findings in `./docs/plans/<plan-slug>/tasks/review.md`.

3. **Check findings**: Read the review output:
   - If P0/P1 findings exist: stop the execution loop and report the blocking issues. Do not mark this sub-task `Completed` — a blocked sub-task blocks its phase (loop rule 2.4). Recommend fixing findings and re-running.
   - If no P0/P1 findings: mark the sub-task `Completed` via `dh_plan_update_status` (`target: "subtask"`, status `Completed`). Fallback: manual edit.

3a. **Close the phase**: When ALL sub-tasks of the current phase are `Completed`, mark the phase `Completed` via `dh_plan_update_status` (`target: "phase"`, status `Completed`; the tool refuses phase → `Completed` while any sub-task is open) and report the phase completion. Fallback: manual edit.

4. **Repeat**: Continue to the next sub-task, then the next phase, until all phases are completed.

### Step 3: Final sign-off

After all sub-tasks are completed and verified:

1. Run the `dh-final-review` skill for the comprehensive final plan review.
2. Read the final review verdict from `./docs/plans/<plan-slug>/tasks/review.md`.
3. If the verdict is `Request changes`: report the findings — do not mark the plan complete.
4. If the verdict is `Approve` or `Approve with comments`: proceed to Step 4.

### Step 4: Capture learnings and close

After final sign-off passes and before marking the plan complete:

1. **Capture learnings (all projects):** Invoke the `evolve` skill to capture session observations — what patterns emerged, what worked, what didn't, what decisions were made. This feeds into the agent learning pipeline.

2. **Sync project state (all projects):** Invoke the `state-sync` skill to update knowledge management systems and relational documentation to reflect architecture changes, new modules, or configuration changes made during this plan.

3. **Generate documentation (software projects only):** Invoke the `dh-create-documentation` skill to generate or update API references, architecture overviews, READMEs, or other technical docs based on the sub-task implementation.

4. **Version bump (software projects only):** Invoke the `semver` skill to determine the correct version bump from commit history, generate a changelog, and create a git tag.

5. **Mark plan complete** in `./docs/plans/index.md`:
   - Locate the row for `<plan-slug>` and update the Status to `Completed` and Updated timestamp columns. If the slug is not found, append a new row.
   - Set the plan status to `Completed`.

6. Report the plan completion with a summary:
   - Total sub-tasks completed
   - Final review verdict
   - Any deferred P2/P3 findings
   - Documentation generated (yes/no — details)
   - Version bump (if applicable)
   - Learnings captured (yes/no)
   - Plan ready for merge

## Resume Mode

The execution loop automatically handles interruptions:

- Step 2.0 explicitly marks the current sub-task as `In Progress` before delegating to `dh-execute-plan-task`. If the tool is interrupted, the next invocation reads the plan and finds this `In Progress` sub-task.
- Resume from Step 1, which detects the phase-aware state (priority 2: first `In Progress` phase → its first `In Progress`/`Pending` sub-task) and continues the loop from there.
- If interruption occurs after review but before the `Completed` mark, the sub-task remains `In Progress` on resume — re-run the review to verify before marking Complete.

## Error Handling

- **Sub-task execution fails** (validation keeps failing): `dh-execute-plan-task` stops after 3 validation attempts and reports the failure. Do not proceed to the next sub-task — the blocked sub-task blocks its phase (loop rule 2.4: never mark the phase `Completed` around a blocker).
- **Review produces blocking findings**: Stop the execution loop. Recommend fixing the findings (using the `address-review` pattern) and re-running `dh-execute-plan`.
- **Final review fails**: Report the verdict — do not mark the plan complete until findings are addressed.

## Loop Integration (bundled)

This copy is bundled in the plugin; the loop below is the harness runtime
contract (full text in repo-root AGENTS.md). Plan execution follows it in
order — do not skip steps and never silently continue past a blocker:

1. `dh-planning` (use `dh-domain-check` while planning)
2. `dh-execute-plan`
   2.1 `dh-execute-plan-task` (delegate code implementation through the `dh-coding` skill)
   2.2 `dh-simplify`
   2.3 `dh-review` + `dh-code-review`
   2.4 IF hard blockers → stop and ask guidance; otherwise keep the `dh-execute-plan-task` loop
3. `dh-preflight` + `dh-artifact-check`
4. `dh-final-review`
5. `dh-create-documentation`

**Step 2.4 halts automation.** When `dh-execute-plan-task` (or any loop step)
hits a hard blocker — repeated validation failures (3 consecutive strikes),
unresolved P0/P1 review findings, or missing preconditions that cannot be
worked around — the loop STOPS: report the blocker and ask the user for
guidance. Never silently continue, never skip the blocked step, and never mark
sub-tasks Complete around a blocker. The rule applies at phase boundaries
too: a blocked sub-task blocks its phase — do not mark the phase `Completed`
around a blocker.

## References

- `dh-execute-plan-task` skill: executes a single sub-task.
- `dh-review` skill: verifies a single sub-task result.
- `dh-final-review` skill: produces plan-level sign-off.
- `dh-create-documentation` skill: generates docs after plan completion (software projects only).

## Doc search

- **Documentation management:** delegate create / update / delete / retrieve
  of generated documents (excluding docs/plans) to `@dh-documentor` — the
  main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"`
or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
Convention: AGENTS.md → Generated documentation search.

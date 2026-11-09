---
name: dh-execute-plan-task
description: >
  Execute a single sub-task from plan.md: select the active one (In Progress phase first), resolve its `Delegated to agent`, implement (TDD), validate via dh-execute-cli, update status; project-type aware. Use for the next sub-task or continuing work — not orchestration.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, edit, bash
metadata:
  audience: developers
  workflow: development
---

Execute one self-contained sub-task from `./docs/plans/<plan-slug>/plan.md`.

## Core Rules

- Read the plan with the `dh_plan_read` tool (`{ slug }` → structured JSON: meta, phases[].title/status, subTasks[].phase/title/status) to find the active sub-task. Fallback when the tool is unavailable: read `./docs/plans/<plan-slug>/plan.md` manually, following the phased template markers (`## Phases` → `### Phase N: <title>` → `#### Sub-Task N.M: <title>` with `- **Status:**` bullets). If the plan does not exist, stop and report that no plan was found — suggest running the `dh-planning` skill first. These tools are exposed by the project-scope `dh` MCP server; under Code Mode they are called as `tools.dh.<tool>`, and `dh_<tool>` is the tool's normalized name (permission actions match `dh_*`).
- Treat the sub-task entry in plan.md as the full implementation brief.
- **Resolve the sub-task's delegated agent:** read `delegatedTo` from `dh_plan_read` for the active sub-task. It must name an agent recorded in `## Agent Selection`. If the field is missing, empty, or points to an unknown/unavailable agent, STOP and report the gap — never execute the sub-task or substitute an agent silently.
- **One responsible agent per sub-task:** the `Delegated to agent` value is the single executor for that sub-task. Implementation work normally names the selected implementation agent; documentation or test-only sub-tasks may name the documentation or testing/QA agent. There is no complexity- or type-based builder split.
- **Review stays separate:** resolve the review agent from `## Agent Selection`; the delegated agent does not review its own work.
- **Detect project type** before the post-steps: it determines whether `dh-domain-check`, `dh-simplify`, and `dh-create-documentation` run (software projects only) — it does NOT change who implements.
- For **software projects**: run `dh-domain-check` before complex implementation, `dh-simplify` after validation, and `dh-create-documentation` for new modules/APIs.
- For **non-software projects**: skip the `dh-simplify`, `dh-domain-check`, and `dh-create-documentation` steps entirely; implementation still goes to the sub-task's delegated agent.
- Use the `dh-execute-cli` skill for tests, linters, and builds.
- Delegate review to the plan's selected review agent for code quality and acceptance criteria checks.
- Do not modify files outside the sub-task scope.
- Update the sub-task status only after review passes — via `dh_plan_update_status` (`target: "subtask"`, status `Completed`); fallback: manual plan.md edit per the marker rules.
- If the sub-task has dependencies on earlier sub-tasks, verify they are Completed before starting.

## Project Type Detection

Check the project root for software marker files to determine project type. This must be done before any agent delegation.

**Software project markers** (any of these files present in project root):
`package.json`, `pyproject.toml`, `Cargo.toml`, `composer.json`, `go.mod`, `CMakeLists.txt`, `setup.py`, `setup.cfg`, `Gemfile`, `project.clj`, `deps.edn`, `mix.exs`, `pubspec.yaml`, `Build.scala`, `build.gradle`, `*.csproj`, `*.sln`

**Detection logic:**
1. Run `ls <project-root>/` and check for any of the marker files above.
2. If a marker file is found → **software project** (run `dh-domain-check` before complex implementation, `dh-simplify` after validation, `dh-create-documentation` for new modules/APIs).
3. If no marker files found → **non-software project** (skip `dh-domain-check`, `dh-simplify`, and `dh-create-documentation`).
4. If uncertain (e.g., a `Makefile` with no other code), check for source code directories (`src/`, `lib/`, `app/`) as secondary indicators.

Delegation is IDENTICAL for both types: **every sub-task is executed by its
`Delegated to agent`** (normally the selected implementation agent).

> **Why this matters:** Non-software projects (docs repos, config repos, design assets) don't benefit from architecture/engineering agents or code-level simplification. Using the wrong agent type wastes context and produces irrelevant findings.

## Workflow

### Step 0: Resolve the delegated agent

Read `## Agent Selection` in `plan.md` and confirm the sub-task's `Delegated to agent` names one of its agents. If the section or the field is absent, empty, or stale, STOP and ask the planner/user to fix the plan — do not run the selection protocol as a substitute for the missing field. If the named agent is unavailable and no bundled capability covers the role, stop and report the gap.

### Step 1: Select the active sub-task

Read the plan with the `dh_plan_read` tool (`{ slug }`) and find exactly one sub-task using this phase-aware order. Fallback when the tool is unavailable: read `./docs/plans/<plan-slug>/plan.md` manually per the marker rules:

1. Pick the FIRST phase marked `In Progress`; within it, pick its FIRST sub-task marked `In Progress` or `Pending`. If that sub-task is already `In Progress` (set by the orchestrator), skip marking and proceed directly to implementation.
2. If no phase is `In Progress`, take the first sub-task of the first `Pending` phase and mark it `In Progress` via `dh_plan_update_status` (`target: "subtask"`, status `In Progress`) — the phase follows the lifecycle (it becomes `In Progress` when its first sub-task starts). Fallback: manual plan.md edit per the marker rules.
3. If multiple phases are `In Progress`, or multiple sub-tasks within the active phase are `In Progress`, stop and ask which to continue.
4. If no `In Progress` or `Pending` sub-tasks remain, report that the plan has no remaining work.

### Step 2: Implement the sub-task

Follow the sub-task's instructions, in-scope list, and implementation suggestions. **The sub-task's `Delegated to agent` is the single responsible executor**:

- Delegate the FULL sub-task brief to that agent — for complex work (multi-file, architectural decisions, new modules), run the `dh-domain-check` skill first and include its findings in the delegation. When the project graph is indexed, use `dh-code-query` on the affected symbols (`definition`, `callers`, `importers`, `tests-reaching`) to include impact and test evidence in the brief.
- Route implementation work through the `dh-coding` skill inside that agent's pass (test-first TDD; `CODE_RULES.md` at project root when present).
- Route documentation sub-tasks through `dh-create-documentation` and test-only work through the project's testing guidance, still under the named agent.
- **TDD**: the failing test is written first, then the minimal change to make it pass — performed inside the delegated agent's pass.
- Do NOT implement sub-task work directly and do NOT seek another builder: the `Delegated to agent` is the only executor for this sub-task.

**General rules:**
- Stay within the sub-task's in-scope boundaries. Do not widen scope.
- Never mark a phase `Completed` yourself while any sub-task in it is still open (phase coordination belongs to the orchestrator or the gated tool).

### Step 3: Run validation

Use the `dh-execute-cli` skill to run the smallest relevant validation for the changed code:

- Run tests related to the changed files.
- Run linters and static analysis.
- Fix any failures before proceeding. If validation fails 3 consecutive times, stop and report the failure with full error output — do not proceed to review.

When stopping on a hard blocker, recommend `dh-pause-plan` so the phase/sub-task, git state, decisions, and next steps are preserved in `handoff.md` before the session ends.

### Step 3a: Simplify code (software projects only)

**For software projects only** — after validation passes and before requesting review:

Run the `dh-simplify` skill to review all changed code for reuse opportunities, quality issues, and efficiency improvements. This ensures code is clean before it reaches review.

1. Invoke the `dh-simplify` skill with the full diff context from the sub-task implementation.
2. Wait for all three simplify agents (code reuse, quality, efficiency) to report findings.
3. Fix all P0/P1 issues found by simplify. For P2/P3 findings, use judgment — fix if meaningful, defer if low impact.
4. If fixes were made, re-run validation via the `dh-execute-cli` skill to ensure nothing broke.
5. **For non-software projects:** skip this entire step — the `dh-simplify` skill is code-focused and would produce irrelevant findings.

### Step 3b: Generate documentation (software projects only)

**For software projects only** — after `dh-simplify` and before requesting review:

Run the `dh-create-documentation` skill to generate or update API references, module docs, architecture overviews, or any documentation relevant to the new or changed code.

1. If the sub-task introduces new modules, APIs, public interfaces, or configuration schemas, invoke `dh-create-documentation` to produce the corresponding docs.
2. If the sub-task modifies existing documented interfaces, update the related documentation rather than creating from scratch.
3. If the sub-task has no public-facing changes (e.g., internal refactors, bug fixes), skip this step.
4. **For non-software projects:** skip this entire step — documentation needs for config/docs repos are handled differently.

### Step 4: Request review

(Orchestration note) When invoked from `dh-execute-plan` orchestrator, skip this step — the orchestrator runs the `dh-review` skill after this sub-task completes. When invoked standalone, ask the plan's selected review agent to review the changes against the active sub-task's acceptance criteria, scope boundaries, and done-when conditions. The reviewer writes findings to `./docs/plans/<plan-slug>/tasks/review.md`.

### Step 5: Address review feedback

Read the review and address findings:

- For P0/P1 (blocking/high): fix immediately, then proceed to Step 5a.
- For P2/P3: use judgment — fix if meaningful, defer if low impact.
- After fixes, re-run the relevant validation with the `dh-execute-cli` skill.
- Update `./docs/plans/<plan-slug>/tasks/review.md` marking each finding as `Addressed` or `Not Addressed` with a brief rationale.
- If re-validation fails 2 additional times after initial fixes, stop and report the failure with full error output — do not proceed; recommend `dh-pause-plan` to preserve state in `handoff.md` (resume with `dh-resume-plan`).

### Step 5a: Confirm review resolution

- If the reviewer approved (no outstanding P0/P1 findings), proceed to Step 6.
- If P0/P1 findings remain unaddressed, fix them and request a re-review from the selected review agent (loop back to Step 4).
- If P0/P1 findings cannot be resolved in-session, recommend `dh-pause-plan` before stopping; do not mark the sub-task or phase `Completed`.
- If only P2/P3 findings remain and you have addressed or explicitly deferred them with rationale, proceed to Step 6.

### Step 6: Update plan status

1. (Orchestration note) When invoked from `dh-execute-plan` orchestrator, skip both status updates — the orchestrator marks Complete after its external review passes and handles sequencing. When invoked standalone, mark the current sub-task as `Completed` via `dh_plan_update_status` (`target: "subtask"`, status `Completed`); fallback: manual plan.md edit per the marker rules.
2. **Phase coordination:** after the sub-task is `Completed`, check whether ALL sub-tasks of its phase are now `Completed`. If so, tell the orchestrator (`dh-execute-plan`) that the phase is ready to close; when running standalone, close it via `dh_plan_update_status` (`target: "phase"`, status `Completed`). Never mark a phase `Completed` yourself while any sub-task in it is still open.
3. When standalone: if a next sub-task exists and is `Pending`, mark it as `In Progress`.
4. When standalone: update `./docs/plans/index.md` with the latest status if this was the final sub-task.

## Execution Delegation Guide

**Per-sub-task executor policy:** every sub-task is implemented by its
`Delegated to agent`. Implementation sub-tasks normally name the plan's
selected implementation agent; documentation, test-only, and similar
sub-tasks name the matching selected role. There is no builder split beyond
that explicit field.

| Work | Delegate to | Post-steps |
|---|---|---|
| Software (complex, architectural) | sub-task's `Delegated to agent` | `dh-domain-check` first, then `dh-simplify` + `dh-create-documentation` |
| Software (other) | sub-task's `Delegated to agent` | `dh-simplify` after validation |
| Non-software | sub-task's `Delegated to agent` | none (skip `dh-simplify`/`dh-domain-check`/`dh-create-documentation`) |

Validation always runs through the `dh-execute-cli` skill; review through the
plan's selected review agent.

## Loop Integration (bundled)

This copy is bundled in the plugin; the harness runtime contract (full loop
1–5) lives in repo-root AGENTS.md and in `dh-execute-plan`'s Loop Integration
section. Executing a sub-task sits inside loop step 2:

- 2.1 delegate code implementation through the `dh-coding` skill (software
  work); run `dh-domain-check` before complex implementation.
- 2.2 run `dh-simplify` after validation (software projects only).
- 2.3 `dh-review` + `dh-code-review` verify the sub-task before it is marked `Completed`.
- 2.4 **Hard blockers halt automation.** Repeated validation failures (3
  consecutive strikes), unresolved P0/P1 review findings, or missing
  preconditions that cannot be worked around → STOP: report the blocker and
  ask the user for guidance. Never silently continue, never skip the blocked
  step, and never mark sub-tasks `Completed` around a blocker. A blocked
  sub-task also blocks its phase — do not mark the phase `Completed` around a
  blocker. Before stopping for a hard blocker or ending the session, run
  `dh-pause-plan` to preserve the phase/sub-task, git state, decisions,
  blockers, and next steps in `handoff.md`; resume later with `dh-resume-plan`.

## References

- Fast variant: `dh-execute-plan-task-fast` executes one sub-task from `plan_fast.md` with dual-plan status writes, per-task skipped-check rows, and no per-task gates.
- [`../dh-planning/references/agent-selection.md`](../dh-planning/references/agent-selection.md): capability→agent resolution (discovery, ranking, fallback, re-validation).
- `dh-execute-cli` skill: runs commands, tests, linters, and builds with logged, compact output.
- `dh-domain-check` skill: validates architecture against DDD bounded contexts and SOLID principles before complex implementation (software projects only).
- `dh-simplify` skill: reviews changed code for reuse, quality, and efficiency after validation (software projects only).
- `dh-create-documentation` skill: generates docs for new modules, APIs, and interfaces after simplify (software projects only).

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).

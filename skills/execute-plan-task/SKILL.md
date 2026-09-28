---
name: execute-plan-task
description: >
  Execute a single sub-task from a plan — select the active sub-task (In
  Progress or first Pending) from plan.md, implement it following TDD with
  project-type-aware agent delegation (domain-check before complex
  implementation, simplify after validation, and create-documentation for new
  modules/APIs on software projects), run validation via @executor, request
  review, handle feedback with fix loops, and update plan status. Use when
  implementing the next sub-task from plan.md, continuing an in-progress
  sub-task, or when the user says 'execute next task', 'implement sub-task',
  'work on the plan', or 'next step' — not for full plan orchestration (use
  execute-plan) or ad-hoc work without a plan.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, edit, bash
metadata:
  audience: developers
  workflow: development
---

Execute one self-contained sub-task from `./docs/plans/<plan-slug>/plan.md`.

## Core Rules

- Read `./docs/plans/<plan-slug>/plan.md` to find the active sub-task. If the file does not exist, stop and report that no plan was found — suggest running the `planning` skill first.
- Treat the sub-task entry in plan.md as the full implementation brief.
- **Detect project type** before agent delegation: check for software marker files (see below). This determines which builder agent to use and whether to run the `simplify` step.
- For **software projects**: delegate to `@software-engineer` for complex/multi-file implementation, `@build` for standard changes. Run `domain-check` before complex implementation, `simplify` after validation, and `create-documentation` for new modules/APIs.
- For **non-software projects**: delegate to `@build` for all implementation — do NOT use `@software-architect`. Skip the `simplify`, `domain-check`, and `create-documentation` steps entirely.
- Delegate validation to `@executor` for tests, linters, and builds.
- Delegate review to `@reviewer` for code quality and acceptance criteria checks.
- Do not modify files outside the sub-task scope.
- Update plan.md status only after review passes.
- If the sub-task has dependencies on earlier sub-tasks, verify they are Completed before starting.

## Project Type Detection

Check the project root for software marker files to determine project type. This must be done before any agent delegation.

**Software project markers** (any of these files present in project root):
`package.json`, `pyproject.toml`, `Cargo.toml`, `composer.json`, `go.mod`, `CMakeLists.txt`, `setup.py`, `setup.cfg`, `Gemfile`, `project.clj`, `deps.edn`, `mix.exs`, `pubspec.yaml`, `Build.scala`, `build.gradle`, `*.csproj`, `*.sln`

**Detection logic:**
1. Run `ls <project-root>/` and check for any of the marker files above.
2. If a marker file is found → **software project** (use `@software-engineer` for complex work, run `domain-check` before complex implementation, `simplify` after validation, `create-documentation` for new modules/APIs).
3. If no marker files found → **non-software project** (use `@build` for all work, skip `domain-check`, `simplify`, and `create-documentation`).
4. If uncertain (e.g., a `Makefile` with no other code), check for source code directories (`src/`, `lib/`, `app/`) as secondary indicators.

> **Why this matters:** Non-software projects (docs repos, config repos, design assets) don't benefit from architecture/engineering agents or code-level simplification. Using the wrong agent type wastes context and produces irrelevant findings.

## Workflow

### Step 1: Select the active sub-task

Read `./docs/plans/<plan-slug>/plan.md` and find exactly one sub-task using this order:

1. Continue the single sub-task marked `In Progress`. If the sub-task is already `In Progress` (set by the orchestrator), skip marking and proceed directly to implementation.
2. Otherwise take the first sub-task marked `Pending` and mark it `In Progress`.
3. If multiple are `In Progress`, stop and ask which to continue.
4. If no `In Progress` or `Pending` sub-tasks remain, report that the plan has no remaining work.

### Step 2: Implement the sub-task

Follow the sub-task's instructions, in-scope list, and implementation suggestions. **Agent selection depends on project type** (detected above):

**For software projects:**
- **Complex work** (multi-file, architectural decisions, new modules): first run the `domain-check` skill to validate the proposed architecture against DDD bounded contexts and SOLID principles, then delegate to `@software-engineer` with the full sub-task brief plus domain-check findings.
- **Standard work** (1–3 files, straightforward logic, existing patterns): delegate to `@build`.
- **Simple work** (single file, <50 lines changed, no new dependencies): implement directly.
- **TDD**: write a failing test first, then implement the minimal change to make it pass.

**For non-software projects:**
- All work: delegate to `@build` as the primary builder agent.
- Do NOT use `@software-engineer` or `@software-architect` — these agents are designed for software code and will produce irrelevant or overly complex output for docs/config/design work.
- Simple changes (single file, <50 lines) can be implemented directly without delegation.

**General rules (both types):**
- Stay within the sub-task's in-scope boundaries. Do not widen scope.

### Step 3: Run validation

Ask `@executor` to run the smallest relevant validation for the changed code:

- Run tests related to the changed files.
- Run linters and static analysis.
- Fix any failures before proceeding. If validation fails 3 consecutive times, stop and report the failure with full error output — do not proceed to review.

### Step 3a: Simplify code (software projects only)

**For software projects only** — after validation passes and before requesting review:

Run the `simplify` skill to review all changed code for reuse opportunities, quality issues, and efficiency improvements. This ensures code is clean before it reaches review.

1. Invoke the `simplify` skill with the full diff context from the sub-task implementation.
2. Wait for all three simplify agents (code reuse, quality, efficiency) to report findings.
3. Fix all P0/P1 issues found by simplify. For P2/P3 findings, use judgment — fix if meaningful, defer if low impact.
4. If fixes were made, re-run validation via `@executor` to ensure nothing broke.
5. **For non-software projects:** skip this entire step — the `simplify` skill is code-focused and would produce irrelevant findings.

### Step 3b: Generate documentation (software projects only)

**For software projects only** — after `simplify` and before requesting review:

Run the `create-documentation` skill to generate or update API references, module docs, architecture overviews, or any documentation relevant to the new or changed code.

1. If the sub-task introduces new modules, APIs, public interfaces, or configuration schemas, invoke `create-documentation` to produce the corresponding docs.
2. If the sub-task modifies existing documented interfaces, update the related documentation rather than creating from scratch.
3. If the sub-task has no public-facing changes (e.g., internal refactors, bug fixes), skip this step.
4. **For non-software projects:** skip this entire step — documentation needs for config/docs repos are handled differently.

### Step 4: Request review

(Orchestration note) When invoked from `execute-plan` orchestrator, skip this step — the orchestrator runs the `review` skill after this sub-task completes. When invoked standalone, ask `@reviewer` to review the changes against the active sub-task's acceptance criteria, scope boundaries, and done-when conditions. The reviewer writes findings to `./docs/plans/<plan-slug>/tasks/review.md`.

### Step 5: Address review feedback

Read the review and address findings:

- For P0/P1 (blocking/high): fix immediately, then proceed to Step 5a.
- For P2/P3: use judgment — fix if meaningful, defer if low impact.
- After fixes, ask `@executor` to re-run the relevant validation.
- Update `./docs/plans/<plan-slug>/tasks/review.md` marking each finding as `Addressed` or `Not Addressed` with a brief rationale.
- If re-validation fails 2 additional times after initial fixes, stop and report the failure with full error output — do not proceed.

### Step 5a: Confirm review resolution

- If the reviewer approved (no outstanding P0/P1 findings), proceed to Step 6.
- If P0/P1 findings remain unaddressed, fix them and request a re-review from `@reviewer` (loop back to Step 4).
- If only P2/P3 findings remain and you have addressed or explicitly deferred them with rationale, proceed to Step 6.

### Step 6: Update plan status

1. (Orchestration note) When invoked from `execute-plan` orchestrator, skip both status updates — the orchestrator marks Complete after its external review passes and handles sequencing. When invoked standalone, mark the current sub-task as `Completed` in plan.md.
2. When standalone: if a next sub-task exists and is `Pending`, mark it as `In Progress`.
3. When standalone: update `./docs/plans/index.md` with the latest status if this was the final sub-task.

## Complexity Assessment Guide

### Software Projects

| Complexity | Signs | Delegate to |
|---|---|---|
| Simple | Single file, <50 lines changed, no new dependencies | Implement directly |
| Standard | 1–3 files, straightforward logic, existing patterns | `@build` |
| Complex | 4+ files, architectural decisions, new modules, migrations | `@software-engineer` |
| High-risk | Security, data migration, breaking API changes | `@software-engineer` + `@reviewer` |

### Non-Software Projects

| Complexity | Signs | Delegate to |
|---|---|---|
| Simple | Single file, <50 lines changed | Implement directly |
| All other | Any multi-file or multi-step change | `@build` |
| **Do not use** | — | `@software-engineer`, `@software-architect` |

## References

- `domain-check` skill: `~/.agents/skills/domain-check/SKILL.md` — validates architecture against DDD bounded contexts and SOLID principles before complex implementation (software projects only).
- `simplify` skill: `~/.agents/skills/simplify/SKILL.md` — reviews changed code for reuse, quality, and efficiency after validation (software projects only).
- `create-documentation` skill: `~/.agents/skills/create-documentation/SKILL.md` — generates docs for new modules, APIs, and interfaces after simplify (software projects only).
- `next-subtask.md` command: `~/.agents/commands/next-subtask.md` — the execution pattern this skill formalizes.
- `address-review.md` command: `~/.agents/commands/address-review.md` — the review feedback loop pattern.
- `review-subtask.md` command: `~/.agents/commands/review-subtask.md` — the scoped review pattern.

## Loop Integration (bundled)

Full loop 1–5 lives in the repo-root `AGENTS.md` and in `execute-plan`'s
Loop Integration section. Key binding rules for this skill:

- **2.1 — implementation via `coding`:** for software work, delegate code
  implementation through the `coding` skill (test-first, CODE_RULES.md
  aware); heavy work goes to `@software-engineer`.
- **domain-check gate:** run `domain-check` before complex/multi-file
  implementation (loop step 1 at sub-task granularity).
- **2.2 — `simplify`:** after validation, run `simplify` (software only).
- **2.3 — `review` + `code-review`:** request review through `review`
  (acceptance criteria, scope, done-when) and `code-review` (code quality),
  delegating the deep review to `@reviewer`.
- **2.4 — Hard blockers stop the loop:** 3 consecutive validation failures,
  unresolved P0/P1 review findings, or missing preconditions → STOP, report,
  and ask the user for guidance; do NOT silently continue or mark the
  sub-task Complete around a blocker.
- **Agent names:** delegation references resolve via the manifest mapping in
  the repo `AGENTS.md` — `@build`/`@senior-engineer` →
  `@software-engineer`, `@senior-architect`/`@plan` →
  `@software-architect`; `@reviewer`, `@final-reviewer`, `@executor`,
  `@explorer` unchanged.

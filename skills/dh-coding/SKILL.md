---
name: dh-coding
description: >
  Apply TDD coding best practices when implementing, writing, or fixing code —
  write a failing test first, implement the minimal change to make it pass,
  then refactor, running validation via @dh-executor and stopping after 3
  consecutive failures. Read and enforce project-specific rules from
  CODE_RULES.md at the project root when present, falling back to the harness
  global coding guidelines by convention otherwise, and stay project type
  aware (software vs non-software, uv/pnpm/npm/poetry toolchains) when
  delegating and implementing. Use when asked to implement, write code, or fix
  a bug, or during execute-plan-task sub-task 2.1 of the skills loop — not for
  plan orchestration (use execute-plan) or review-only requests (use review).
license: MIT
compatibility: opencode
allowed-tools: read, write, edit, bash
metadata:
  audience: developers
  workflow: development
---

Apply test-first TDD and clean code best practices when implementing or fixing code, honoring project-specific rules from `CODE_RULES.md` at the project root when present, and defaulting to the harness global coding guidelines by convention otherwise.

## Core Rules

- **Test-first, always:** write a failing test before any implementation; then implement the minimal change that makes it pass; then refactor. Repeat the red → green → refactor loop until the change is complete.
- **Rules precedence:** `CODE_RULES.md` at the project root overrides generic defaults for naming, structure, and style; the harness global coding guidelines apply everywhere else.
- **Project type aware:** detect software vs non-software before choosing how to implement and which builder agent to delegate to.
- **Validation through `@dh-executor`:** never run bash, tests, or builds directly — delegate to `@dh-executor` and act on its summarized output.
- **Tight scope:** change only what the active sub-task requires; do not add extra features, abstractions, or refactors beyond the task.
- **Stop on repeated failure:** if validation fails 3 consecutive times, stop and report the failure with full error output — do not loop indefinitely or proceed to review.
- **Never capture secrets:** no secrets, tokens, API keys, or credentials in code, logs, tests, comments, or output.

## CODE_RULES.md Resolution Order

1. **If `CODE_RULES.md` exists at the project root:** read it before touching any code and treat it as the primary rule set for this project — it overrides generic defaults for naming, structure, and style. Enforce it for every file you create or modify.
2. **If `CODE_RULES.md` is absent:** fall back to the harness global coding guidelines by convention — correct, secure, simple, maintainable code; match existing project patterns and tooling; change only what is needed; keep changes tightly scoped. Do not invent project rules that are not documented anywhere.
3. **Regardless of which rules apply:** always work test-first. Project rules refine *how* you code, never *whether* you test.

> Convention note: the harness global coding guideline lives at `~/.agents/prompts/coding-guideline.md` (the source of the principle above) and is not bundled with this plugin — state the principle, do not treat the file path as a local dependency.

## Test-First TDD Workflow

Follow the red → green → refactor loop for every behavioral change:

1. **Red:** write a failing test that captures the expected behavior. Run it via `@dh-executor` and confirm it fails for the right reason before implementing.
2. **Green:** implement the minimal change that makes the test pass. Do not add unrelated code.
3. **Refactor:** clean up the implementation and the test — keep them readable, focused, and deterministic — then re-run the tests to confirm still green.
4. **Validate:** run the smallest relevant validation for the change (tests, linter, typecheck, build) through `@dh-executor`.
5. **On failure:** fix the issue and re-run via `@dh-executor`. If validation fails 3 consecutive times, stop and report the full error output — do not proceed.

Cover happy paths, edge cases, and regressions relevant to the change; follow the project's existing test conventions and keep tests deterministic.

## Project Type Awareness

Detect the project type before delegating or implementing. Check the project root by listing it (the `read` tool on the root directory, or `ls` via `@dh-executor`):

- **Software project markers** (any present at the project root): `package.json`, `pyproject.toml`, `Cargo.toml`, `composer.json`, `go.mod`, `CMakeLists.txt`, `setup.py`, `setup.cfg`, `Gemfile`, `pubspec.yaml`, `build.gradle`, `*.csproj`, `*.sln`, and similar language build files.
- **Language/toolkit detection:** infer the stack and its tooling from the marker — for example `package.json` → npm/pnpm/bun, `pyproject.toml` → uv/poetry/pip, `Cargo.toml` → cargo, `composer.json` → composer. Use the project's own tooling and lockfiles; do not introduce a different package manager or toolchain.
- **Software projects:** delegate ALL implementation to `@senior-engineer` (bundled as `dh-software-engineer` — the harness's single task executor); run validation through `@dh-executor`. When invoked from the skills loop, `dh-domain-check` runs before complex implementation and `dh-simplify` runs after validation.
- **Non-software projects** (docs, config, design assets — no marker files): delegate implementation to `@senior-engineer` as well; skip the `dh-simplify`, `dh-domain-check`, and `dh-create-documentation` steps.

## Hard Constraints

- Files must stay under 300 lines (global rule).
- Follow SOLID and clean code practices: focused functions and modules, descriptive names, no duplicated logic.
- Keep changes tightly scoped to the active sub-task.
- Never expose secrets, tokens, or credentials in code, logs, or output.
- Run all bash commands, tests, and builds through `@dh-executor`.

## When to Use

- Asked to implement, write, or update code; fix a bug; or add a test.
- Delegated from `dh-execute-plan-task` as sub-task 2.1 of the skills loop for software work.
- Asked to apply TDD, clean code, or coding best practices to a change.

## When Not to Use

- Plan orchestration — use `dh-execute-plan`.
- Review-only requests — use `dh-review` / `dh-code-review`.
- Architecture validation — use `dh-domain-check`.
- Documentation writing — use `dh-create-documentation`.

## References

- `dh-execute-plan-task` skill: the loop entry point that delegates implementation work to this skill (loop 2.1).
- Loop steps after implementation: `dh-simplify` after validation, then `dh-review` + `dh-code-review` (software projects).
- Harness global coding guideline convention: see CODE_RULES.md Resolution Order above.
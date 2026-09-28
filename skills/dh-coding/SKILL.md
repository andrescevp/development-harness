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
  delegating and implementing. Also applies performance directives
  (webservices, data operations, scripting), security directives
  (webservices, pipelines), and setup best practices. Use when asked to
  implement, write code, or fix a bug, or during execute-plan-task sub-task
  2.1 of the skills loop — not for plan orchestration (use execute-plan) or
  review-only requests (use review).
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

## Coding Best Practices

Everyday coding-quality guidance, applied to every change alongside TDD:

- **Clarity over cleverness:** write code a junior engineer can follow — explicit, readable, and direct. Prefer the simplest approach that fully solves the task; do not add premature abstractions or speculative generality.
- **Naming:** use descriptive, intent-revealing names and language-standard conventions; booleans read as predicates (`isValid`, `hasPermission`); no cryptic abbreviations.
- **Structure:** keep functions and modules focused on one responsibility; extract helpers only when they remove real duplication; keep related code close; no dead code (remove unused branches/exports — knip-style checks).
- **Inputs and errors:** validate inputs at boundaries and fail with clear, actionable errors; handle every expected failure mode explicitly — never silently swallow errors or hide them in empty catches; propagate errors with context (what failed, what was attempted).
- **Determinism and testability:** prefer pure functions and explicit inputs; avoid hidden global state, implicit timing, or environment-dependent behavior; make behavior reproducible in tests.
- **Consistency:** match the project's existing patterns, naming, architecture, and tooling; follow `CODE_RULES.md` and the project's configured linters/formatters (biome, etc.) — do not introduce a parallel style.
- **DRY with judgment:** no duplicated logic (jscpd-style checks), but never DRY at the cost of clarity — two clear occurrences beat one obscure abstraction.
- **Type discipline:** prefer explicit typed contracts over loose `any`; keep public interfaces stable unless the task requires a change; model the domain in the types.
- **Comments:** prefer comments on *why* (decisions, constraints, gotchas); avoid restating *what* the code already shows; keep comments accurate when code changes.
- **Documentation-adjacent:** when a change affects setup, behavior, or interfaces, note it in the project docs (README/AGENTS.md) as part of the change.

## Hard Constraints

- **The 300-line limit applies ONLY to code files** (source and test files).
  Documentation, configuration, and markdown are exempt; skill files follow
  the ≤ 250-line convention.
- Follow SOLID and clean code practices: focused functions and modules, descriptive names, no duplicated logic.
- Keep changes tightly scoped to the active sub-task.
- Never expose secrets, tokens, or credentials in code, logs, or output.
- Run all bash commands, tests, and builds through `@dh-executor`.

## Performance Directives

Apply where the change touches these areas:

- **Webservices (APIs, servers, HTTP handlers):** keep request handlers lean — no blocking or CPU-heavy work in the hot path; offload work that does not need to block the response. Use non-blocking/async I/O for network, DB, and files. Paginate list endpoints and batch instead of per-item calls. Cache expensive reads when invalidation is understood (bounded TTLs; never cache per-user sensitive data in shared caches without proper keying/encryption). Reuse connections (pooling, keep-alive) with bounded timeouts and retries/backoff. Avoid N+1: fetch related data in one query or round-trip. Stream large payloads and compress responses (gzip/br). Bound concurrency and apply backpressure instead of unbounded queues.
- **Data operations (databases, files, bulk processing):** prefer set-based/bulk operations over row-by-row loops (batch inserts/updates). Use indexes on filter/join/sort columns and explain/analyze slow queries. Paginate or stream large result sets — never load whole tables into memory. Keep transactions short and scoped; do not hold locks during slow I/O. Push aggregation into the database (GROUP BY/SUM/COUNT) instead of pulling rows and reducing client-side. Process data in chunks/streams (memory-bounded); validate and normalize data once at the boundary.
- **Scripting in general (CLI, batch scripts, automation):** batch commands and I/O — avoid repeated spawns and repeated reads of the same resource; reuse connections and parsed data. Stream where possible (pipes/`tail`/`awk`) instead of loading whole files into memory. Bound parallelism (`xargs -P`, worker pools) and handle per-item failures (continue with a clear exit code). Make scripts idempotent where sensible, use explicit exit codes, and follow the logged-command strategy for long output (log file + head/tail window). Clean up temp files and processes in ALL exit paths (`trap`/`finally`). Prefer built-ins over spawning new processes for simple transforms.

## Security Directives

Apply where the change touches these areas:

- **Webservices:** validate and sanitize ALL external input at the boundary (query, body, headers, files) — reject unexpected shapes, never trust client data. Enforce authentication AND authorization (ownership/roles/permissions) on every handler; fail closed. Prevent injection — parameterized queries, no string-built SQL/shell; encode output for the context (XSS-safe rendering); guard SSRF (validate URLs/hosts); protect state-changing cookie-based endpoints against CSRF. Deserialize safely — validate schemas, never `eval`/exec untrusted input, cap upload sizes and check file types. Never hardcode, log, or return secrets — read from env/secret store; run dependency scanners (osv) and security scanners (semgrep). Use TLS in production, set security headers (CSP, HSTS, X-Content-Type-Options), rate-limit auth endpoints, and return errors without leaking internals (no stack traces to clients).
- **Pipelines (CI/CD, build, deploy, automation):** inject secrets exclusively via the secret store/env — never in code, logs, artifacts, env files, or built images. Pin dependencies and toolchain versions (lockfiles, pinned base images, `.nvmrc`/`engines`); run dependency (osv) and code (semgrep) scans in the pipeline. Least privilege for runners and service accounts — no broad credentials committed anywhere. Keep builds reproducible and immutable; verify artifact integrity (digests/signatures) before deploy. Guard the pipeline itself — protected branches, required reviews, signed commits; never let untrusted PRs auto-run privileged steps without approval gates.

## Setup Best Practices

- **Reproducible environment:** commit lockfiles and pin the toolchain (`packageManager`, `engines`, `.nvmrc`/`.tool-versions`); provide a documented setup path (README or AGENTS.md) — nothing may depend on undocumented global state.
- **Project-local tooling:** use the project's own package manager and configs (linters, formatters, dependency checks, test runners) instead of ad-hoc global tools; keep per-project IDE settings in the repo.
- **Minimal dependency footprint:** add dependencies deliberately — prefer maintained, small, typed packages; remove unused ones (knip-style checks).
- **Configuration hygiene:** keep configs small and explicit; no magic values — typed env parsing with validation; commit `.env.example`, never `.env*`; real secrets never land in the repo.
- **Environment parity:** dev/test/CI/stage differ only by configuration, not code paths; no "works on my machine" — use containers when parity matters.
- **Verify on first run:** after setup (installs, configs), run the project's own gate (`qa:check`/lint/typecheck/build/tests) before writing feature code — the environment is part of the change.

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
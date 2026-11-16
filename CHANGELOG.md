# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
Semantic Versioning. During the 0.x line, breaking changes bump the minor
version.

## [Unreleased]

### Added

- **Parallel plan execution:** phases and sub-tasks may declare
  `Parallelizable` (`yes|no`) and `Depends on` (ids or `None`); sub-tasks also
  declare `Files/Scope` and `Isolation` (`shared|worktree`). Absent fields
  default to `no`/`None`/`None`/`shared`, so legacy plans keep their sequential
  behavior.
- Shared scheduler contract
  [`skills/dh-execute-plan/references/parallel-scheduler.md`](skills/dh-execute-plan/references/parallel-scheduler.md),
  linked by both orchestrators: dependency/cycle validation, ready-set
  computation, default **3** concurrent workers (hard cap **8**), multiple
  `In Progress` sub-tasks, review fan-in, failure drain, phase closure only when
  every sub-task is `Completed`, and resumable multi-active state.
- Parallel worker mode in `dh-execute-plan-task` and
  `dh-execute-plan-task-fast`: `parallel-worker` implements and validates one
  exact sub-task and returns
  `{ subTask, agent, status, filesChanged, validation, blockers, notes }`
  without writing plans, ledger rows, reviews, or commits.
- Hybrid isolation: disjoint declared scopes share the current worktree;
  overlapping scopes serialize or use `Isolation: worktree`; worktree branches
  integrate in dependency/plan order, conflicts block with the worktree
  preserved, and removal stays manual.
- `dh_plan_read` exposes the parallel metadata and `dh_plan_create` scaffolds it;
  the TUI renders multiple active sub-tasks (`Phase N · N.M +K`,
  `Active: N tasks`).

### Changed

- `dh-execute-plan` and `dh-execute-plan-fast` dispatch from the shared ready
  set instead of a fixed sub-task order; orchestrator-only status, ledger, and
  commit writes are unchanged.
- `dh-planning` teaches and validates parallel decomposition (safe defaults,
  dependency references, disjoint scopes, worktree isolation) in the plan
  template and scaffold.
- Bundle inventory is unchanged: 6 agents, 27 skills, 12 MCP tools, and the two
  native `execute` hooks.

## [0.10.0] — 2026-11-16

### Added

- Automatic TOON output for the `dh` MCP server: successful tool payloads
  whose serialized JSON is at least 256 characters and whose TOON form is
  strictly shorter are returned as TOON; every other payload (and every error
  result) stays JSON/plain text. `@toon-format/toon` 4.4.x is a runtime
  dependency, bundled into `dist/plugin.js` and `dist/mcp/stdio.js`.
- Native TOON compression and restoration: the plugin's `execute.after` hook
  compresses eligible completed tool output (default `bash`, overridable with
  `OPENCODE_TOON_PLUGIN_TOOLS`) and remembers the original JSON in a
  process-local 100-entry cache; `execute.before` restores JSON inside
  forwarded quoted strings and quoted-marker heredoc bodies (exact cache match first, strict
  TOON decode second).

### Changed

- MCP tool text is now JSON **or** TOON; payload semantics, tool names, tool
  inputs, error messages, and the 12-tool surface are unchanged. JSON remains
  canonical internally and on disk.
- The plugin now registers exactly two native `execute` tool hooks
  (`execute.after`, `execute.before`) alongside the 6 agents and 27 skills. It
  still registers no tools, commands, or prompts and performs no tool, command,
  or prompt transforms.

## [0.9.0] — 2026-11-16

### Added

- `dh-researcher`, the sixth bundled agent: answers one external-fact question
  per pass with primary sources, retrieval dates, and explicit confidence
  labels (`verified` / `partially verified` / `model knowledge`). It composes
  evidence and never edits code, runs project commands, or writes files.
- `dh-research`, the twenty-seventh bundled skill: the bounded research
  workflow, note template, note/registry contract, and the handoff that keeps
  persistence with the documentation agent. A plan-local research folder is
  rejected and redirected to the workspace registry.
- One workspace research registry: notes at `docs/research/<topic>.md` plus
  `docs/research/index.md` (newest first, one row per note), owned by
  `dh-documentor` via `dh-create-documentation`.
- Optional `## Research` plan section (outside `## Phases`) linking registry
  notes with `../../research/<topic>.md`; the fast mirror omits it on purpose.
- Optional execution unblock: `dh-execute-plan-task` and
  `dh-execute-plan-task-fast` may run one bounded, cited research pass before
  reporting a blocker that depends on current external facts, gated on
  browsing-tool availability. The hard-blocker halt is unchanged — research
  never authorizes continuing past an unresolved blocker.

### Changed

- Bundle inventory is now **6 agents + 27 skills** (33 unique names); tests,
  audit loop membership, CLI/package smoke expectations, and project docs
  reflect it.
- `dh-planning`, `dh-grill-sdd`, and `dh-contingency` delegate external-fact
  questions to `dh-research` and cite the resulting note; contingency rates
  alternatives only on verified facts, labelling missing evidence as an
  assumption instead of model recollection.

No new dependencies, tool/command/prompt registrations, or changes to the
hard-blocker policy.

## [0.8.0] — 2026-11-15

### Added

- **TUI plan progress** (`exports["./tui"]`, plugin
  `dev-harness-skills.tui`): a read-only TUI part loaded automatically beside
  the server part. A `sidebar.content` card shows the active plan, the
  `Phase N · N.M` position, completed/total sub-tasks with a text progress bar,
  the current sub-task's delegated agent, plan status and a one-line session
  activity; `/plan-progress` (palette entry "Plan progress") opens the
  `dev-harness-skills.plan` session panel with every phase/sub-task status and
  delegated agent, checklists, review verdict, fast-mode skipped-check ledger
  and last update (`f` fullscreen, `r` refresh, `Esc` close, `1`…`9` pin).
- TUI data layer and activity: a pure parser over the workspace `docs/plans`
  (active-plan selection, counts/current position, checklist/review/ledger
  derivation), a debounced watcher with a poll fallback, and an allowlisted
  session-activity mapper that never renders message bodies, tool I/O, provider
  errors or secrets. Read-only and local-first: nothing is written under
  `docs/plans`, and remote-server workspaces show the empty state.
- TUI packaging and installer support: `pnpm build` emits `dist/tui.js`
  (`@opentui/core`, `@opentui/solid` and `solid-js` are optional,
  host-provided peers), `package.json` exposes `exports["./tui"]`, and managed
  installs copy the TUI bundle and its export next to the unchanged server
  bundle.

### Changed

- `@opencode/plugin` aligned with the OpenCode host (`2.2.7`, was `2.0.20`);
  `@opencode/theme` follows the same version. The TUI surface used is identical;
  the server bundle and its smoke gates are unchanged.

Read-only and local-first; no breaking changes.

## [0.7.0] — 2026-11-15

### Added

- Workspace awareness across the harness (R1–R9): a normative workspace
  contract (workspace, package, plan and vault roots; start-at-workspace-root
  anchoring; `DH_WORKSPACE_ROOT`), `dh-setup` monorepo detection for
  pnpm/npm/yarn workspaces, Nx/Turbo/Lerna, Cargo workspaces, Go workspaces,
  Gradle/.NET solutions and `.gitmodules`, and a user-approved workspace map
  (`WORKSPACE.md`, fallback `docs/WORKSPACE.md`).
- Per-package preflight/artifact gates and package-scoped review/simplify diffs;
  root + package `CODE_RULES.md` inheritance; workspace/package docs roots;
  code-graph index routing; fixed/independent monorepo versioning;
  root/submodule worktree lifecycle discovery; package-aware pause/resume;
  workspace-first guidance in all 5 agents; monorepo fixtures plus anchor,
  parser and contract tests.
- Execution provenance: plans gain `## Execution Record` and the plans index a
  `## Execution Records` table, recording the real repository/path, mirrored
  plan path, summary and architectural changes (T1 write, T2 final-review
  check, T3 finalize).
- `dh-create-worktree` skill: create, reuse, merge, and remove worktrees from
  the project-owned `WORKTREE_LIFECYCLE.md` (before/after create, merge, and
  remove). A worktree may host different plans on the same branch at the user's
  request; the lifecycle file is generated and maintained only by `dh-setup`.

### Changed

- All 26 skills and 5 agents resolve the workspace map before acting, declare
  affected packages in `## Workspace Impact`, and report per-package results;
  `AGENTS.md`, `README.md`, `docs/LOADING.md` and `skills/index.md` document the
  workspace contract and link its references.
- `dh-planning`/`dh-grill-sdd` capture `## Workspace Impact`; the plan template
  adds `## Workspace Impact` and `## Execution Record` while legacy plans and
  the existing parser keep working.

Standalone repositories with no workspace markers keep the current single-root
behavior; there are no breaking changes.

## [0.6.0] — 2026-11-09

### Breaking Changes

- Phased plans now require `- **Delegated to agent:** <agent-id>` on every
  sub-task, and `dh_plan_create` requires `delegatedTo` for each sub-task.
  Legacy plans still parse (`delegatedTo: null`) but are not executable under
  the delegation contract until the field is added.

### Added

- `dh-code-query` skill: query the project code knowledge graph with
  code-graph-rag (`cgr`) — deterministic definitions/callers/callees/importers,
  dead-code and duplicate reports, graph export, and querying the optional
  read-only MCP server. Setup, indexing, and configuration stay in `dh-setup`.
- `dh-setup` installs `cgr` with `uv tool install` using the extras that cover
  the project's languages (`treesitter-full`, `ast-grep`, optional `cpp` /
  `semantic`), indexes the project with the embedded SQLite graph, and owns the
  configuration reference (`skills/dh-setup/references/code-graph-rag.md`).
- Phased plans now require `- **Delegated to agent:** <agent-id>` on every
  sub-task; `dh_plan_create` requires `delegatedTo`, `plan_read` exposes it, and
  standard/fast execution delegate to that specific agent (missing or
  unavailable agents halt execution).
- Code-graph guidance is wired into the skills that benefit from structural
  evidence: `dh-coding`, `dh-code-review`, `dh-planning`, `dh-explore`,
  `dh-domain-check`, `dh-contingency`, `dh-code-ruler`, `dh-simplify`,
  `dh-create-documentation`, `dh-mermaid`, `dh-review`, `dh-final-review`,
  `dh-preflight`, `dh-grill-sdd`, `dh-execute-plan-task`, and
  `dh-execute-plan-task-fast`.

## [0.5.1] — 2026-11-09

### Changed

- Build tooling migrated from tsup to tsdown (Rolldown): the three ESM
  artifacts keep the same names and self-containment (bundled
  `@opencode/plugin`, `yaml`, `jsonc-parser`; external `duckdb` and MCP SDK),
  declarations stay on `tsc --emitDeclarationOnly`, and each entry is built as
  a single self-contained file. Source/Git builds now require Node
  `^22.18.0 || ^24.11.0 || >=26`.

### Security

- Refresh OSV-flagged dependencies with pnpm overrides: `undici` ≥ 6.29.1 /
  8.12.2, `zod` ≥ 4.6.6 (now also the direct dependency floor), `glob` ≥
  14.0.2, `minimatch` ≥ 11.0.1, and `ip-address` ≥ 10.7.4. `scan:deps` is
  green again.

## [0.5.0] — 2026-11-08

First release of the standalone OpenCode V2 harness.

### Breaking Changes

- **MCP-only tools:** the plugin no longer registers OpenCode tools; all 12
  harness tools are served by the project-scope `dh` MCP server (`2356951`).
- **Utility agents removed:** `dh-executor` and `dh-explorer` are now the
  `dh-execute-cli` and `dh-explore` skills; agent files are deleted and all
  references use the skills (`5ffcd54`).
- **Capability-based delegation:** skills no longer hardcode `@dh-*` agents;
  they select the best available project agent and fall back to the bundled
  capability. Plans record choices in `## Agent Selection` (`5ffcd54`).
- **Evolution workflow:** external `evolve`/`state-sync` close-out steps were
  replaced by `dh-create-documentation` directives for evolution and
  observation notes (`cd37c99`).

### Features

- npx-installable CLI and npm packaging with global/project scopes, managed
  artifacts, JSONC-preserving config, and MCP-only wiring (`2d312c1`).
- Pause/resume plan lifecycle: `dh-pause-plan` writes a versioned
  `handoff.md`; `dh-resume-plan` validates, detects drift, rehydrates, and
  resumes; `dh-execute-plan` guards against paused handoffs (`701007d`).
- Fast plan execution: `dh-execute-plan-fast` and
  `dh-execute-plan-task-fast` use `plan_fast.md`, mirror statuses to both
  plans, record skipped checks in `plan_fast_skip_checks.md`, and run all
  critical gates once at plan end; five `dh_plan_fast_*` MCP tools (`79c2085`).
- `dh-mermaid` skill with 38 vendored Mermaid references and a plan-diagram
  contract for current state, desired state, critical changes, component
  graphs, and optional sequence/state/data/timeline diagrams (`c575d0c`).
- Agent-selection protocol and plan `## Agent Selection` table; project
  specialists take precedence over bundled fallbacks (`5ffcd54`).
- Evolution and observation notes under `docs/evolution/`, including the
  index and handoff-friendly links (`cd37c99`).
- `dh-planning` visual context: plans link Mermaid diagrams under
  `docs/plans/<slug>/diagrams/` (`c575d0c`).

### Fixes

- Packaging `prepare` now runs tsup directly and reliably (`ef87c61`).
- Handoff resume detects content-only worktree drift via
  `worktree_fingerprint`, including untracked directories and git-unavailable
  fallbacks (`2fa3ab3`).
- Plan-template, fast-plan, and audit consistency fixes for the 5-agent /
  24-skill inventory.

### Chores & Maintenance

- Inventory contract is **5 agents + 24 skills** (29 unique names) and
  **12 MCP tools**; installer, smoke, audit, and tests updated.
- Added the agent-selection contract test and the handoff/plan-fast contract
  tests.
- Refreshed `reports/audit.md`/`reports/audit.json` for the final inventory.
- Plan close-outs include the pause/resume, fast-plan, Mermaid, and
  agent-selection plans with evolution/observation notes.

[Unreleased]: https://github.com/andrescevp/development-harness/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/andrescevp/development-harness/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/andrescevp/development-harness/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/andrescevp/development-harness/releases/tag/v0.8.0
[0.7.0]: https://github.com/andrescevp/development-harness/releases/tag/v0.7.0
[0.6.0]: https://github.com/andrescevp/development-harness/releases/tag/v0.6.0
[0.5.1]: https://github.com/andrescevp/development-harness/releases/tag/v0.5.1
[0.5.0]: https://github.com/andrescevp/development-harness/releases/tag/v0.5.0

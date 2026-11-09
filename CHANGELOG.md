# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
Semantic Versioning. During the 0.x line, breaking changes bump the minor
version.

## [Unreleased]

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

[0.5.0]: https://github.com/andrescevp/development-harness/releases/tag/v0.5.0

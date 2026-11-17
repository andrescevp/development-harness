# dev-harness-skills

An [OpenCode](https://opencode.ai) V2 plugin that bundles an opinionated development harness for plan-driven development with 7 agents and 30 skills.

## Features

- **Plan-driven loop**: Automated 5-step engineering lifecycle covering planning, phased execution, review, verification, and documentation.
- **Phased plans**: Dual-status progress tracking across phases and sub-tasks, with every sub-task naming its responsible agent (`Delegated to agent`) and strict halt-on-blocker safeguards.
- **Parallel plan execution**: Opt-in `Parallelizable`, `Depends on`, `Files/Scope`, and `Isolation` metadata let a shared scheduler run ready work concurrently — 3 workers by default, hard cap 8 — with orchestrator-only status writes and hybrid shared/worktree isolation. Legacy plans stay sequential.
- **7 agents and 30 skills**: Purpose-built agents and skills operating via runtime delegation without bundled commands or prompts, plus two native `execute` hooks for TOON output.
- **Enterprise security**: `dh-security-auditor` + `dh-security-audit` / `dh-threat-model` / `dh-security-probe` cover full-application security, standards-based control review and authorized non-destructive probing for web, API, desktop, mobile and agentic/MCP systems. `dh-setup` writes the project security profile/standards selection.
- **Source-cited research**: `dh-researcher` + `dh-research` answer one external-fact question per pass with primary sources, retrieval dates, and confidence labels; notes live in one workspace registry at [`docs/research/index.md`](docs/research/index.md). An optional bounded pass may precede an execution-blocker report, but it never clears an unresolved blocker.
- **`dh` MCP server (12 tools)**: A project-scope local stdio MCP server serves `dh_plan_read`, `dh_plan_update_status`, `dh_plan_create`, `dh_plan_fast_create`, `dh_plan_fast_read`, `dh_plan_fast_update_status`, `dh_plan_fast_sync`, `dh_plan_fast_skip_check`, `dh_read_sheet`, `dh_update_sheet`, `dh_sheet_schema`, and `dh_logged_command` (Code Mode: `tools.dh.<tool>`). The plugin itself registers agents, skills, and the two TOON hooks; the tools come from the MCP server.
- **Automatic TOON output**: Successful `dh` MCP payloads are JSON, or TOON when the payload is an object/array whose JSON is at least 256 characters and TOON is strictly shorter. The two `execute` hooks compress eligible native `bash` JSON output (default `bash`; override with `OPENCODE_TOON_PLUGIN_TOOLS`) and restore JSON inside forwarded quoted strings and quoted-marker heredocs. JSON remains canonical on disk; errors stay plain text.
- **Code graph queries**: `dh-setup` installs code-graph-rag (`cgr`) on the embedded SQLite backend and indexes the project; `dh-code-query` answers structural questions — definitions, callers/callees, importers, dead code, duplicates — without scanning every file.
- **Full QA gate**: Thorough verification suite integrating Biome, Knip, jscpd, dependency-cruiser, OSV-Scanner, Semgrep, Vitest, and TypeScript.
- **Source-mode loading**: Automatic discovery by OpenCode via root `index.ts` with direct asset loading from the repository.

## Installation

### npx installer (recommended)

The installer materializes a self-contained plugin directory and wires the
`dh` MCP server for the selected scope:

```sh
# npm registry (after publication)
npx -y dev-harness-skills install --global
npx -y dev-harness-skills install --project --path .

# Git channel (available before publication / private use)
npx -y github:andrescevp/development-harness install --global
npx -y github:andrescevp/development-harness install --project --path .
```

| Scope | Plugin directory | MCP config |
|---|---|---|
| `--global` | `${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-~/.config}/opencode}/plugins/dev-harness-skills` | global `opencode.jsonc` |
| `--project` | `<project>/.opencode/plugins/dev-harness-skills` | `<project>/opencode.jsonc` |

- Re-running is idempotent; a newer CLI upgrades the managed copy.
- `--dry-run` reports intended changes; `--force` replaces an unmanaged target
  or a conflicting `dh` entry; `--no-mcp` skips config wiring.
- `status` reports plugin/config drift (`--json` for scripts);
  `uninstall` removes only installer-owned artifacts.
- A TTY prompts for global/project when no scope flag is given. Non-interactive
  runs must pass `--global` or `--project`; `--yes` never guesses a scope.
- **Restart OpenCode after installing** — plugins load at server startup.

```sh
npx -y dev-harness-skills status --global --json
npx -y dev-harness-skills uninstall --project --dry-run
```

### Managed via OpenCode CLI

`opencode plugin add` installs the plugin into OpenCode's **global**
configuration and does not wire MCP servers:

```sh
# npm registry (after publication)
opencode plugin add dev-harness-skills

# Git repository (available now; works with private repositories)
opencode plugin add github:andrescevp/development-harness
```

Then wire only the `dh` MCP entry (no second plugin copy):

```sh
npx -y dev-harness-skills install --global --mcp-only
# Git-wired installs:
npx -y dev-harness-skills install --global --mcp-only --mcp-source github
```

Choose one plugin channel: an `opencode plugin add` entry plus a managed copy
loads the plugin twice, and the CLI warns about it. To refresh a managed
plugin, `opencode plugin update`; remove it with `opencode plugin remove`.

### From source / development

Clone the repository, install dependencies, build the bundle (tsdown bundle + dist/assets), and configure OpenCode:

```sh
git clone https://github.com/andrescevp/development-harness.git
cd development-harness
pnpm install
pnpm build
```

The build toolchain (tsdown/Rolldown) requires Node `^22.18.0 || ^24.11.0 || >=26`;
the published plugin itself still runs on Node `>=20.11`.

Then load via `file:///path/to/development-harness` in your `opencode.json` or
`opencode.jsonc` plugins array (or clone the repo into a `plugins/` folder):

```json
{
  "plugins": [
    "file:///path/to/development-harness"
  ]
}
```

The plugin installation above loads the agents, skills, and the two TOON
`execute` hooks; the harness tools require the project-scope `mcp.servers.dh`
entry described in [MCP server (`dh`)](#mcp-server-dh). For a git-only checkout, run
`npx -y github:andrescevp/development-harness install --project --mcp-only`.

## Quickstart

1. Check that the plugin loaded successfully:

```sh
opencode debug agents   # 6 dh-* agents (when the build surfaces plugin agents)
opencode debug config   # plugin entry, and mcp.servers.dh once wired
opencode mcp list       # expect: dh connected (server/status only)
```

The plugin also registers 30 skills (there is no skills debug subcommand on
v2.0.18 — see `skills/index.md`) and zero tools — only the two native `execute`
hooks for TOON output; the harness tools come from the project-scope MCP server
— see [MCP server (`dh`)](#mcp-server-dh).

2. Audit your environment and initialize QA:

Run `dh-setup` (or ask the agent selected for the architecture/design role to run it) to audit system tools, configure project QA hooks, and install/index the code graph (`code-graph-rag`, SQLite backend).

3. Establish project coding conventions:

Run `dh-code-ruler` to interview requirements, inspect codebase patterns, and generate `CODE_RULES.md` at the project root.

4. Plan and implement features:

Run `dh-grill-sdd` to generate requirements (`sdd.md`), create a phased plan using `dh-planning`, and execute it with `dh-execute-plan`.

## How it works

Plan execution inside the plugin runs the 5-step skills loop:

1. `dh-planning` — Prepares phased plans, validating architectural constraints with `dh-domain-check`.
2. `dh-execute-plan` — Schedules the ready phases/sub-tasks from the dependency graph (default 3 workers, hard cap 8; legacy plans run in order):
   - 2.1 `dh-execute-plan-task` — Implements the sub-task code using `dh-coding`.
   - 2.2 `dh-simplify` — Refactors and simplifies changed code for clarity and reuse.
   - 2.3 `dh-review` + `dh-code-review` — Verifies acceptance criteria and code correctness.
   - 2.4 Hard blockers — If 3 consecutive validation failures occur or unresolved P0/P1 review findings arise, the loop stops and asks the user for guidance. Run `dh-pause-plan` before ending the session so the blocker and context are preserved in `handoff.md`.
3. `dh-preflight` + `dh-artifact-check` — Runs static analysis, tests, and build artifact validation.
4. `dh-final-review` — Reports per-phase completion and provides final plan-level sign-off.
5. `dh-create-documentation` — Generates and updates project documentation, including the plan's evolution and observation notes.

### Phased plan model

Plans are stored under `docs/plans/<slug>/plan.md` using a phased structure. Every phase and sub-task maintains a dual status marker (`Pending`, `In Progress`, or `Completed`). A phase cannot transition to `Completed` until all of its sub-tasks are marked `Completed`. When a hard blocker is reached, automation halts immediately so that blockers are never bypassed.

**Pause/resume (cross-cutting).** A plan can pause at any point without changing its statuses: `dh-pause-plan` writes `docs/plans/<slug>/handoff.md` with the active phase/sub-task, git/worktree state, decisions, blockers, validation, and next steps. `dh-resume-plan` validates the handoff, detects drift, rehydrates context, marks it `resumed`, and re-enters step 2. `dh-execute-plan` redirects when a paused handoff exists. The handoff is a sidecar, not a fourth status.

### Parallel plan execution

Plans can declare safe concurrency instead of relying on a fixed order. Phases
and sub-tasks may carry these optional fields:

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

| Field | Level | Values | Default |
|---|---|---|---|
| `Parallelizable` | phase, sub-task | `yes` \| `no` | `no` |
| `Depends on` | phase | phase numbers, comma-separated, or `None` | `None` |
| `Depends on` | sub-task | `N.M` ids, comma-separated, or `None` | `None` |
| `Files/Scope` | sub-task | comma-separated paths/globs, or `None` | `None` |
| `Isolation` | sub-task | `shared` \| `worktree` | `shared` |

- **Shared scheduler.** One contract —
  [`skills/dh-execute-plan/references/parallel-scheduler.md`](skills/dh-execute-plan/references/parallel-scheduler.md)
  — drives both `dh-execute-plan` and `dh-execute-plan-fast`. Each cycle it
  computes the ready set from phase/sub-task dependencies and declared scopes,
  dispatches up to **3 workers** by default (hard cap **8**), and allows several
  sub-tasks to be `In Progress` at once. A phase closes only when all of its
  sub-tasks are `Completed`.
- **Orchestrator owns state.** Only the orchestrator marks statuses, writes
  fast-mode ledger rows (serially), reviews, and commits. Workers run
  `dh-execute-plan-task`/`-fast` in `parallel-worker` mode, implement and
  validate exactly one sub-task, and return
  `{ subTask, agent, status, filesChanged, validation, blockers, notes }`.
- **Hybrid isolation.** Tasks with disjoint declared scopes share the current
  worktree; overlapping scopes serialize unless the sub-task declares
  `Isolation: worktree`. Worktree branches integrate in dependency/plan order;
  a conflict stops integration and preserves the worktree for inspection.
- **Legacy plans stay sequential.** Absent fields default to
  `Parallelizable: no` / `Depends on: None` / `Files/Scope: None` /
  `Isolation: shared`, so existing plans execute exactly as before.

Operational details — readiness, worker mode, worktrees, review fan-in, resume,
and limits: [`docs/LOADING.md` → Parallel plan execution](docs/LOADING.md#parallel-plan-execution).

### TUI plan progress

The package also ships a **TUI part** (`exports["./tui"]`) that loads
automatically beside the server part — no second entry — so plan execution can
be followed without leaving OpenCode. It is read-only and reads the **local**
workspace only.

- **Sidebar card** (`sidebar.content`): one collapsible section per executing
  non-completed plan (`▾`/`▸` toggles hide the plan details), each with the
  `Phase N · N.M` position (`+K` and `Active: N tasks` while several sub-tasks
  run in parallel), completed/total sub-tasks with a text progress bar, the
  current sub-task's delegated agent, plan status, a one-line activity, and an
  `[open]` action that opens the plan file in a centered 80%-sized modal: a
  30% plan-file tree (plan.md, sdd.md, tasks/, diagrams/, sidecars) with
  arrow/click selection and a 70% Markdown/text preview; Markdown renders
  headings, tables, code blocks and Mermaid flowcharts as terminal diagrams.
- **`/plan-progress` panel** (palette entry "Plan progress"): every phase and
  sub-task with status and delegated agent, checklists, review verdict,
  fast-mode skipped-check ledger and last update. `↑`/`↓` and `PgUp`/`PgDn`
  scroll, `f` toggles fullscreen, `r` refreshes, `Esc` closes, and `1`…`9` pin a
  plan when several are active.
- **Build:** `pnpm build` emits `dist/tui.js` (required for source/`file://`
  loading); managed and package installs ship it. `@opentui/core`,
  `@opentui/solid` and `solid-js` are optional peers provided by the host.
- **Limit (v1):** plans come from the `docs/plans` of the local workspace root;
  a remote-server or package-scoped session shows the empty state.

Loading modes, the `cli.json` rule, verification and the manual session check:
[`docs/LOADING.md` → TUI plan progress](docs/LOADING.md#tui-plan-progress).

### MCP server (`dh`)

The plugin registers **no tools** — only the two TOON `execute` hooks. The 12
harness tools are served by a local stdio MCP server
(`@modelcontextprotocol/server` v2), enabled **per project** in that project's
`opencode.jsonc`:

```jsonc
{
  "mcp": {
    "servers": {
      "dh": {
        "type": "local",
        // npm channel (after publication); use
        // --package=github:andrescevp/development-harness for a Git-wired install.
        "command": ["npx", "-y", "--package=dev-harness-skills", "dev-harness-mcp"],
        "protocol": "2026-07-28",
        // Cold first npx install can take ~20–25 s; prewarm makes later starts fast.
        "timeout": { "startup": 300000 }
      }
    }
  }
}
```

| Tool | Purpose |
|---|---|
| `dh_plan_read` | Parse a phased plan (`docs/plans/<slug>/plan.md`) into structured JSON plus scheduling `issues[]` |
| `dh_plan_update_status` | Edit phase/sub-task status markers (phase completion is gated) |
| `dh_plan_create` | Scaffold a phased plan; optionally append the `index.md` row |
| `dh_plan_fast_create` | Create `plan_fast.md` from `plan.md` and seed the skipped-check ledger |
| `dh_plan_fast_read` | Parse `plan_fast.md`; report the source hash, stale flag, and ledger path |
| `dh_plan_fast_update_status` | Update a phase/sub-task in **both** plans (fast mirror + source) |
| `dh_plan_fast_sync` | Pre-execution dry-run/apply fast→plan reconciliation; plan-end is an equality gate (no writes) |
| `dh_plan_fast_skip_check` | Append skipped-check rows to `plan_fast_skip_checks.md` (append-only) |
| `dh_read_sheet` | Query tabular data with DuckDB — csv by default; xlsx via a `read_xlsx(...)` query when the extension loads |
| `dh_update_sheet` | Apply UPDATE/INSERT/DELETE and write the CSV back |
| `dh_sheet_schema` | Describe columns as `name:type` |
| `dh_logged_command` | Stream a command's stdout/stderr to a log in the OS temp dir (runs with the MCP server's OS permissions); return head/tail + log path |

Full inputs/returns contract: [`docs/LOADING.md` → Tools](docs/LOADING.md#tools).

Server key `dh` + tool `plan_read` → **`dh_plan_read`** (MCP host naming
`<server>_<tool>`); under Code Mode call `tools.dh.<tool>`. The older
`dh.<tool>` spelling belonged to the plugin's V2 tool namespace and is
retired. Consumer permission actions match `dh_*`. Full wiring, verification
(`opencode mcp list`), prewarm, and troubleshooting:
[`docs/LOADING.md`](docs/LOADING.md#mcp-server-dh).

### TOON output

Both output surfaces can use TOON — a compact encoding of the JSON data model —
but only when it pays off. Payload semantics are unchanged: every TOON payload
decodes to the same value as its JSON form, and JSON remains canonical
internally and on disk.

- **MCP tools (automatic).** All 12 tools serialize successful payloads through
  one helper: JSON by default, TOON only when the payload is an object/array,
  its serialized JSON is at least 256 characters, encoding succeeds, and the
  TOON text is strictly shorter. Error results stay plain text with
  `isError: true`. Tool names, inputs, counts, and payload meaning are
  unchanged.
- **Native `bash` (plugin hooks).** The plugin registers exactly two tool
  hooks. `execute.after` replaces eligible completed tool output (default
  `bash`) under the same 256-character/strictly-shorter rule and remembers the
  original JSON in a process-local 100-entry least-recently-used cache (the
  least recently used entry is evicted, and a cache hit or re-store refreshes
  recency; entries above 256 KiB are emitted but not cached).
  `execute.before` restores JSON inside forwarded bash single/double-quoted
  strings and quoted-marker heredoc bodies (`<<'EOF'`, `<<"EOF"`) — exact cache
  match first, strict decode of a clean TOON object/array payload second — and
  leaves edited, invalid, or unquoted text untouched. Unquoted heredocs
  (`<<EOF`) are not rewritten because the shell would expand the body.
  Commands above 1 MiB are not scanned.
- **Configuration.** `OPENCODE_TOON_PLUGIN_TOOLS` (comma-separated native tool
  names) changes the eligible compression set; the default is `bash`.
  Restoration always targets `bash` only.
- **Limits.** The cache is memory-only, bounded at 100 entries (256 KiB per
  entry), and process-local. The MCP server and plugin are separate processes,
  so MCP TOON forwarded into a bash command restores through the decode
  fallback, not the exact cache.

Details, eligibility rules, and a decode snippet:
[`docs/LOADING.md` → TOON output](docs/LOADING.md#toon-output).

## Monorepo workspaces

The harness resolves four roots and keeps standalone projects unchanged:

| Root | Meaning |
|---|---|
| Workspace root (`W`) | Repository containing the nested projects; owns `docs/plans`, `AGENTS.md`, the `dh` MCP entry and the root `WORKTREE_LIFECYCLE.md`. |
| Package root | Nested project (workspace package, submodule, nested repo, worktree); owns its stack, commands, optional `CODE_RULES.md`, docs and lifecycle. |
| Plan root | Always `W/docs/plans`; package-local plan directories are never created. |
| Vault root | `W` by default; `OBSIDIAN_VAULT` moves docs only, never plans. |

- **Start at `W`.** Monorepo sessions start opencode at the workspace root;
  `DH_WORKSPACE_ROOT` is unset or the absolute path of `W` in the `dh` MCP entry
  (`"environment": { "DH_WORKSPACE_ROOT": "/abs/workspace" }`). A package-scoped
  session is an anchor mismatch — stop and restart at `W`; the harness never
  creates a package-local `docs/plans`.
- **Workspace map.** `dh-setup` detects pnpm/npm/yarn workspaces, Nx/Turbo/
  Lerna, Cargo workspaces, Go workspaces, Gradle/.NET solutions and
  `.gitmodules`, then writes a user-approved `WORKSPACE.md` at `W` (fallback
  `docs/WORKSPACE.md`). The map records the workspace root (layout, markers,
  plan root); packages (path, stack, test, build, docs root, rules); aggregate
  and affected-only commands; docs roots; code-graph scope; worktree scope; and
  the fixed/independent version policy.
- **Per-package gates and reviews.** `## Workspace Impact` in the plan names the
  affected packages and their commands. `dh-preflight` and `dh-artifact-check`
  report each package independently — a green aggregate never hides an
  unvalidated package — and `dh-review`, `dh-code-review`, `dh-simplify` and
  `dh-final-review` diff only the declared package/shared paths.
- **Rules, docs, graph, versions, worktrees.** A package `CODE_RULES.md`
  overrides the root file for its files; docs live under `W/docs` or
  `{package}/docs` with `package` frontmatter, and evolution notes stay at `W`;
  `dh-code-query` routes to the workspace or package index; `dh-semver` honors a
  `fixed` or `independent` policy; `dh-create-worktree` discovers root/submodule
  lifecycles and aligns submodule branches.
- **Execution provenance.** Executed plans fill `## Execution Record` in
  `docs/plans/<slug>/plan.md` and one row in the plans index
  `## Execution Records`: real repository/path, mirrored plan path, summary and
  architectural changes (T1 write, T2 final-review check, T3 finalize).
- **Standalone unchanged.** No markers and no map: one root, one toolchain, full
  diff; `DH_WORKSPACE_ROOT` may stay unset.

Normative contract:
[`docs/plans/harness-monorepo-awareness/workspace-contract.md`](docs/plans/harness-monorepo-awareness/workspace-contract.md).
Evidence and gaps:
[`docs/audits/2026-11-10-skills-agents-standalone-monorepo.md`](docs/audits/2026-11-10-skills-agents-standalone-monorepo.md).

## Agents & skills

The plugin defines 7 agents and 30 skills using the `@opencode/plugin` SDK, plus exactly two `execute` tool hooks for TOON output. No tool, command, or prompt transforms are registered.

### Agent selection

Skills are capability-driven: each names the role it delegates (architecture,
implementation, testing/QA, review, final sign-off, documentation) and resolves
it at runtime — runtime agent list first, then project config/agent
directories, then global definitions. Ranking prefers project-specific agents
whose instructions match the domain, then specialized project agents, then the
bundled harness capability. `dh-planning` records the choices and their generic
fallbacks in the plan's `## Agent Selection` table; execution re-validates
availability before delegating and stops rather than substituting silently.
Utility roles are skills, not personas: `dh-execute-cli` for command
execution/validation and `dh-explore` for codebase exploration. Full protocol:
[`skills/dh-planning/references/agent-selection.md`](skills/dh-planning/references/agent-selection.md).

### Agents

| Agent | Role |
|---|---|
| `dh-software-architect` | Senior architect for system design, planning, plan execution orchestration, and documentation. |
| `dh-software-engineer` | Senior software engineer handling all sub-task implementation and TDD coding. |
| `dh-reviewer` | Scoped code reviewer evaluating changes against sub-task criteria and code quality. |
| `dh-final-reviewer` | Final reviewer conducting full diff review and plan-level sign-off. |
| `dh-documentor` | Documentation agent responsible for creating, updating, and maintaining project documentation. |
| `dh-researcher` | Source-cited web research support: one external-fact question per pass, primary sources, retrieval dates, and confidence labels; owns no files. |
| `dh-security-auditor` | Enterprise security auditor for web, API, desktop, mobile and agentic/MCP systems; whole-application audit, threat modeling and authorized non-destructive probing. |

### Skills

| Skill | Role |
|---|---|
| `dh-planning` | Creates phased plans in `docs/plans/<slug>/plan.md`. |
| `dh-domain-check` | Validates domain boundaries and SOLID design during planning and execution. |
| `dh-contingency` | Generates Plan A/B/C architectural alternatives with risk, complexity, and trade-off analysis. |
| `dh-research` | Support / optional unblock: one bounded, cited web research pass for an external-fact question; notes and registry under `docs/research/`. |
| `dh-security-audit` | Whole-application audit: authorization/scope, inventory, standards-based controls, severity/evidence, report and re-test; consumes the `dh-setup` security profile. |
| `dh-threat-model` | DFD/trust boundaries, STRIDE/LINDDUN, abuse cases and the agentic/MCP threat catalog. |
| `dh-security-probe` | Authorized, non-destructive probing with rules of engagement, tool tiers, per-surface playbooks and stop conditions. |
| `dh-execute-plan` | Orchestrates the end-to-end execution and status tracking of phased plans. |
| `dh-execute-plan-fast` | Fast alternative: executes from `plan_fast.md`, defers critical gates to plan end, records skipped checks. |
| `dh-execute-plan-task` | Executes an individual sub-task by delegating to the plan's selected implementation agent. |
| `dh-execute-plan-task-fast` | Fast alternative for one sub-task: dual-plan status, per-task ledger rows, no per-task gates. |
| `dh-pause-plan` | Snapshots an active plan into `docs/plans/<slug>/handoff.md` without changing statuses or code. |
| `dh-resume-plan` | Validates a handoff, detects drift, rehydrates context, and resumes via `dh-execute-plan-fast` when `plan_fast.md` exists, otherwise `dh-execute-plan`. |
| `dh-coding` | Applies TDD best practices and enforces rules from `CODE_RULES.md`. |
| `dh-execute-cli` | Executes commands, tests, builds, and validation through the logged-command strategy and reports compact results. |
| `dh-explore` | Explores codebases with glob, grep, and targeted reads, returning compact evidence with exact file references. |
| `dh-simplify` | Streamlines changed code to remove redundancy and reduce complexity. |
| `dh-review` | Verifies sub-task implementations against specified acceptance criteria. |
| `dh-code-review` | Inspects code changes for security, robustness, and style conformance. |
| `dh-preflight` | Executes the full test, lint, and static analysis verification suite. |
| `dh-artifact-check` | Validates build artifacts, distribution packages, and deployment scripts. |
| `dh-final-review` | Performs final plan-level verification and delivers completion verdicts. |
| `dh-create-documentation` | Generates and updates documentation in the project docs directory, including evolution and observation notes. |
| `dh-mermaid` | Generates plan/documentation Mermaid diagrams: current state, desired state, critical changes, component graphs, flows, sequences, and data models. |
| `dh-grill-sdd` | Conducts interactive requirement interviews to produce `sdd.md` specification documents. |
| `dh-setup` | Audits system tools, user plugins, MCPs, and project quality configuration; writes the project security profile/standards selection. |
| `dh-code-ruler` | Interviews users and inspects code to generate project-level `CODE_RULES.md`. |
| `dh-semver` | Analyzes commits since the last tag, determines the version bump, generates a changelog, and creates a local tag — harness adaptation of the global `semver` skill. |

## Development

Run development, test, and verification workflows with `pnpm`:

```sh
pnpm install
pnpm test
pnpm run audit
pnpm typecheck
pnpm build
node scripts/smoke-load.mjs
node scripts/smoke-mcp.mjs
node scripts/smoke-install.mjs
node scripts/smoke-pack.mjs
pnpm qa:check
pnpm qa:check:full
pnpm format:biome
```

Use `pnpm run audit` to run the harness consistency audit (`pnpm audit` runs pnpm's package security audit).

Docker test (opt-in; needs Docker and GitHub credentials for `--remote`):

```sh
scripts/docker-test.sh --local
scripts/docker-test.sh --remote --ref <branch>
```

The runner derives from the pinned `ghcr.io/anomalyco/opencode:2.0.18` image,
adds Node/npm/git/ssh/gcompat, mounts existing host Git credentials read-only,
and keeps HOME/XDG/OpenCode/project paths isolated. It is not part of the
offline `pnpm qa:check:full` gate.

## Repository layout

```text
index.ts         Root plugin entry point for OpenCode plugin discovery (source mode)
agents/          Markdown definitions and system prompts for the 7 bundled agents
skills/          Instructions, templates, and references for the 30 bundled skills
src/cli/         Installer CLI (args, scope, JSONC config, manifest, commands)
src/mcp/         Local stdio MCP server and workspace resolver
src/tools/       Plan/sheet/logged-command implementations + TOON execute hooks
src/lib/         Shared assets, records, atomic writes, package metadata, main guard, TOON codec
scripts/         Audit, smoke tests (load/MCP/install/pack), Docker runner
docker/test/     Derived OpenCode test image (pinned 2.0.18)
test/            Vitest unit and registration tests
docs/            Plugin documentation, loading guides, release runbook, research registry, plans
```

## Documentation

- [`AGENTS.md`](AGENTS.md) — Runtime contract: skills loop, phase lifecycle, tools, and delegation routing.
- [`docs/LOADING.md`](docs/LOADING.md) — Install channels, verification checklists, and troubleshooting.
- [`docs/RELEASING.md`](docs/RELEASING.md) — Manual npm publish runbook and post-publish verification.

## Contributing

Contributions are welcome. Please follow these workflow practices:

1. Fork the repository and create a branch following Git Flow conventions:
   - `feature/*` branched from `develop` for planned work
   - `bugfix/*` branched from `develop` for fixes to in-development work
   - `release/*` branched from `develop` when cutting a release
   - `hotfix/*` branched from `main` for production fixes
2. Follow Conventional Commits for all commit messages (e.g., `feat:`, `fix:`, `docs:`, `refactor:`).
3. Run the full QA gate and ensure all checks pass before opening a Pull Request:

```sh
pnpm qa:check:full
```

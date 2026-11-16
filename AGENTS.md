# AGENTS.md — dev-harness V2 plugin (harness runtime contract)

Role summary, provenance, plugin registration, the 5-step skills loop that
every agent executing plans inside this plugin must follow, the parallel
scheduler contract, the workspace contract for monorepos, and the runtime
delegation routing.

## Role summary

The `dev-harness-skills` OpenCode V2 plugin bundles a self-contained dev harness for
plan-driven development: **6 agents** — `dh-software-architect`,
`dh-software-engineer`, `dh-reviewer`, `dh-final-reviewer`, `dh-documentor`,
`dh-researcher` — and **27 skills** — `dh-planning`, `dh-domain-check`,
`dh-execute-plan`, `dh-execute-plan-fast`, `dh-execute-plan-task`,
`dh-execute-plan-task-fast`, `dh-pause-plan`, `dh-resume-plan`, `dh-coding`,
`dh-execute-cli`, `dh-explore`, `dh-code-query`, `dh-research`,
`dh-contingency`, `dh-simplify`, `dh-review`, `dh-code-review`, `dh-preflight`,
`dh-artifact-check`, `dh-final-review`, `dh-create-documentation`,
`dh-create-worktree`, `dh-mermaid`, `dh-grill-sdd`, `dh-setup`,
`dh-code-ruler`, `dh-semver`. The plugin registers agents and skills plus
exactly two native `execute` tool hooks (TOON compression and forwarded-payload
restoration); it registers no tools, commands, or prompts. The harness tools are
served by the shipped `dev-harness-mcp` MCP server. All plan execution inside
the plugin runs the skills loop below.

## The skills loop (harness runtime contract)

Plans are **phased**: a plan is an ordered set of phases, each containing
sub-tasks, with status markers at BOTH levels (Pending | In Progress |
Completed). The loop:

1. `dh-planning` → use `dh-domain-check` while planning and `dh-mermaid` for visual context (creates phased plans)
2. `dh-execute-plan` (schedules the ready set from the phase/sub-task dependency graph; legacy plans iterate in order)
   2.1 `dh-execute-plan-task` → use `dh-coding`
   2.2 `dh-simplify`
   2.3 `dh-review` + `dh-code-review`
   2.4 IF hard blockers → stop and ask guidance; otherwise keep `dh-execute-plan-task` loop
3. `dh-preflight` + `dh-artifact-check`
4. `dh-final-review` (reports per-phase completion)
5. `dh-create-documentation` (also writes the evolution and observation notes under `docs/evolution/`)

**Fast execution (alternative).** `dh-execute-plan-fast` +
`dh-execute-plan-task-fast` execute the same phased plan from `plan_fast.md`,
defer per-task gates to plan end, and record skipped checks in
`plan_fast_skip_checks.md`. Both orchestrators share the parallel scheduler,
worker envelope, and isolation rules above; the standard loop remains the
default.

**Close-out documentation.** Step 5's `dh-create-documentation` also creates
the plan's evolution note (`docs/evolution/<date>-<slug>.md`) and observation
note (`docs/evolution/observations/<date>-<hhmm>-<slug>.md`), and updates
`docs/evolution/index.md`. `docs/evolve/` is historical and stays untouched.

**Phase lifecycle:** a phase becomes `In Progress` when its first sub-task
starts and `Completed` only when ALL its sub-tasks are `Completed`. Several
sub-tasks may be `In Progress` at once; resume mode reconciles **all** active
sub-tasks (not just the first) before dispatching anything.

**Parallel scheduler (shared contract).** Both orchestrators follow
[`skills/dh-execute-plan/references/parallel-scheduler.md`](skills/dh-execute-plan/references/parallel-scheduler.md).
Phases and sub-tasks may declare `Parallelizable`, `Depends on`, `Files/Scope`,
and `Isolation`; each cycle the scheduler computes the ready set and dispatches
up to **3** workers by default (hard cap **8**) respecting phase gates,
dependency order, and scope compatibility. Missing fields default to
`no`/`None`/`None`/`shared`, so legacy plans run sequentially. Declared metadata
is the only source of independence — the scheduler never infers file scopes.

**Orchestrator-only writes; workers return envelopes.** The orchestrator marks
`In Progress` before dispatch, runs review fan-in, writes fast-mode ledger rows
serially, and serializes commits. A worker (`parallel-worker` mode of
`dh-execute-plan-task`/`-fast`) implements and validates one exact sub-task and
returns `{ subTask, agent, status, filesChanged, validation, blockers, notes }`
— it never edits `plan.md`/`plan_fast.md`, the ledger, reviews, or commits.

**Hybrid isolation.** Shared-worktree work needs disjoint declared scopes;
overlapping scopes serialize or use `Isolation: worktree`. Worktree branches
integrate in dependency/plan order; a conflict stops integration and preserves
the worktree (never auto-deleted). A blocking failure stops new dispatch, drains
in-flight work, and leaves the task and phase open.

**Step 2.4 halts automation.** When `dh-execute-plan-task` (or any loop step)
hits a hard blocker — repeated validation failures (3 consecutive strikes),
unresolved P0/P1 review findings, or missing preconditions that cannot be
worked around — the loop STOPS: report the blocker and ask the user for
guidance. When the blocker depends on current external facts and browsing tools
exist, one bounded `dh-research` pass may precede that report; it never
authorizes continuing past an unresolved blocker. Never silently continue, never
skip the blocked step, and never mark sub-tasks Complete around a blocker. The
rule applies at phase boundaries too: a blocked sub-task blocks its phase — do
not mark the phase `Completed` around a blocker.

**Pause/resume (cross-cutting).** A plan can pause at any point without
changing its statuses: `dh-pause-plan` writes `docs/plans/<slug>/handoff.md`
with the active phase/sub-task, git/worktree state, decisions, blockers,
validation state, and next steps. `dh-resume-plan` validates the handoff,
detects drift, rehydrates context, marks it `resumed`, and re-enters step 2.
`dh-execute-plan` redirects to `dh-resume-plan` when a paused handoff exists.
`handoff.md` is a sidecar, not a fourth status.

**Harness tools (MCP server `dh`):** the plugin registers no tools; the 12
tools (`dh_plan_read`, `dh_plan_update_status`, `dh_plan_create`,
`dh_plan_fast_create`, `dh_plan_fast_read`, `dh_plan_fast_update_status`,
`dh_plan_fast_sync`, `dh_plan_fast_skip_check`, `dh_read_sheet`,
`dh_update_sheet`, `dh_sheet_schema`, `dh_logged_command`) are served by a
project-scope local stdio MCP server (`@modelcontextprotocol/server` v2). Under Code Mode call them as `tools.dh.<tool>` (direct names use
`<server>_<tool>`; consumer permissions match `dh_*`). Loop skills and planner
agents prefer these tools over manual plan.md edits (fall back to manual edits
only when the server is unavailable). Format contract:
`skills/dh-planning/references/phased-plan-template.md`. Wiring and
verification: [`docs/LOADING.md`](docs/LOADING.md#mcp-server-dh).

**TOON output contract.** Successful `dh` payloads are JSON, or TOON when the
payload is an object/array whose JSON is at least 256 characters and TOON is
strictly shorter; errors stay plain text with `isError`. The plugin's
`execute.after` hook compresses eligible native tool JSON (default `bash`;
override the comma-separated set with `OPENCODE_TOON_PLUGIN_TOOLS`) and
remembers the original in a process-local 100-entry least-recently-used cache
(entries above 256 KiB are emitted but not cached); `execute.before` restores
JSON inside forwarded quoted strings and quoted-marker heredoc bodies
(`<<'EOF'`, `<<"EOF"`; unquoted heredocs are expanded by the shell and stay
unchanged) — exact cache match first, strict decode of a clean TOON object/array
payload second — and leaves edited, invalid, or unquoted text unchanged. The
MCP server and plugin are separate processes: exact-match restoration applies
only to output compressed by the plugin, so MCP TOON forwarded into bash uses
the decode fallback. The cache never persists; JSON remains canonical
internally and on disk.

## Workspace contract (monorepo awareness)

| Root | Meaning |
|---|---|
| **Workspace root** (`W`) | Repository containing every nested project; owns `docs/plans`, the root `AGENTS.md`, the `dh` MCP entry and the root `WORKTREE_LIFECYCLE.md`. |
| **Package root** | Nested project (workspace package, submodule, nested repo or worktree); owns its stack, commands, optional `CODE_RULES.md`, docs and lifecycle. |
| **Plan root** | Always `W/docs/plans`; a package-local `docs/plans` is never created. |
| **Vault root** | `W` by default; `OBSIDIAN_VAULT` moves the vault copy only, never plans. |

- **Start at `W`.** A monorepo session starts OpenCode at the workspace root;
  `DH_WORKSPACE_ROOT` is unset or the absolute path of `W`. A package-scoped
  session is an anchor mismatch: stop before the first write and restart at `W`
  (read-only inspection only with explicit consent).
- **Workspace map.** `dh-setup` detects the layout (pnpm/npm/yarn,
  Nx/Turbo/Lerna, Cargo, Go, Gradle/.NET, `.gitmodules`) and writes a
  user-approved `WORKSPACE.md` at `W` (fallback `docs/WORKSPACE.md`) with
  packages, stacks, commands, docs roots, code-graph scope, worktree scope and
  version policy. Skills read it before acting.
- **Per-package work.** `## Workspace Impact` declares the affected packages;
  `dh-preflight`/`dh-artifact-check` report each package independently (never
  green for an unvalidated package), reviews diff only the declared
  package/shared paths, and `CODE_RULES.md` resolves package-over-root for files
  in that package (root covers shared files).
- **Docs and versions.** Workspace docs live under `W/docs`; package docs under
  `{package}/docs` with `package` frontmatter; evolution/observation notes stay
  at `W/docs/evolution`; research notes and their registry stay at
  `W/docs/research` (owned by the documentation agent, one registry per
  workspace). `dh-semver` follows the map's `fixed` (one `vX.Y.Z`)
  or `independent` (`<package>@X.Y.Z`) policy; `dh-create-worktree` discovers
  lifecycles at `W` and each independent package and aligns submodule branches.
- **Execution record.** An executed plan fills `## Execution Record` in
  `docs/plans/<slug>/plan.md` (real repo/path, mirrored plan path, summary,
  architectural changes) at T1, `dh-final-review` verifies it at T2, and
  execution finalizes it plus the `docs/plans/index.md` `## Execution Records`
  row at T3.
- **Standalone unchanged.** No markers and no map: `cwd = W = package root =
  plan root = vault root`, one toolchain, full diff; no map or
  `DH_WORKSPACE_ROOT` required.

Normative contract:
[`docs/plans/harness-monorepo-awareness/workspace-contract.md`](docs/plans/harness-monorepo-awareness/workspace-contract.md).
References: [workspace map](skills/dh-setup/references/workspace-map.md) ·
[gates](skills/dh-preflight/references/workspace-gates.md) ·
[diff scope](skills/dh-review/references/workspace-diff-scope.md) ·
[CODE_RULES](skills/dh-coding/references/code-rules-resolution.md) ·
[docs roots](skills/dh-create-documentation/references/workspace-docs.md) ·
[execution record](skills/dh-planning/references/execution-record.md).

## Runtime delegation

**Capability-based selection.** Skills do not name fixed agents: they state the
capability they need (architecture/design, implementation, testing/QA, review,
final review, documentation, domain specialist, research) and resolve it against
the environment. The authoritative protocol is
[`skills/dh-planning/references/agent-selection.md`](skills/dh-planning/references/agent-selection.md):
discover the runtime agent list first, then project config/agent directories,
then global definitions; rank project-specific agents with domain instructions
above specialized project agents, above the bundled harness capability
fallback. `dh-planning` records the chosen agents, the evidence (`Why`), and the
generic fallback in the plan's `## Agent Selection` table (before `## Phases`)
and names the responsible agent in every sub-task's `Delegated to agent` field;
execution re-validates the choices before delegating, updates the table when an
agent disappears or is renamed, and stops rather than substituting silently.
When no delegation is needed, the table says
`None — no specialized agent required`.

**One delegated agent per sub-task.** Every sub-task names its responsible agent
in `- **Delegated to agent:** <agent-id>`, and that field is the single executor
for the sub-task. The plan's `## Agent Selection` roster defines the valid
agents: implementation sub-tasks normally name the selected implementation
agent, while documentation/test-only sub-tasks may name the matching selected
role. There is no complexity- or type-based builder split. `dh-execute-plan-task`,
`dh-execute-plan-task-fast`, and `dh-coding` route work to that agent; a missing,
empty, unknown, or unavailable value stops execution rather than substituting
silently. Architectural guidance comes from the selected architecture agent.
Bundled agents remain available as capability fallbacks but project-specific
agents win whenever they match the role.

**Utility roles are skills.** Command execution/validation, codebase
exploration, and code-graph querying are instruction layers, not selectable
personas: run them with the `dh-execute-cli`, `dh-explore`, and `dh-code-query`
skills.

**Research is a support capability.** `dh-researcher` answers one external-fact
question per pass with primary sources, retrieval dates, and confidence labels;
`dh-planning`, `dh-grill-sdd`, `dh-contingency`, and both execution task skills
may delegate to it, and the resulting note lives in `docs/research/`. It is not
a loop step: the optional pass never clears an unresolved blocker.

## Provenance

- Harness content is **fully repo-authored**: `agents/` and `skills/` are
  owned by this repository — the repo is self-contained and independent
  (no external source, no extraction step).
- OpenCode-only — no copilot/gemini variants.
- Exactly **6 agents + 27 skills** are bundled. Commands, prompts, and all
  other non-bundled harness content are intentionally NOT bundled.
- The `dh-` names are canonical in the repo files; bundled agents ship
  without the `permission` and `tools` frontmatter keys.

## Plugin registration and loading

- The V2 plugin (`Plugin.define`) registers the 6 agents and 27 skills via
  synchronous domain transforms (`ctx.agent.transform`, `ctx.skill.transform`)
  from frontmatter-parsed assets (repo `agents/` + `skills/` in source mode,
  `dist/assets/` in the bundle), plus exactly two native tool execute hooks:
  `execute.after` (TOON compression of eligible tool output) and
  `execute.before` (JSON restoration of forwarded quoted/heredoc payloads). It
  performs no tool, command, or prompt transforms and registers no tools,
  commands, or prompts (tools live in the MCP server; commands are out of
  scope). The root `index.ts` is the plugin-directory discovery entry:
  cloning this repo into `~/.config/opencode/plugins/` (global) or
  `<project>/.opencode/plugins/` loads the plugin from source — no build or
  config entry needed.
- **Loading alternatives:** `opencode plugin add github:andrescevp/development-harness`
  (managed install, private-repo friendly), a `file://`/relative entry in
  `opencode.json(c)` pointing at the repo directory (`pnpm install` only; no
  build needed for source loading), or the installed package name. See
  [`docs/LOADING.md`](docs/LOADING.md).
- **Verify:** launch opencode and confirm the 6 agents and 27 skills appear
  (including `dh-coding` and `dh-research`) and no commands are registered; then
  confirm the project-scope `dh` MCP server is connected (`opencode mcp list`)
  so the harness tools are available.
- **TUI part:** `exports["./tui"]` loads automatically beside the server part and
  renders read-only plan progress (sidebar card + `/plan-progress`) from the
  local `docs/plans` — see
  [`docs/LOADING.md`](docs/LOADING.md#tui-plan-progress).

## Repository layout

```text
index.ts          source-mode plugin entry (re-exports src/plugin.ts)
agents/           bundled agent definitions (6)
skills/           bundled skills (27)
src/cli/          installer CLI: args, scope, prompt/output, JSONC, config, manifest, commands
src/mcp/          stdio MCP server + workspace resolver
src/tools/        plan/sheet/logged-command tool implementations
src/lib/          shared assets, records, atomic writes, package metadata, main guard
scripts/          QA, smoke (load/MCP/install/pack), Docker runner, audit
docker/test/      derived OpenCode test image (pinned 2.0.18)
docs/             loading/operations docs, research registry, and phased plans
test/             legacy test directory
```

## QA tooling

Full QA stack — the release gate `pnpm qa:check:full` runs all of these (the fast subset is `pnpm qa:check`):

| Tool | Script | Scope |
|---|---|---|
| Biome | `pnpm lint:biome` / `pnpm format:biome` | lint + format of `src/` `scripts/` |
| Knip | `pnpm lint:knip` | unused exports/deps/binaries |
| jscpd | `pnpm lint:dup` | duplicate code detection (config `.jscpd.json`) |
| dependency-cruiser | `pnpm lint:depcruise` (`.dependency-cruiser.json`) | import-graph rules: no-circular, no-duplicates, no-orphans, no node builtins in lib code; tsconfig-aware, cruises `src/` |
| OSV-Scanner | `pnpm scan:deps` (docker) | dependency vulnerabilities |
| Semgrep | `pnpm scan:code` (docker) | security patterns |
| TypeScript | `tsc -b` (in `pnpm build`) | strict typecheck (typescript 6.x — dependency-cruiser requires <7) |
| Vitest | `pnpm test` | unit tests |
| Smoke (plugin) | `node scripts/smoke-load.mjs` | loads the built plugin bundle in isolation |
| Smoke (MCP) | `node scripts/smoke-mcp.mjs` | spawns the built stdio server: 12 tools, plan + fast round-trip, symlink launch |
| Smoke (installer CLI) | `node scripts/smoke-install.mjs` | built CLI install/status/uninstall in isolated HOME/project scopes |
| Smoke (npm tarball) | `node scripts/smoke-pack.mjs` | packs, inspects, installs offline, imports the plugin, checks bins/MCP/assets |
| Docker (opt-in) | `scripts/docker-test.sh --local` / `--remote --ref <branch>` | derived `ghcr.io/anomalyco/opencode:2.0.18` image, read-only credential mounts, container lifecycle |

Full gate: `pnpm qa:check:full` = qa:check → build → smoke-install → smoke-pack → test → typecheck → audit → smoke-load → smoke-mcp
(build precedes the smokes/tests so they run against fresh artifacts; the Docker runner is opt-in and needs credentials/network).
Note: `pnpm audit` collides with pnpm's security audit — the harness audit is `pnpm run audit`.

## Git Flow (repository workflow)

This repository is managed with **Git Flow**:

- `main` — production branch; every commit is releasable. Accepts ONLY
  merges from `release/*` and `hotfix/*` (no direct feature merges).
- `develop` — integration branch; the default base for all new work.
- `feature/*` — branched from `develop` for planned work
  (`feat`/`fix`/`refactor`/`docs` commits); merged back with `--no-ff`.
- `bugfix/*` — branched from `develop` for fixes to in-development work.
- `release/*` — branched from `develop` when a release is cut; merged to
  `main` and tagged there; then `main` (not the release branch) is merged
  back into `develop` so released tags stay reachable (`git describe` /
  `dh-semver`).
- `hotfix/*` — branched from `main` for production fixes; merged to `main`,
  tagged there, and `main` merged back into `develop` (same tag-ancestry
  rule).
- Tags: semver (`vX.Y.Z`) on `main` only (see the bundled `dh-semver` skill).

Local config already set (`git config gitflow.*`): main/develop + the
prefixes above.

## Generated documentation search

Search generated documentation (vault = workspace root, which is the project
root in a standalone repo; docs under `{workspace_root}/docs`) quickly with the
Obsidian CLI or notesmd-cli:

```bash
# notesmd-cli (works without Obsidian running; vault = project folder name)
notesmd-cli search-content "search term" --vault "<project-name>"
# Obsidian CLI (requires the Obsidian app running)
obsidian search query="search term"
# Fallback when neither is installed
rg --glob '*.md' "search term" docs/
```

Use the first available tool (notesmd-cli preferred, then obsidian, then
`rg`). The workspace root is an Obsidian vault when it contains `.obsidian/`;
`dh-setup` checks and initializes it.

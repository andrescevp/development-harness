---
title: Loading the dev-harness-skills plugin
slug: loading
description: Enable the dev-harness-skills plugin in OpenCode V2, wire the dh MCP server, verify registration, and troubleshoot missing agents or skills in standalone and monorepo projects.
tags: [loading, install, plugin, mcp, workspace]
project: dev-harness-skills
created: 2026-09-28
updated: 2026-11-16
status: active
---

# Loading the dev-harness-skills plugin

How to enable the plugin in OpenCode V2, verify it registered the
harness, and troubleshoot when agents/skills do not appear.

## Install: npx installer (primary)

One command installs the plugin in the chosen scope and wires the `dh` MCP
server:

```sh
# npm registry (after publication)
npx -y dev-harness-skills install --global
npx -y dev-harness-skills install --project --path .

# Git channel (available before publication / private use)
npx -y github:andrescevp/development-harness install --global
npx -y github:andrescevp/development-harness install --project --path .
```

| Scope | Plugin target | Config file |
|---|---|---|
| `--global` | `${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode}/plugins/dev-harness-skills` | global `opencode.jsonc` (or existing `opencode.json`) |
| `--project` | `<project>/.opencode/plugins/dev-harness-skills` | `<project>/opencode.jsonc` (or existing `opencode.json`) |

The managed layout is self-contained: `index.ts`, package metadata,
`dist/plugin.js`, `dist/assets` (6 agents, 27 skills), and
`.dev-harness-install.json`; no `pnpm install` is needed in the target.

Common flags:

```sh
--global | --project      required when not interactive; --path only with project
--yes                     skip confirmation prompts (never selects a scope)
--dry-run                 print intended writes; touch nothing
--force                   replace an unmanaged target or conflicting dh entry
--no-mcp                  install the plugin only
--mcp-only                wire/remove only mcp.servers.dh (for opencode plugin add users)
--mcp-source npm|github   choose the MCP package spec (default npm)
--mcp-package <spec>      explicit npx --package spec
--json                    one machine-readable envelope on stdout
```

```sh
npx -y dev-harness-skills status --global --json
npx -y dev-harness-skills uninstall --project --dry-run
npx -y dev-harness-skills install --global --mcp-only --mcp-source github
```

Behavior:

- Re-runs are idempotent; a newer CLI upgrades a managed install. An unmanaged
  or symlinked target is refused unless `--force` (symlinks are never followed).
- The selected config is edited with comment/formatting preservation; an
  existing differing `dh` entry is preserved with a warning unless `--force`.
  Existing configs are backed up to `<config>.bak` before the first change.
- Config cleanup runs before directory deletion on uninstall, so a failed
  config write keeps the plugin for a safe re-run.
- Exit codes: `0` success, `1` operational failure, `2` usage error.
- **Restart OpenCode** after install; plugins load at server startup.
- If `opencode plugin add` already loads the package, use `--mcp-only` instead
  of a second managed copy. The CLI warns about duplicate plugin entries.

Docker test (opt-in; needs GitHub credentials for `--remote`):

```sh
scripts/docker-test.sh --local          # pack this tree, install in the derived OpenCode image
scripts/docker-test.sh --remote --ref <branch>
```

The runner derives from the pinned `ghcr.io/anomalyco/opencode:2.0.18` image,
adds Node/npm/git/ssh/gcompat, mounts existing host Git credentials read-only,
and uses isolated HOME/XDG/OPENCODE/project paths. It is not part of the
offline `pnpm qa:check:full` gate.

## Alternative: clone the repo into a plugin folder

OpenCode auto-discovers plugin package directories — subdirectories with an
`index.ts` entry — under every `.opencode/plugins/` directory, project- and
config-wide:

```text
~/.config/opencode/plugins/          global plugin folder
<project>/.opencode/plugins/         per-project plugin folder
```

Because the repo root ships `index.ts` (re-exporting `src/plugin.ts`), cloning
the repo into such a folder is a complete install for the server part — **no
config entry, no build step** (assets load from the repo's `agents/` + `skills/`
in source mode; `@opencode/plugin` resolves from the clone's own
node_modules). The **TUI part** is different: it resolves the built
`dist/tui.js`, so run `pnpm build` in the clone to get the sidebar card and
`/plan-progress` (see [TUI plan progress](#tui-plan-progress)):

```sh
# global install (all projects):
git clone https://github.com/andrescevp/development-harness.git \
  ~/.config/opencode/plugins/dev-harness-skills
cd ~/.config/opencode/plugins/dev-harness-skills && pnpm install

# or per-project:
mkdir -p <project>/.opencode/plugins
git clone https://github.com/andrescevp/development-harness.git \
  <project>/.opencode/plugins/dev-harness-skills
cd <project>/.opencode/plugins/dev-harness-skills && pnpm install
```

Private-repo note: cloning uses your existing git credentials (same as any
`git clone` of the repo). To update, `git pull` inside the folder.

> **Tip:** if the plugin fails to load with
> `Cannot find package '@opencode/plugin'` right after cloning, run
> `pnpm install` in the folder (or `pnpm install` again after a `git pull`
> that bumped dependencies) and restart opencode. The repo pins
> `@opencode/plugin@2.2.7` (aligned with the OpenCode 2.2.7 host) — earlier
> 2.0.18 builds fail bare-import resolution in the global plugins directory.

## Alternative: `opencode plugin add` (managed install)

OpenCode can install the plugin as a managed package from the npm registry or
directly from the git repo — including private repositories via your existing
git credentials:

```sh
opencode plugin add dev-harness-skills                       # npm registry
opencode plugin add github:andrescevp/development-harness    # git repo
# or pin a branch:
opencode plugin add git+ssh://git@github.com/andrescevp/development-harness.git#main
```

Manage with `opencode plugin list` / `opencode plugin update` / `opencode plugin remove`.

### Package entrypoints (npm tarball vs source checkout)

- **npm tarball** — `package.json` resolves the plugin via `exports["."]`:
  `types`/`import`/`default` → `dist/plugin.d.ts` / `dist/plugin.js`, and
  `exports["./tui"]` → `dist/tui.js` for the TUI part; `main` and `types` point
  at the same server files. `files` ships `dist` (server bundle, TUI bundle, MCP
  bin, installer CLI, declarations, assets) plus `README.md`, so a registry
  install loads without any build. `publishConfig.access` is `public`.
- **Source checkout** — a plugin directory whose `package.json` has `name` and
  `exports` resolves through them, like the published package: `"."` →
  `dist/plugin.js` (server part) and `"./tui"` → `dist/tui.js` (TUI part).
  Without them, discovery falls back to the root file names `<dir>/server` then
  `<dir>/index` (`Bun.resolveSync`), so the repo-root `index.ts`
  (re-exporting `src/plugin.ts`) keeps the **server part** loading from source
  with no build. Keep it when cloning the repo into a `plugins/` folder; run
  `pnpm build` for the TUI part.
- **Pack lifecycle** — `npm pack`/`npm publish` runs `prepack`
  (`npm run build 1>&2`: tsdown bundle + `dist/plugin.d.ts` declarations +
  assets; build output goes to stderr so `npm pack --json` stays parseable)
  and then `prepare` (`scripts/prepare.mjs`), which detects the
  `dist/.build-ok` sentinel and skips — one build per pack. Git installs run
  only `prepare`, which builds the runtime bundle (`build:runtime`) when
  `dist` is absent. No Docker or network QA gate runs in either hook; run
  `pnpm qa:check:full` manually before publishing.
  **Build-time Node:** the tsdown toolchain requires Node
  `^22.18.0 || ^24.11.0 || >=26`; the published tarball still runs on Node
  `>=20.11`.

## Alternative: explicit config entry

Add ONE of the following entries to `"plugins"` in `opencode.json(c)`:

| Form | Entry | Notes |
|---|---|---|
| Local package directory | `"file:///home/andres/workspace/dev-harness-skills"` | Loads the source `index.ts` directly — `pnpm install` only; **`file://` entries must point to a directory**. |
| Relative directory | `"./plugins/local"` | From your project root. |
| Installed package | `"dev-harness-skills"` | After installing the package (`pnpm pack`/git dependency). |

The source `index.ts` entry also works when pointed at directly, e.g.
`"plugins": ["/abs/path/dev-harness-skills/index.ts"]` (opencode loads direct
`.ts` files too).

## TUI plan progress

The package ships a **TUI part** beside the server part — `exports["./tui"]` →
`dist/tui.js`, plugin id `dev-harness-skills.tui` — that renders live,
**read-only** plan progress inside a session: an always-visible sidebar card and
the `/plan-progress` panel.

### Loading

- **Automatic beside the server part.** One entry loads every part: whatever
  loads the server part (project `opencode.jsonc` `"plugins"`, the global
  config, a `plugins/` folder clone, or `opencode plugin add`) also loads
  `./tui`, resolved through the package's `exports["./tui"]` (`dist/tui.js`).
- **No `cli.json` needed** for this package. A `cli.json` entry is only for a
  **TUI-only** package (no server part) or a TUI attached to a **remote**
  server; `dev-harness-skills` always has a server part.
- **Source mode needs a build.** Directory/`file://` loading resolves the built
  artifact, so run `pnpm build` in the clone (it emits `dist/tui.js` and
  `dist/tui/index.d.ts`). `pnpm install` alone loads the server part but no TUI
  card.
- **Managed and package installs** already ship `dist/tui.js` and the `./tui`
  export (`npx … install`, `opencode plugin add`, npm tarball) — no extra step.
  Restart opencode after installing or changing the plugin.
- **Peers are optional.** `@opentui/core`, `@opentui/solid` and `solid-js` are
  declared as optional peer dependencies: the host injects its own instances at
  runtime (OpenTUI/Solid runtime-module rewrite), so `dist/tui.js` does not
  bundle them and server-only users do not install them. Add them only for your
  own type/build tooling.

### Usage

| Surface | What it shows |
|---|---|
| `sidebar.content` card | One collapsible section per executing non-completed plan (`▾`/`▸` header), each showing title/slug, `Phase N · N.M` position, completed/total sub-tasks with a text progress bar, the current sub-task's delegated agent, plan status, a one-line activity, and an `[open]` action. Collapsing hides that plan's details. `[open]` opens the plan file in a scrollable read-only modal with **Plan tree** and **Markdown** tabs (`Tab`/`1`/`2`); Markdown uses host syntax highlighting and renders Mermaid flowcharts as terminal diagrams. Parallel runs show the active-task count (`Phase N · N.M +K`, `Active: N tasks`) while keeping the lowest index as the primary task. |
| `/plan-progress` panel (`dev-harness-skills.plan`) | Every phase and sub-task with status and delegated agent, checklists (`plan.md` checkboxes, `Done When`/`Acceptance Criteria`, final verification), review verdict, fast-mode skipped-check ledger and last update. Keys: `↑`/`↓` and `PgUp`/`PgDn` scroll, `f` fullscreen, `r` refresh, `Esc` close; `1`…`9` pin a plan when several are active. |

- **Read-only.** The TUI never edits plan status, checklists, reviews or the
  index; it keeps state in `storage.memory` and writes nothing under
  `docs/plans`.
- **Selection.** One `active: true` plan is selected automatically; several
  active plans (frontmatter or index `Active = Yes`) show a selector with the
  newest suggested; none/malformed plans show an empty/error state. The card
  refreshes with a short debounce after a plan file changes.
- **Limit (v1): local workspace only.** Plans are read from the `docs/plans` of
  the TUI's local location directory, so the session must start at the workspace
  root. A remote-server session, or a session started inside a workspace
  package, has no local plan tree and shows the empty state (`No docs/plans
  here — start opencode at the workspace root`). Remote plan files are a
  follow-up.

**Verification note (manual):** the card and panel cannot be rendered headlessly
(OpenTUI's native FFI is only available inside the host), so the visual check is
manual: open a session at the workspace root with an active plan, confirm the
sidebar card, run `/plan-progress` (or the "Plan progress" palette entry), and
change a sub-task status to watch the refresh. Unit tests cover the parser,
watcher and activity mapping, and `test/tui-bundle.test.ts` locks the artifact
contract; neither proves pixels.

## Verification checklist

After loading, confirm the harness is registered (opencode v2.0.18 exposes
only the `agents`, `config`, and `paths` debug subcommands):

```
opencode debug agents   → the 6 dh-* agents (when the build surfaces plugin agents; otherwise verify in a session)
opencode debug config   → the plugin entry, and mcp.servers.dh once wired
opencode mcp list       → `dh` connected (server/status only)
```

The plugin also registers 27 skills (there is no skills debug subcommand on
v2.0.18 — the bundled list lives in `skills/index.md`) and exactly two native
`execute` tool hooks for TOON output. Zero tools are registered by the plugin:
the 12 tools come from the MCP server below.

The bundled set includes `dh-researcher` (source-cited web research support)
and `dh-research` (the bounded research workflow); research notes live in
`docs/research/` and are owned by the documentation agent, with plans linking
them through the optional `## Research` section.

## Agent selection

Skills do not name fixed agents; they name a capability (architecture,
implementation, testing/QA, review, final review, documentation) and resolve it
at runtime. The protocol in
[`../skills/dh-planning/references/agent-selection.md`](../skills/dh-planning/references/agent-selection.md)
discovers agents from the runtime list first, then project config/agent
directories, then global definitions; it ranks project-specific agents with
domain instructions above specialized project agents, above the bundled harness
capability fallback. `dh-planning` records the chosen agents, rationale, and
generic fallbacks in the plan's `## Agent Selection` table (before
`## Phases`); execution re-validates availability and stops rather than
substituting silently. Command execution/validation and codebase exploration
are skills (`dh-execute-cli`, `dh-explore`), not selectable agents.

## Parallel plan execution

`dh-execute-plan` and `dh-execute-plan-fast` share one scheduler contract —
[`../skills/dh-execute-plan/references/parallel-scheduler.md`](../skills/dh-execute-plan/references/parallel-scheduler.md).
They differ only in where gates and ledger rows run, never in readiness,
concurrency, isolation, or status ownership.

### Plan metadata

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

| Field | Level | Values | Default (absent) |
|---|---|---|---|
| `Parallelizable` | phase, sub-task | `yes` \| `no` | `no` |
| `Depends on` | phase | phase numbers, comma-separated, or `None` | `None` |
| `Depends on` | sub-task | `N.M` ids, comma-separated, or `None` | `None` |
| `Files/Scope` | sub-task | paths/globs, comma-separated (brace-aware), or `None` | `None` (unknown) |
| `Isolation` | sub-task | `shared` \| `worktree` | `shared` |

The defaults are the legacy contract: a plan without these fields parses and
executes sequentially. `dh_plan_read` returns the metadata plus scheduling
`issues[]` (errors block dispatch; warnings are advisory), and
`dh_plan_create` accepts the metadata but refuses error-level combinations
before writing.

### Readiness and concurrency

- A **phase** is ready when it is `Pending`, every phase in its `Depends on` is
  `Completed`, it is the next pending phase in plan order (or
  `Parallelizable: yes`), no incompatible phase is active (a sequential phase
  needs an idle plan; a parallel phase needs no active sequential phase), and
  it has no blocked sub-task.
- A **sub-task** is ready when its phase is active, it is `Pending`, every
  dependency is `Completed`, it is `Parallelizable: yes` (or, in a sequential
  phase, **every earlier sub-task in that phase is `Completed`**), and it does
  not conflict with a running shared-worktree task. Conflicts are re-checked on
  every dispatch.
- Each cycle the scheduler dispatches up to the limit: **3 workers by default**,
  changed only by an explicit orchestrator request and never above the hard cap
  of **8**. The ready queue is FIFO (phase, sub-task, dependency order).
- Several sub-tasks may be `In Progress` at once. A phase becomes `Completed`
  only when all of its sub-tasks are `Completed`. Missing, cyclic, malformed, or
  deadlocked dependencies stop scheduling and are reported, never guessed
  around (`validatePlan` runs before dispatch and backs `plan_read`/`plan_create`).

### Worker mode and ownership

The orchestrator marks a sub-task (and its phase on first start) `In Progress`
before dispatch, then invokes `dh-execute-plan-task` (or `-fast`) with
`parallel-worker` and the exact sub-task ID. The worker prompt starts with
`MODE: parallel-worker subTask=<N.M>`; a missing header while siblings are
active is a hard stop, not a fallback to the standalone write path. A worker
reads the brief, implements with TDD, runs narrow validation, returns an
envelope, and stops:

```json
{
  "subTask": "2.1",
  "agent": "dh-software-engineer",
  "status": "completed",
  "filesChanged": ["services/api/routes.ts"],
  "validation": ["pnpm test -- api: pass"],
  "blockers": [],
  "notes": []
}
```

Only the orchestrator writes plan statuses (`dh_plan_update_status` /
`dh_plan_fast_update_status`, serially), fast-mode ledger rows
(`dh_plan_fast_skip_check`, serially), reviews, and commits. Workers never edit
`plan.md`, `plan_fast.md`, the ledger, or commit in a shared worktree. Reviews
fan in as workers finish: `dh-review` receives the exact `subTask` and the
envelope's `filesChanged`, writes `tasks/review-<N.M>.md`, and the orchestrator
reads that report (never the first `In Progress` task or the aggregate
`tasks/review.md`). A P0/P1 finding stops new dispatch, drains in-flight work,
and leaves the task and phase open.

### Isolation and worktrees

| Situation | Behavior |
|---|---|
| Two shared tasks with disjoint declared scopes | May run concurrently in the current worktree |
| Overlapping scopes (prefix/glob) | Serialize; never concurrent |
| `Files/Scope: None` (unknown) | Serialize with other shared tasks |
| `Isolation: worktree` | Dedicated branch/worktree; integrate after completion |
| Two worktree tasks | Concurrent; integrated in dependency/plan order |

- `Isolation: worktree` requires a non-empty `Files/Scope`. Before the first
  worktree dispatch, confirm the plan's worktree set with the user once and
  record it in the run state/handoff; then create each worktree with
  `dh-create-worktree`.
- A dependent worktree task starts only after its dependencies are integrated
  (reachable from the main worktree), from the current integration head; the
  orchestrator records the base commit. Integration follows dependency/plan
  order (merge or cherry-pick). A conflict stops integration and preserves the
  worktree/branch for inspection; worktrees are removed only with confirmation,
  never automatically after a failure.
- Build/test outputs, caches, ports, and lockfiles are outside source scope —
  tooling-heavy tasks belong in worktrees, and the orchestrator serializes
  commits and git index operations.

### Resume

A run may pause with several `In Progress` sub-tasks. `dh-pause-plan` records an
active-task table (index, phase, isolation, worktree/branch, validation, pending
review) in `handoff.md`; `dh-resume-plan` rehydrates **all** of them,
reconciles worktrees/branches, revalidates completed-but-unreviewed work, and
re-enters the scheduler without duplicate dispatch. Phases stay open until every
sub-task is `Completed`.

### Limits

- **No automatic scope discovery:** `Parallelizable: yes` is a plan-author
  claim, and `Files/Scope: None` can only serialize.
- **No automatic conflict resolution:** a worktree merge conflict always stops
  for a human decision.
- **One machine, one repository/workspace per run:** no distributed workers,
  external queues, or cross-plan parallelism.
- **Concurrency is not guaranteed:** the runtime may serialize subagent calls;
  correctness never depends on true wall-clock parallelism.
- **Plan writes are single-writer:** only the orchestrator writes statuses,
  ledger rows, and commits, so there is no shared-lock protocol and no
  lost-update race on plan files.

## MCP server (`dh`)

The harness **tools do not come from the plugin** — the plugin registers
agents, skills, and exactly two TOON `execute` hooks only. They are served by a
local stdio **MCP server** named `dh` (`@modelcontextprotocol/server` v2), wired
**per project** in that project's `opencode.jsonc` (additive to the plugin
loading above):

```jsonc
{
  "mcp": {
    "servers": {
      "dh": {
        "type": "local",
        // npm channel; use --package=github:andrescevp/development-harness
        // for a Git-wired install (or let the installer write this entry).
        "command": ["npx", "-y", "--package=dev-harness-skills", "dev-harness-mcp"],
        "protocol": "2026-07-28",
        "timeout": { "startup": 300000 }
      }
    }
  }
}
```

- The command runs the package `bin` (`dev-harness-mcp` → `dist/mcp/stdio.js`).
  The first run clones/installs it into the npx cache — **cold installs measured
  ~20–25 s**, so the canonical snippet includes
  `"timeout": { "startup": 300000 }`. Prewarm once with
  `npx -y --package=github:andrescevp/development-harness dev-harness-mcp < /dev/null`;
  prewarmed/already-connected starts are fast.
- `protocol: "2026-07-28"` pins the native MCP revision; the same server
  factory also serves legacy (`initialize`) clients, so 2025-era hosts work.
- **Workspace anchoring:**
  - Start opencode at the **workspace root** (`W`) — the directory that holds
    `docs/plans`, the workspace map and the root `AGENTS.md`. The server
    resolves its workspace from the process cwd, which is that project
    directory.
  - `DH_WORKSPACE_ROOT` is unset or the **absolute** path of `W`; set it in the
    `dh` entry's `environment` block. Relative values are rejected by the anchor
    check, and a package-scoped session is an anchor mismatch, not a second plan
    root.
  - `dh-setup` detects monorepo layouts and writes a user-approved workspace map
    at `W/WORKSPACE.md` (fallback `W/docs/WORKSPACE.md`): packages, stacks,
    commands, docs roots, code-graph scope, worktree scope and version policy.
  - Plans are anchored at `<W>/docs/plans` only; package-local `docs/plans` are
    never created. Executed plans record the real repo/path, mirrored plan path,
    summary and architectural changes in `## Execution Record`, plus one row in
    the `docs/plans/index.md` `## Execution Records` table (T1 write, T2
    final-review check, T3 finalize).
  - A mismatch stops writes: restart at `W` with the override unset or equal to
    it; read-only inspection is the only operation a user may explicitly
    authorize. No markers and no map → standalone, today's behavior unchanged.
  - Contract:
    [`plans/harness-monorepo-awareness/workspace-contract.md`](plans/harness-monorepo-awareness/workspace-contract.md);
    map schema:
    [`../skills/dh-setup/references/workspace-map.md`](../skills/dh-setup/references/workspace-map.md).
- **No-npx fallback** (no cache, offline, or pinned local build): build a
  clone (`pnpm build`) and point the entry at the binary:
  `"command": ["node", "<clone>/dist/mcp/stdio.js"]`.

### Naming and permissions

Server key `dh` + tool `plan_read` → the normalized tool name
**`dh_plan_read`**. Under Code Mode (the default) the call path is
`tools.dh.<tool>`. Consumer permission actions match `dh_*`.

The underscore form is MCP host naming (`<server>_<tool>`); the older
`dh.<tool>` spelling belonged to the plugin's V2 tool namespace and is
retired by this release.

### Tools

| Tool | Input | Returns |
|---|---|---|
| `dh_plan_read` | `{ slug }` or `{ path }` (relative to `docs/plans`) | `{ ok, path, plan, issues }` — parsed phases/sub-tasks with statuses plus scheduling issues |
| `dh_plan_update_status` | `{ slug?, path?, target: phase\|subtask, index: "N"\|"N.M", status }` | `{ ok, path, plan }` — line-aware status edit |
| `dh_plan_create` | `{ slug, title, objective, phases: [{title, subTasks:[{title}]}], updateIndex? }` | `{ ok, path, plan }` — scaffolds a phased plan |
| `dh_plan_fast_create` | `{ slug, replace? }` | `{ ok, path, plan, sourceSha256, skipChecksPath }` — creates the fast mirror + seeds the ledger |
| `dh_plan_fast_read` | `{ slug }` | `{ ok, path, plan, sourcePlanPath, sourceSha256, stale, skipChecksPath }` |
| `dh_plan_fast_update_status` | `{ slug, target: phase\|subtask, index: "N"\|"N.M", status }` | `{ ok, path, plan, mirroredPath, mirroredPlan }` — updates both plans |
| `dh_plan_fast_sync` | `{ slug, apply?, phase?: pre-execution\|plan-end }` | Dry run `{ ok, aligned, differences, sourceSha256, stale }`; pre-execution apply `{ ok, applied, differences, plan, fastPlan, sourceSha256, stale }`; plan-end is equality-only (`{ ok:false, requiresConfirmation:true, differences }` on any difference) |
| `dh_plan_fast_skip_check` | `{ slug, checks: string[], scope, reason, disposition }` | `{ ok, path, appended, rows }` — append-only ledger rows |
| `dh_read_sheet` | `{ path, query?, limit? }` | `{ ok, columns, rowCount, rows }` — csv by default; xlsx via a `read_xlsx(...)` query when the DuckDB extension loads |
| `dh_update_sheet` | `{ path, query }` | `{ ok, columns, rowCount, rows }` — applies UPDATE/INSERT/DELETE, writes the CSV back |
| `dh_sheet_schema` | `{ path }` | `{ ok, columns, rowCount, rows }` — columns as `name:type` |
| `dh_logged_command` | `{ command, logName?, timeoutMs? }` | `{ ok, exitCode, logPath, head, tail, truncated }` — log in the OS temp dir + head/tail window; the command runs with the MCP server's OS permissions |

Phase → `Completed` is gated: it fails while any sub-task of the phase is not
`Completed`. Plan reads/writes are anchored under `<workspace>/docs/plans`;
`..` escapes, absolute paths outside the anchor, symlinks, and missing
workspace roots are rejected with descriptive errors. Sheet tools take
absolute paths; helper failures return `{ ok: false, error }` payloads (not
protocol errors).

### Verify

```sh
opencode mcp list   # expect the `dh` server, connected
```

MCP servers connect at session start — restart opencode after adding or
changing the project entry. The in-repo gates are
`src/__tests__/registration.test.ts` (exactly 6 agents + 27 skills, zero
tool/command/prompt transforms, exactly two `execute` hooks) and
`node scripts/smoke-mcp.mjs` (spawns the built binary, lists the 12 tools, and
round-trips plan create/read/update + fast create/read/update/skip).

## TOON output

Both output surfaces can emit TOON — a compact, lossless encoding of the JSON
data model — but only when it is strictly smaller. Payload semantics are
unchanged: JSON stays canonical internally and on disk, every TOON payload
decodes to the same value as its JSON form, and no tool, input, or payload
field was added. `@toon-format/toon` is bundled into both artifacts, so managed
installs and `npx` runs need no extra package.

### MCP tools (automatic)

All 12 `dh` tools serialize successful payloads through one helper:

```text
payload serializes to JSON >= 256 chars
  -> payload is a non-null object/array
  -> TOON encode succeeds
  -> TOON is strictly shorter
  -> return TOON
otherwise -> return JSON
```

- Strings, numbers, and payloads below 256 characters stay JSON.
- Error results are unchanged: plain text with `isError: true`.
- Clients must parse both formats: try `JSON.parse`, then a strict TOON decode.

```js
import { decode } from '@toon-format/toon';

function parseToolText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return decode(text); // strict decode; throws on malformed input
  }
}
```

### Native `bash` compression and restoration

The plugin registers exactly two tool hooks:

- `execute.after` — when an eligible tool call completes with valid JSON text
  of at least 256 characters, its text payload is replaced with TOON only when
  TOON is strictly shorter, and the original JSON is remembered in a
  process-local 100-entry least-recently-used cache keyed by the SHA-256 of the
  trimmed TOON text: the least recently used entry is evicted, and a cache hit
  or re-store refreshes recency. Entries above 256 KiB are emitted as TOON but
  not cached.
- `execute.before` — before a `bash` command runs, forwarded single- or
  double-quoted strings and **quoted-marker** heredoc bodies (`<<'EOF'`,
  `<<"EOF"`) are checked: an exact cached TOON payload is replaced with the
  original JSON; otherwise a clean TOON object/array payload (a root key-value
  or array-header document, not only tabular text) is decoded and
  re-serialized as JSON. Edited, invalid, or unquoted text is left
  byte-identical, as are unquoted heredocs (`<<EOF` — the shell would expand
  the body), `$'...'` ANSI-C quoting, and any command above 1 MiB.

Eligible compression tools default to `bash`. Override the set with a
comma-separated list of native tool names in the OpenCode server environment:

```sh
OPENCODE_TOON_PLUGIN_TOOLS=bash,my_tool opencode
```

An empty value falls back to the default. Restoration always targets `bash`
only.

### Limits

- **Process-local cache.** The 100-entry cache lives in the plugin process, is
  never written to disk, and is lost when the process exits. It is bounded per
  entry too: payloads above 256 KiB are not remembered.
- **MCP/plugin process boundary.** The MCP server is a separate process from the
  plugin. Exact-match restoration applies only to native tool output compressed
  by the plugin; MCP TOON forwarded into a bash command restores through the
  clean-TOON object/array decode fallback, not the exact cache.
- **Conditional.** TOON is never guaranteed: small, non-JSON, or non-shorter
  payloads remain JSON.

## Troubleshooting

- **MCP server missing or failed to connect** — run `opencode mcp list` and
  restart the session. Slow first start: prewarm the npx cache (see above) and
  raise `timeout.startup`; without network use the `node <clone>/dist/mcp/stdio.js`
  fallback (requires `pnpm build`; the clone's `dist/.build-ok` sentinel marks
  a complete build).
- **Stale tool behavior after a harness update** — npx may serve a cached
  checkout. Bust it with `npm cache npx rm --force` (full cache:
  `npm cache clean --force`; `npx clear-npx-cache` is legacy-npm only), then
  restart opencode; the next start re-installs from git.
- **Stale `dh` after rebuilding `dist/` or editing the entry** — a long-lived
  shared `opencode serve` service can keep a previously spawned MCP child
  alive, so `opencode mcp list` may report a stale `dh` as connected.
  Restart/close the service (or the project session), then re-run
  `opencode mcp list`.
- **`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` (pnpm 11 consumers installing the
  repo as a git dependency)** — allow the package build in the consumer's
  `pnpm-workspace.yaml` (`allowBuilds:`) using the exact form pnpm prints
  (e.g. `dev-harness-skills@git+https://github.com/andrescevp/development-harness.git#<sha>: true`),
  or run `pnpm approve-builds`; npm/npx are unaffected.
- **`npx dev-harness-skills` returns E404** — the npm package is not published
  yet; use the Git spec
  (`npx -y github:andrescevp/development-harness install ...`) until the
  release is on the registry.
- **`opencode plugin add dev-harness-skills` returns E404** — same cause:
  publish the package first (see `docs/RELEASING.md`) or use
  `opencode plugin add github:andrescevp/development-harness`.
- **`opencode plugin add github:...` fails with `git dep preparation failed`**
  — a known OpenCode 2.0.18 bundled-npm limitation for this package's
  `prepare` hook, while direct `npm install git+...` works. Use the npm spec
  after publication, or the npx installer
  (`npx -y github:andrescevp/development-harness install ...`); see
  `docs/RELEASING.md`.
- **Plugin loads twice / duplicate agents** — an `opencode plugin add` entry
  and a managed copy are both active. Keep one channel and use
  `install --mcp-only` after `opencode plugin add`; the CLI/status warn about
  the duplicate.
- **Docker test cannot clone GitHub** — `scripts/docker-test.sh --remote`
  mounts `~/.gitconfig`, `~/.ssh`, `~/.git-credentials`, or `~/.config/gh`
  read-only when present. No credentials mounted means remote mode fails
  early; `--local` is GitHub-independent.
- **Agents missing after installing (skills visible)** — the running session
  was started **before** the plugin was installed: plugins load at server
  startup, and a long-lived opencode session keeps its original registry.
  Restart opencode (or reload the config) and both the 6 `dh-*` agents and
  27 `dh-*` skills appear — the plugin registers agents via `agent.transform`
  exactly like skills, no `agent` map in config is needed.
- **`pnpm audit` vs `pnpm run audit`** — `pnpm audit` is pnpm's **dependency
  security audit** (currently reports 1 low dev-only esbuild advisory and
  exits 1). The **harness audit** is `pnpm run audit` (aliases
  `node scripts/audit.mjs`) — this is the release-gate audit for the harness;
  the security advisory is a dev-dependency note and does not block the gate.
- **"configured plugin path must be a directory"** — a `file://` entry in
  `"plugins"` points at a file (e.g. `.../dist/plugin.js`). Point it at the
  package directory instead: `file:///home/andres/workspace/dev-harness-skills`.
- **Agents/skills missing after load** — the plugin reads assets from
  `dist/assets` next to its own module (`import.meta.dirname`), so a stale or
  missing `dist/assets` yields empty registrations. Rebuild: `pnpm build`
  (copy-assets runs last and cleans/verifies counts — exit 1 on mismatch).
- **`ERR_MODULE_NOT_FOUND` when loading a copied `dist/` alone** — the plugin
  bundle is self-contained (it inlines `@opencode/plugin` and `yaml`), but it
  still expects `dist/assets` beside `dist/plugin.js`. Copy the package layout
  or install through the installer rather than copying the bundle alone.
- **Real-session note (v2.0.18 observation)** — see
  `docs/plans/dev-harness-v2-plugin/tasks/verification.md`: an early
  observation reported that plugin-registered agents did not surface through
  the tested load forms. Later verification (with the global plugins-directory
  clone + a fresh server) showed the opposite: the plugin registers all 6
  agents automatically — the earlier miss was a stale long-lived session
  started before the plugin was installed. If agents do not appear, restart
  opencode first, then confirm the load form and rebuild `dist/assets` if
  using the built package form.
- **Version skew** — the plugin is built against `@opencode/plugin@2.2.7`
  (aligned with the OpenCode 2.2.7 host); keep the host opencode ≥ that version
  and pin the package if the host is older.
- **Audit fails after editing harness content** — run
  `node scripts/audit.mjs`; new skills/agents must pass the audit rules
  (name regex, loop membership, <250/<300 line limits, no secrets/junk).
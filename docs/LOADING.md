# Loading the dev-harness-skills plugin

How to enable the built plugin in OpenCode V2, verify it registered the
harness, and troubleshoot when agents/skills do not appear.

## Install: clone the repo into a plugin folder (primary)

OpenCode auto-discovers plugin package directories — subdirectories with an
`index.ts` entry — under every `.opencode/plugins/` directory, project- and
config-wide:

```text
~/.config/opencode/plugins/          global plugin folder
<project>/.opencode/plugins/         per-project plugin folder
```

Because the repo root ships `index.ts` (re-exporting `src/plugin.ts`), cloning
the repo into such a folder is a complete install — **no config entry, no
build step** (assets load from the repo's `agents/` + `skills/` in source
mode; `@opencode/plugin` resolves from the clone's own node_modules):

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
> `@opencode/plugin@^2.0.20` — earlier 2.0.18 builds fail bare-import
> resolution in the global plugins directory.

## Alternative: `opencode plugin add` (managed install)

OpenCode can install the plugin as a managed package directly from the git
repo — including private repositories via your existing git credentials:

```sh
opencode plugin add github:andrescevp/development-harness
# or pin a branch:
opencode plugin add git+ssh://git@github.com/andrescevp/development-harness.git#main
```

Manage with `opencode plugin list` / `opencode plugin update` / `opencode plugin remove`.

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

## Verification checklist

After loading, confirm the harness is registered (opencode v2.0.18 exposes
only the `agents`, `config`, and `paths` debug subcommands):

```
opencode debug agents   → the 7 dh-* agents must appear
opencode debug config   → the plugin entry, and mcp.servers.dh once wired
opencode mcp list       → `dh` connected (server/status only)
```

The plugin also registers 17 skills (there is no skills debug subcommand on
v2.0.18 — the bundled list lives in `skills/index.md`). Zero tools are
registered by the plugin: the 7 tools come from the MCP server below.

## MCP server (`dh`)

The harness **tools do not come from the plugin** — the plugin registers
agents and skills only. They are served by a local stdio **MCP server** named
`dh` (`@modelcontextprotocol/server` v2), wired **per project** in that
project's `opencode.jsonc` (additive to the plugin loading above):

```jsonc
{
  "mcp": {
    "servers": {
      "dh": {
        "type": "local",
        "command": ["npx", "-y", "--package=github:andrescevp/development-harness", "dev-harness-mcp"],
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
- **Workspace anchoring:** the server resolves the workspace from the process
  cwd (the project directory opencode starts it in). Override with
  `"environment": { "DH_WORKSPACE_ROOT": "/absolute/workspace" }`.
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
| `dh_plan_read` | `{ slug }` or `{ path }` (relative to `docs/plans`) | `{ ok, path, plan }` — parsed phases/sub-tasks with statuses |
| `dh_plan_update_status` | `{ slug?, path?, target: phase\|subtask, index: "N"\|"N.M", status }` | `{ ok, path, plan }` — line-aware status edit |
| `dh_plan_create` | `{ slug, title, objective, phases: [{title, subTasks:[{title}]}], updateIndex? }` | `{ ok, path, plan }` — scaffolds a phased plan |
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
`src/__tests__/registration.test.ts` (exactly 7 agents + 17 skills, zero tool
transforms) and `node scripts/smoke-mcp.mjs` (spawns the built binary, lists
the 7 tools, and round-trips plan create/read/update).

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
- **Agents missing after installing (skills visible)** — the running session
  was started **before** the plugin was installed: plugins load at server
  startup, and a long-lived opencode session keeps its original registry.
  Restart opencode (or reload the config) and both the 7 `dh-*` agents and
  17 `dh-*` skills appear — the plugin registers agents via `agent.transform`
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
- **`ERR_MODULE_NOT_FOUND` when loading from a copied location** — the bundle
  externalizes `@opencode/plugin` and `yaml`; those must be resolvable from
  the package's own `node_modules`. Load from the repo (deps installed) or
  install the package properly rather than copying `dist/` alone.
- **Real-session note (v2.0.18 observation)** — see
  `docs/plans/dev-harness-v2-plugin/tasks/verification.md`: an early
  observation reported that plugin-registered agents did not surface through
  the tested load forms. Later verification (with the global plugins-directory
  clone + a fresh server) showed the opposite: the plugin registers all 7
  agents automatically — the earlier miss was a stale long-lived session
  started before the plugin was installed. If agents do not appear, restart
  opencode first, then confirm the load form and rebuild `dist/assets` if
  using the built package form.
- **Version skew** — the plugin targets `@opencode/plugin@^2.0.20`; keep the
  host opencode ≥ that version and pin the package if the host is older.
- **Audit fails after editing harness content** — run
  `node scripts/audit.mjs`; new skills/agents must pass the audit rules
  (name regex, loop membership, <250/<300 line limits, no secrets/junk).
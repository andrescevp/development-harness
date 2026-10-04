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

After loading, confirm the harness is registered:

```
opencode debug agents   → look for: dh-software-architect, dh-software-engineer,
                          reviewer, final-reviewer, executor, explorer
opencode debug skills   → look for: dh-artifact-check, dh-simplify,
                          dh-domain-check, dh-coding, dh-code-review,
                          dh-execute-plan, dh-execute-plan-task, dh-final-review,
                          dh-planning, dh-preflight, dh-review,
                          dh-create-documentation, dh-grill-sdd, dh-setup, dh-code-ruler
opencode debug commands → no new commands (commands are out of scope)
```

## Plan lifecycle tools (harness namespace)

The plugin also registers three V2 custom tools (codemode) for phased plans:

| Tool | Input | Returns |
|---|---|---|
| `dh_plan_read` | `{ slug }` or `{ path }` (relative to `docs/plans`) | `{ ok, path, plan }` — parsed phases/sub-tasks with statuses |
| `dh_plan_update_status` | `{ slug?, path?, target: phase\|subtask, index: "N"\|"N.M", status }` | `{ ok, path, plan }` — line-aware status edit |
| `dh_plan_create` | `{ slug, title, objective, phases: [{title, subTasks:[{title}]}], updateIndex? }` | `{ ok, path, plan }` — scaffolds a phased plan |
| `dh_logged_command` | `{ command, logName?, timeoutMs? }` | `{ ok, exitCode, logPath, head, tail, truncated }` — runs a command with its log in the OS temp dir and returns a head/tail window + log path |

Phase → `Completed` is gated: it fails while any sub-task of the phase is not
`Completed`. Reads/writes are anchored under `<workspace>/docs/plans`;
`..` escapes, absolute paths outside the anchor, symlinks, and missing
workspace roots are rejected with descriptive errors.

The in-repo gate that proves the plugin logic is the registration test:

```sh
pnpm test   # src/__tests__/registration.test.ts runs the real bundle setup
            # against a stub ctx → exactly 7 agents + 16 skills registered
```

## Troubleshooting

- **Agents missing after installing (skills visible)** — the running session
  was started **before** the plugin was installed: plugins load at server
  startup, and a long-lived opencode session keeps its original registry.
  Restart opencode (or reload the config) and both the 7 `dh-*` agents and
  15 `dh-*` skills appear — the plugin registers agents via `agent.transform`
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
- **Version skew** — the plugin targets `@opencode/plugin@^2.0.18`; keep the
  host opencode ≥ that version and pin the package if the host is older.
- **Audit fails after editing harness content** — run
  `node scripts/audit.mjs`; new skills/agents must pass the audit rules
  (name regex, loop membership, <250/<300 line limits, no secrets/junk).
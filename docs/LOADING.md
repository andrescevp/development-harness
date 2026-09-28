# Loading the dev-harness-skills plugin

How to enable the built plugin in OpenCode V2, verify it registered the
manifest, and troubleshoot when agents/skills do not appear.

## Build first

```sh
cd /home/andres/workspace/dev-harness-skills
pnpm install
pnpm build        # produces dist/plugin.js + dist/assets (6 agents, 12 skills)
```

## Load forms (opencode v2.0.18)

Add ONE of the following entries to `"plugins"` in `opencode.jsonc`:

| Form | Entry | Notes |
|---|---|---|
| Local package directory | `"file:///home/andres/workspace/dev-harness-skills"` | Default local dev form. **`file://` entries must point to a directory** — the `dist/plugin.js` file form is rejected with "configured plugin path must be a directory". |
| Relative directory | `"../shared/dev-harness-skills"` | From your project root. |
| Installed package | `"dev-harness-skills"` | After `pnpm pack`/installing the package. |

## Verification checklist

After loading, confirm the manifest is registered:

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
            # against a stub ctx → exactly 6 agents + 12 skills registered
```

## Troubleshooting

- **`pnpm audit` vs `pnpm run audit`** — `pnpm audit` is pnpm's **dependency
  security audit** (currently reports 1 low dev-only esbuild advisory and
  exits 1). The **harness manifest audit** is `pnpm run audit` (aliases
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
  `docs/plans/dev-harness-v2-plugin/tasks/verification.md`: the local host did
  not surface plugin-registered agents through the tested load forms, while
  the stub registration test passes. If agents do not appear, confirm the load
  form + rebuild `dist/assets`, and consult the verification report's open
  questions (agent upsert vs add semantics; installed-package form).
- **Version skew** — the plugin targets `@opencode/plugin@^2.0.18`; keep the
  host opencode ≥ that version and pin the package if the host is older.
- **Audit fails after editing harness content** — run
  `node scripts/extract.mjs --check` and `node scripts/audit.mjs`; new skills/
  agents must match `scripts/manifest.json` expectations (counts, name regex,
  loop membership, <250/<300 line limits, no secrets/junk).
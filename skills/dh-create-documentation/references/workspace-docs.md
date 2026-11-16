# Workspace docs — roots, package docs and the vault

Documentation roots are decided by the workspace map, not by the shell's
current directory. `dh-create-documentation` and the documentor agent load this
file before choosing a path; a standalone repository keeps the single root it
has today.

Inputs, in order:

1. `WORKSPACE.md`, else `docs/WORKSPACE.md` — `## Workspace root`,
   `## Packages` (`Docs root` column) and `## Docs roots`.
2. `## Workspace Impact` in the active plan — which packages a plan touches.
3. `git rev-parse --show-toplevel` — only to confirm a standalone root; never to
   find the workspace root from inside a package or submodule.

## Decision table

| Artifact | Docs root | Frontmatter | Why |
|---|---|---|---|
| Workspace overview, architecture, cross-package ADR, setup/runbook | `{workspace_root}/docs/` | `project: <workspace>` (no `package`) | applies to every package |
| Package README, API reference, guide, package ADR | `{package}/docs/` | `project: <workspace>` + `package: <name>` | owned by that package; moves with it |
| Plan close-out doc for one package | `{package}/docs/` when every affected package is one; otherwise `{workspace_root}/docs/` | `package` only in the single-package case | one root per document |
| Evolution note | `{workspace_root}/docs/evolution/<YYYY-MM-DD>-<slug>.md` | `project: <workspace>` | software evolution is workspace-wide |
| Observation note | `{workspace_root}/docs/evolution/observations/<YYYY-MM-DD>-<HHMM>-<slug>.md` | `project: <workspace>` | session learnings are workspace-wide |
| Evolution index row | `{workspace_root}/docs/evolution/index.md` | — | one index for the workspace |
| Research note | `{workspace_root}/docs/research/<topic>.md` | `project: <workspace>` (no `package`) | one workspace registry; owned by the documentation agent |
| Research index row | `{workspace_root}/docs/research/index.md` | — | one index for the workspace |
| Diagram | next to the document it explains | `diagram_type` | keeps the link local |

Rules that follow:

- `package` is the package **name** from the map's `Packages` table (npm name,
  crate, module or directory label) — never a label invented at write time.
- Package docs stay under `{package}`. A package-owned artifact never moves
  above its package root; a workspace artifact never moves below it.
- `docs/plans/` is not a docs root: plans stay at
  `{workspace_root}/docs/plans` only, whatever the docs decision says.
- Research notes and their index live only under `{workspace_root}/docs/research/`;
  plans link notes from their `## Research` section and never own a research
  folder.
- The map's `Docs root` column is authoritative. When it says workspace `docs/`,
  write there instead of creating `{package}/docs`; when it says
  `<package>/docs`, use that. Report a map/manifest disagreement instead of
  silently picking one.

## `OBSIDIAN_VAULT` override

The vault root is `{workspace_root}` by default (`git rev-parse --show-toplevel`
when it agrees). `OBSIDIAN_VAULT` may point at a dedicated notes vault and moves
the **vault copy only**:

- The in-repo docs remain the source of truth at `{workspace_root}/docs` and
  `{package}/docs`.
- The vault copy mirrors the workspace-relative path under `{vault}/docs`:
  workspace docs → `{vault}/docs/<path>`; package docs →
  `{vault}/docs/<package path>/<path>`.
- `OBSIDIAN_VAULT` never moves `docs/plans`, never changes a package root, and
  never turns a package doc into a workspace doc.
- Frontmatter still carries `project`; a package doc keeps its `package` field
  in the vault copy so `notesmd-cli search-content` can find it.

## `git rev-parse --show-toplevel` caveat

`git rev-parse --show-toplevel` returns the **current repository**: inside a
submodule it returns the submodule, and inside a worktree it returns the
worktree. Neither is the workspace root.

- Use the workspace map (`WORKSPACE.md`, else `docs/WORKSPACE.md`) — or the
  directory holding the markers and `docs/plans` — as the workspace root.
- Inside a submodule, also check `git rev-parse
  --show-superproject-working-tree` (it prints nothing outside a submodule)
  before concluding the root.
- Never derive the workspace root from the git toplevel alone; never create
  `{submodule}/docs` as a second workspace docs tree.

## Package-root discovery

1. Read the map and take the longest matching package path for the document's
   subject (`apps/web/src/...` → `apps/web`, not `apps`).
2. Confirm the path exists and is listed as a package; an unlisted path is
   `unknown package` — report it instead of writing outside a known root.
3. When two rows match, prefer the deeper path and report the overlap.
4. No map, or a path inside no package: use the workspace docs root.

## Worked example

pnpm workspace: `apps/web` (docs root `apps/web/docs`) and `services/api` (docs
root: workspace `docs/`).

| Document | Path | Frontmatter |
|---|---|---|
| Checkout flow guide (changes `apps/web` only) | `apps/web/docs/checkout-flow.md` | `project: shop`, `package: web` |
| Service catalog overview (both packages) | `docs/architecture/service-catalog.md` | `project: shop` |
| Plan `checkout-flow` evolution note | `docs/evolution/2026-11-10-checkout-flow.md` | `project: shop` |

`services/api` docs stay in the workspace tree because its map row says so; do
not create `services/api/docs` just to mirror the web package.

## Standalone fallback

No workspace markers and no map: `cwd = workspace root = package root = vault
root`. `{project_root}/docs` keeps today's meaning, `project` stays the only
root-scoping field, and the `package` field is unnecessary. Never require a
standalone repository to add a map, a package root or an `OBSIDIAN_VAULT`.

## Validation checklist

- [ ] The docs root came from the map/`## Workspace Impact`, not from `$PWD`.
- [ ] A package document is under `{package}/docs` and carries
      `package: <name>`; a workspace document carries no `package`.
- [ ] Evolution and observation notes live at the workspace root under
      `docs/evolution/...`, never package-local.
- [ ] `docs/plans/` was not treated as a docs root.
- [ ] `OBSIDIAN_VAULT` moved only the vault copy; the in-repo source of truth
      and the package roots are unchanged.
- [ ] The workspace root was confirmed with the map (not the git toplevel
      alone); a submodule's toplevel was not mistaken for it.
- [ ] Unknown package paths were reported, not silently written.
- [ ] The map's `Docs root` column and the actual write path agree; drift is
      reported.

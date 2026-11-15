# Workspace Map

## Workspace root

- Layout: submodules
- Markers: `.gitmodules`
- Plan root: `docs/plans`

## Packages

| Package | Path | Stack | Test | Build | Docs root | Rules | Notes |
|---|---|---|---|---|---|---|---|
| engine | `packages/engine` | Rust | `none (run inside the submodule)` | `none (run inside the submodule)` | `packages/engine/docs` | package | own repository |
| ui | `packages/ui` | TypeScript | `none (run inside the submodule)` | `none (run inside the submodule)` | `packages/ui/docs` | package | own repository |

## Aggregate commands

- Test: `none (run inside each submodule)`
- Build: `none (run inside each submodule)`

## Docs roots

- Workspace docs: `docs/`
- Package docs: `<package>/docs`

## Code-graph scope

- Index: per package
- Included paths: `packages/engine/`, `packages/ui/`

## Worktree scope

- Workspace lifecycle: `WORKTREE_LIFECYCLE.md`
- Package lifecycles: `packages/engine/WORKTREE_LIFECYCLE.md`, `packages/ui/WORKTREE_LIFECYCLE.md`
- Submodule branch policy: aligned with the workspace branch

## Version policy

- Policy: independent
- Tag format: `<package>@X.Y.Z`

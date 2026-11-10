# Workspace Map

## Workspace root

- Layout: pnpm
- Markers: `pnpm-workspace.yaml` (`packages:`), `package.json`
- Plan root: `docs/plans`

## Packages

| Package | Path | Stack | Test | Build | Docs root | Rules | Notes |
|---|---|---|---|---|---|---|---|
| web | `apps/web` | TypeScript | `pnpm --filter web test` | `pnpm --filter web build` | `apps/web/docs` | root | |
| core | `packages/core` | TypeScript | `pnpm --filter core test` | `pnpm --filter core build` | workspace `docs/` | root | |

## Aggregate commands

- Test: `pnpm -r test`
- Build: `pnpm -r build`

## Docs roots

- Workspace docs: `docs/`
- Package docs: `<package>/docs`

## Code-graph scope

- Index: workspace
- Included paths: `apps/`, `packages/`

## Worktree scope

- Workspace lifecycle: `WORKTREE_LIFECYCLE.md`
- Submodule branch policy: none

## Version policy

- Policy: fixed
- Tag format: `vX.Y.Z`

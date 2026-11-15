# Workspace Map

## Workspace root

- Layout: Turbo
- Markers: `turbo.json`, `pnpm-workspace.yaml` (`packages:`)
- Plan root: `docs/plans`

## Packages

| Package | Path | Stack | Test | Build | Docs root | Rules | Notes |
|---|---|---|---|---|---|---|---|
| dashboard | `apps/dashboard` | TypeScript | `pnpm --filter dashboard test` | `pnpm --filter dashboard build` | `apps/dashboard/docs` | root | |

## Aggregate commands

- Test: `turbo run test`
- Build: `turbo run build`
- Affected only: `turbo run test --filter=...[HEAD^]`

## Docs roots

- Workspace docs: `docs/`
- Package docs: `<package>/docs`

## Code-graph scope

- Index: workspace
- Included paths: `apps/`

## Worktree scope

- Workspace lifecycle: `WORKTREE_LIFECYCLE.md`
- Submodule branch policy: none

## Version policy

- Policy: fixed
- Tag format: `vX.Y.Z`

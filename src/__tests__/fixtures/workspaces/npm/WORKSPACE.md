# Workspace Map

## Workspace root

- Layout: npm
- Markers: `package.json#workspaces`
- Plan root: `docs/plans`

## Packages

| Package | Path | Stack | Test | Build | Docs root | Rules | Notes |
|---|---|---|---|---|---|---|---|
| console | `apps/console` | TypeScript | `npm test --workspace apps/console` | `npm run build --workspace apps/console` | `apps/console/docs` | root | |
| shared | `libs/shared` | TypeScript | `npm test --workspace libs/shared` | `npm run build --workspace libs/shared` | workspace `docs/` | root | |

## Aggregate commands

- Test: `npm test --workspaces`
- Build: `npm run build --workspaces`

## Docs roots

- Workspace docs: `docs/`
- Package docs: `<package>/docs`

## Code-graph scope

- Index: workspace
- Included paths: `apps/`, `libs/`

## Worktree scope

- Workspace lifecycle: `WORKTREE_LIFECYCLE.md`
- Submodule branch policy: none

## Version policy

- Policy: fixed
- Tag format: `vX.Y.Z`

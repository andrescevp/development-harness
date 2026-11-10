# Workspace Map

## Workspace root

- Layout: Nx
- Markers: `nx.json`
- Plan root: `docs/plans`

## Packages

| Package | Path | Stack | Test | Build | Docs root | Rules | Notes |
|---|---|---|---|---|---|---|---|
| shop | `apps/shop` | TypeScript | `nx test shop` | `nx build shop` | workspace `docs/` | root | |
| ui | `libs/ui` | TypeScript | `nx test ui` | `nx build ui` | workspace `docs/` | root | |

## Aggregate commands

- Test: `nx run-many -t test`
- Build: `nx run-many -t build`

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

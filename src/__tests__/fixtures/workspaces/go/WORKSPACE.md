# Workspace Map

## Workspace root

- Layout: Go
- Markers: `go.work` (`use`)
- Plan root: `docs/plans`

## Packages

| Package | Path | Stack | Test | Build | Docs root | Rules | Notes |
|---|---|---|---|---|---|---|---|
| api | `services/api` | Go | `go test ./...` | `go build ./...` | `services/api/docs` | root | run from the module root |

## Aggregate commands

- Test: `go test ./...`
- Build: `go build ./...`

## Docs roots

- Workspace docs: `docs/`
- Package docs: `<package>/docs`

## Code-graph scope

- Index: workspace
- Included paths: `services/`

## Worktree scope

- Workspace lifecycle: `WORKTREE_LIFECYCLE.md`
- Submodule branch policy: none

## Version policy

- Policy: fixed
- Tag format: `vX.Y.Z`

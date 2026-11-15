# Workspace Map

## Workspace root

- Layout: Cargo
- Markers: `Cargo.toml` (`[workspace]`, `members`)
- Plan root: `docs/plans`

## Packages

| Package | Path | Stack | Test | Build | Docs root | Rules | Notes |
|---|---|---|---|---|---|---|---|
| engine | `crates/engine` | Rust | `cargo test -p engine` | `cargo build -p engine` | `crates/engine/docs` | root | |

## Aggregate commands

- Test: `cargo test --workspace`
- Build: `cargo build --workspace`

## Docs roots

- Workspace docs: `docs/`
- Package docs: `<package>/docs`

## Code-graph scope

- Index: workspace
- Included paths: `crates/`

## Worktree scope

- Workspace lifecycle: `WORKTREE_LIFECYCLE.md`
- Submodule branch policy: none

## Version policy

- Policy: fixed
- Tag format: `vX.Y.Z`

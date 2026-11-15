# Worktree discovery — root, submodules and branch alignment

`dh-create-worktree` runs the lifecycle files that belong to the repositories a
worktree touches. A workspace has one lifecycle at its root and may have one per
independent package (a submodule or a nested standalone repository).

## Discovery

Look for `WORKTREE_LIFECYCLE.md` in this order:

1. **Workspace root** — `{workspace_root}/WORKTREE_LIFECYCLE.md` (the root
   lifecycle). Missing, empty, or lacking a required section → STOP and ask the
   user to run `dh-setup`.
2. **Package roots** — every package from the map (`WORKSPACE.md`, else
   `docs/WORKSPACE.md`) that is an independent repository: `.gitmodules`
   entries, nested standalone checkouts, and packages whose row says they carry
   their own lifecycle. Read `<package>/WORKTREE_LIFECYCLE.md` when it exists.
3. **Worktree copies** — a lifecycle file inside an existing worktree governs
   that worktree only when the user asks to reuse it; it never replaces the main
   checkout's file.

Report the discovery result before acting: root file path, package files found,
packages without a file. The map's `## Worktree scope` section (`Workspace
lifecycle`, `Package lifecycles`, `Submodule branch policy`) is the shortcut;
verify each path on disk.

## Execution order

Root phases always run; package phases run for the packages the operation
touches (a plan's `## Workspace Impact`, or the user's explicit list).

| Operation | Order |
|---|---|
| create | root `Before create` → create the workspace worktree → root `After create` → per package: `Before create` → create/attach the package worktree → `After create` |
| reuse | no lifecycle hooks; verify branch and dirty state in the root and the packages |
| merge | per package: `Before merge` → merge → `After merge` (commit the updated submodule pointer) → root `Before merge` → merge → root `After merge` |
| remove | per package: `Before remove` → remove → `After remove` → root `Before remove` → remove → root `After remove` |

- Run each section from its documented cwd: root sections at the workspace
  root, a package section inside that package's checkout or worktree.
- A section marked `none` is skipped and reported as such.
- Package merges land before the root merge so the root records the final
  submodule pointer; never merge the root first and leave the pointer stale.
- A package worktree is optional when the package is not touched; report it as
  "not touched — no package lifecycle run".

## Branch alignment

- The branch name is the same in the workspace repository and in every
  independent repository that participates: `feature/x` in the root means
  `feature/x` in each submodule checkout, created from that submodule's own
  base (`develop`/`main`, per the root lifecycle or the user).
- A submodule is usually in detached HEAD. Before any commit, run
  `git -C <package> rev-parse --abbrev-ref HEAD`; `HEAD` means detached — check
  out the aligned branch (or create it) instead of committing to detached HEAD.
- Verify alignment after creation: `git -C <package> rev-parse --abbrev-ref
  HEAD` must equal the root branch, and `git -C <package> worktree list` must
  show the package worktree when one was created.
- Divergent names are allowed only when the lifecycle file or the user says so;
  record the mapping in the report.
- Reuse follows the existing rule: an existing worktree may host another plan on
  the **same branch** at the user's request. Git cannot check out one branch in
  two worktrees, so a second worktree needs a different branch or a detached
  HEAD with explicit consent.

## Nested independent repositories

A package that is its own repository but not a submodule follows the same
package rules: discover its lifecycle file, align the branch, run its phases in
its own cwd. Nothing is written into the workspace's `.gitmodules`, and no
gitlink is recorded — the report names the repository path instead.

## Missing files and failures

| Case | Behavior |
|---|---|
| Root lifecycle missing, empty, or incomplete | STOP; ask the user to run `dh-setup`; never create or guess the file |
| Package lifecycle missing | Not an error: skip with a reported `no lifecycle file` line; unless the user requires it, then STOP |
| Package path from the map does not exist | Report `unknown package`; skip its phases; do not invent a directory |
| Lifecycle step fails | STOP the operation; report the command, cwd, exit code, and output; never run the remaining phases |
| Branch alignment fails | STOP before any commit; report the expected and actual branch per repository |
| Worktree dirty at merge/remove | STOP and ask; never `--force`, reset, or delete a branch |

A failure in a package phase blocks the whole operation even when the root
phases already ran; report which phases completed and leave the worktree in
place for inspection.

## Validation checklist

- [ ] Root and package lifecycle files were discovered and reported before any
      git command.
- [ ] The operation's phase order matches the table; root and package cwds are
      correct.
- [ ] Every participating package is on the same branch as the root (or an
      explicitly recorded mapping).
- [ ] No commit was made on detached HEAD; the submodule pointer is committed.
- [ ] Missing package lifecycle files were reported, not treated as failures; a
      missing root file stopped the operation.
- [ ] The same-branch reuse rule was applied (no second worktree on one branch
      without consent).
- [ ] A failed step stopped the operation with command, cwd, exit code, and
      output.
- [ ] Standalone repositories keep the single root lifecycle (`cwd = root =
      package`).

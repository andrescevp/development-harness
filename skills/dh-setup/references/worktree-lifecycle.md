# Worktree lifecycle (`WORKTREE_LIFECYCLE.md`)

`{project_root}/WORKTREE_LIFECYCLE.md` is the project-owned contract read by
[`dh-create-worktree`](../../dh-create-worktree/SKILL.md). Only `dh-setup` creates or
updates it; the worktree skill never generates, guesses, or overwrites it.

## When to generate

- **Missing file:** interview the user, propose the template below, and write the file
  only with explicit consent.
- **Existing file:** review it with the user and update it only with consent; never
  replace it silently. Treat an out-of-date file as a setup finding, not a blocker.
- Keep the file tracked or ignored according to the project policy. It contains commands
  and placeholders, never secret values.

## Interview

Ask and record each answer before writing the file:

1. **Worktree location:** sibling directory (recommended) or inside the repository;
   naming convention for paths.
2. **Branch policy:** create a new branch per worktree by default? May an existing
   worktree/branch be reused for different plans at the user's request? (Git cannot
   check out the same branch in two worktrees at once.)
3. **Before create:** preconditions to verify (clean tree, base ref up to date, CI or
   review state, required local tools).
4. **After create:** dependency install, local config copy, migrations, hooks, editor
   setup, service startup.
5. **Before merge:** rebase/update, full tests, changelog, review, conflict policy.
6. **After merge:** deploy, notify, tag, branch cleanup.
7. **Before remove:** stop services, archive logs, verify no uncommitted work, confirm
   the branch is merged or intentionally abandoned.
8. **After remove:** `git worktree prune`, remove caches, update docs or tickets.
9. **Failure policy:** default is stop on the first failed step and report the command,
   cwd, exit code, and output. Note any intentionally non-blocking step explicitly.
10. **Secrets:** reference environment variables or local files; never store values in
    this file or in command lines.

## Template

```markdown
# Worktree Lifecycle

> Project-owned actions for dh-create-worktree. Commands run from the documented
> cwd; {project_root}, {worktree}, {branch}, {base}, {target}, and {plan} are
> placeholders. Replace "none" with real steps or keep it to skip the phase.

## Before create

- none

## After create

- none

## Before merge

- none

## After merge

- none

## Before remove

- none

## After remove

- none
```

## Example steps (adapt; never copy secrets)

```markdown
## Before create

- `git status --short` must be empty; otherwise stop and ask.
- `git fetch --all --prune`

## After create

- `cd {worktree} && pnpm install`
- copy local config from a path outside git (for example
  `$HOME/.config/<project>/local.env`) into the worktree
- `cd {worktree} && pnpm db:migrate`

## Before merge

- `cd {worktree} && pnpm test`
- `cd {worktree} && pnpm lint`

## After merge

- update the changelog and notify the team channel

## Before remove

- stop any service started from `{worktree}`
- `git -C {worktree} status --short` must be empty

## After remove

- `git worktree prune`
```

## Validation

- All six headings are present, in order: Before create, After create, Before merge,
  After merge, Before remove, After remove.
- Every command is idempotent or says how to check whether it already ran.
- The failure policy is explicit; the default is stop on first failure.
- No secret values or credential-bearing command lines are present.
- The file states which cwd each phase uses when it differs from the defaults in
  `dh-create-worktree` (project root, new worktree, worktree being merged/removed,
  target worktree).

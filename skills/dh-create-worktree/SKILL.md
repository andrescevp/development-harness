---
name: dh-create-worktree
description: >
  Create, reuse, merge, and remove project worktrees following the project-owned
  WORKTREE_LIFECYCLE.md (before/after create, merge, and remove). Use when the
  user asks for a worktree, to run a plan in one, or to merge/remove it. The
  lifecycle file is generated only by dh-setup.
license: MIT
compatibility: opencode
allowed-tools: read, bash
metadata:
  audience: developers
  workflow: worktree
---

# Worktree Lifecycle

Create, reuse, merge, and remove git worktrees according to `{project_root}/WORKTREE_LIFECYCLE.md`.
That file is generated and maintained **only** by `dh-setup`; this skill reads it and
executes its steps. Format, interview questions, and template:
[`dh-setup/references/worktree-lifecycle.md`](../dh-setup/references/worktree-lifecycle.md).

## Hard rules

- **User request only.** Never create, merge, reuse, or remove a worktree because a plan
  starts, finishes, or pauses. The user must ask in this session.
- **Read before acting.** Load `WORKTREE_LIFECYCLE.md` first. If it is missing, empty,
  or lacks a required section, STOP and ask the user to run `dh-setup`. Never create,
  guess, or overwrite the file from this skill.
- **Plans do not own worktrees.** A worktree may host different plans over time, and a
  plan may move to another worktree. A worktree may be reused on the **same branch**
  for a different plan, always at the user's request. Never create a new worktree per
  plan automatically.
- **Stop on failure.** A lifecycle step failure halts the operation: report the command,
  cwd, exit code, and output. Never skip a step or continue around it.
- **No secrets.** Never put tokens or credentials in the lifecycle file or command
  lines; reference environment variables or local files instead.
- **No destructive shortcuts.** Never `--force`, reset, delete a branch, or push unless
  the user or the lifecycle file explicitly asks.

## Modes

Confirm the mode and parameters with the user before touching git:

| Mode | Purpose |
|---|---|
| `create` | New worktree (new branch, existing branch, or detached ref) |
| `reuse` | Run another plan in an existing worktree (same branch allowed on request) |
| `merge` | Merge the worktree branch into the target branch |
| `remove` | Remove a worktree after merge or abandonment |
| `status` | List worktrees, branches, paths, and dirty state |

Collect: worktree name/path, branch, base ref, target branch, and plan slug when
relevant.

## Lifecycle contract

`WORKTREE_LIFECYCLE.md` has six required sections. Run them in order through the
`dh-execute-cli` skill, from the documented cwd:

| Section | Default cwd |
|---|---|
| `## Before create` | project root |
| `## After create` | new worktree |
| `## Before merge` | worktree being merged |
| `## After merge` | target worktree / project root |
| `## Before remove` | worktree being removed |
| `## After remove` | project root |

Each section is an ordered list of commands or manual instructions. Commands may use
`{project_root}`, `{worktree}`, `{branch}`, `{base}`, `{target}`, and `{plan}`.
Run the steps as written; do not invent extra ones. A section marked `none` is skipped
and reported as such.

## Create

1. Run `Before create` from the project root.
2. Ask which branch mode the user wants:
   - **new** — create `<branch>` from `<base>` (`git worktree add -b`).
   - **existing** — attach an existing branch; first verify with
     `git worktree list` that no other worktree has it checked out.
   - **detached** — check out `<ref>` without a branch.
3. Create through the OpenCode worktree tool when it is available
   (`worktree_create`), otherwise `git worktree add` via `dh-execute-cli`.
4. Run `After create` from the new worktree. Report path, branch, and base.

## Reuse (same branch, different plan)

1. Confirm the user wants the existing worktree instead of a new one.
2. Inspect `git worktree list` (or `worktree_list`) and verify the worktree is clean,
   or that the user accepts its current state.
3. Do **not** rerun the create / after-create hooks: they belong to worktree creation,
   not to plan execution.
4. Report the plan-to-worktree mapping and use that directory as the plan cwd.
5. Git cannot check out the same branch in two worktrees at once. If the user asks for
   a second worktree on that branch, offer a detached worktree or a different branch
   only with explicit consent.

## Merge

1. Run `Before merge` from the worktree.
2. Verify a clean status and the target branch; merge with git through
   `dh-execute-cli`, using the strategy the lifecycle file or the user specifies.
3. On conflict: stop, report the affected paths, and ask. Never auto-resolve.
4. Run `After merge` only after a clean merge. Do not push unless the user or the
   lifecycle file says so.

## Remove

1. Run `Before remove` from the worktree.
2. Require a clean worktree or explicit confirmation for uncommitted work. Never force
   removal without confirmation.
3. Remove with `worktree_remove` (or `git worktree remove`), then `git worktree prune`
   when the lifecycle file asks for it.
4. Run `After remove` from the project root. Do not delete branches unless the user
   asks.

## Status

List worktrees with path, branch, HEAD, and dirty/clean state. Include the plan using
each worktree when known.

## Report

Return: mode, worktree path, branch/base, lifecycle sections executed (pass/fail),
failed commands, dirty state, and next steps. Record the plan-to-worktree association
when a plan runs there.

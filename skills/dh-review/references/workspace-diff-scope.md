# Workspace diff scope

`dh-review`, `dh-code-review`, `dh-simplify` and `dh-final-review` review the
paths a plan declares in `## Workspace Impact`. Scoping keeps unrelated package
changes out of the findings while keeping the review complete for every touched
path. Standalone repositories have no affected packages and keep the full diff.

## Path derivation (formula)

```text
paths = affected_packages(plan) ∪ shared_paths(plan)
diff  = git diff <base>...HEAD -- <paths>
```

1. Read `## Workspace Impact` in `plan.md`:
   - `Affected packages` — one workspace-relative path per package
     (`apps/web`, `services/api`), or `None — standalone`.
   - `Shared paths` — root/shared files the plan declares (`docs/`,
     `AGENTS.md`, `README.md`, `CHANGELOG.md`, `CODE_RULES.md`, workspace
     config, `WORKSPACE.md`, `WORKTREE_LIFECYCLE.md`), or `None`.
   - If the section is missing on a workspace plan, stop and ask: do not review
     the whole repository by default.
2. Normalize each path: strip backticks/quotes and a leading `./`, drop a
   trailing `/`, keep it workspace-relative, then sort and de-duplicate.
3. Use the `Shared paths` field. If it is absent, treat root/shared files named
   explicitly in the plan's sub-tasks as declared; never infer a root file from a
   package path. Workspace-owned files are never implied by a package path.
   - docs and plan artifacts: `docs/`, `AGENTS.md`, `README.md`, `CHANGELOG.md`
   - rules: `CODE_RULES.md`
   - workspace config: `pnpm-workspace.yaml`, root `package.json`,
     `turbo.json`, `nx.json`, `lerna.json`, `go.work`, root `Cargo.toml`,
     `settings.gradle`, `settings.gradle.kts`, `*.sln`, `.gitmodules`
   - workspace map and lifecycle: `WORKSPACE.md`, `WORKTREE_LIFECYCLE.md`
   - root lockfiles and shared tooling config touched by the change
4. When a root/shared file changed but is not in the plan, do not silently
   include it: report it as a scope finding (out-of-scope change) and review it
   only after the user or plan owner confirms.
5. A path that does not exist may be a deletion — keep it in the pathspec (git
   matches deletions) but verify with `git status` before calling it a typo.

## Git commands

Run from the workspace root so pathspecs are repository-relative.

```bash
# Files changed by the plan (scoped)
git diff --name-only <base>...HEAD -- <paths>

# Full scoped diff for review
git diff <base>...HEAD -- <paths>

# Uncommitted tracked changes in scope (staged + unstaged)
git diff HEAD -- <paths>

# Unstaged tracked changes in scope
git diff -- <paths>

# Untracked files in scope (include them in the review)
git status --porcelain -- <paths>

# Commits that touched the scope
git log --oneline <base>..HEAD -- <paths>

# Confirm the scope is not empty / inspect what was excluded
git diff --name-only <base>...HEAD -- . ':!apps/web' ':!services/api'
```

- Keep `--` before the paths. Without it, a package path that matches a ref or
  an option is parsed as one.
- Use `<base>...HEAD` (merge-base) for branch reviews and `<base>..HEAD` only
  when the plan records that range.
- Pull requests: `<base>` is the PR base branch; the plan's `## Execution
  Record` `Commit range` is the fallback.
- No workspace map / no affected packages: drop the pathspec and review the full
  diff exactly as before.

## Root and shared files

| Path kind | Handling |
|---|---|
| Root config the plan changes (workspace config, root lockfile) | Include explicitly; review it as its own item labelled `[workspace]` |
| Root docs and plan artifacts (`docs/`, `AGENTS.md`, `CHANGELOG.md`) | Include explicitly only when the plan declares them; otherwise scope finding |
| Root `CODE_RULES.md` | Include when rules changed; a package override is reviewed under its package |
| Generated artifacts (`dist/`, lockfile churn) | Review the source change, not the generated output; flag unexplained churn |
| Deleted package | Keep the path; review the removal as that package's change |
| Package not in `## Workspace Impact` that changed | Report **unaffected — not reviewed**; do not review it |

Dropping a root/shared file that the plan declares is a review defect: the
scope must be the union, never "packages only".

## Package labels in findings

Every finding names its scope, so a reader can tell package work from shared
work:

```markdown
### [P1] Unvalidated cart total
- **Package**: `apps/web`
- **Location**: `apps/web/src/cart.ts:42-58`
- **Why it matters**: ...
```

Use `[workspace]` for root/shared files and the package path for package files.
A finding without a scope label is not actionable in a monorepo.

## Two-package example

```text
/repo                        ← workspace root (W): pnpm-workspace.yaml, docs/plans
├── apps/web                 ← affected (P1)
├── services/api             ← unaffected (P2)
└── README.md                ← changed, shared root file, not declared
```

`## Workspace Impact` lists `apps/web` only; the change also edits `README.md`.

```bash
$ git diff --name-only main...HEAD -- apps/web
apps/web/src/cart.ts
apps/web/src/cart.test.ts

$ git diff --name-only main...HEAD -- apps/web README.md
apps/web/src/cart.ts
apps/web/src/cart.test.ts
README.md
```

Reported as:

- `apps/web` — affected; diff reviewed; findings labelled `apps/web`.
- `services/api` — **unaffected**, not reviewed (even if it has local changes).
- `README.md` — not declared by the plan → scope finding; included only after
  confirmation.

Without the pathspec the same branch returns `services/api/src/billing.ts` and
the unrelated root edit, which is exactly the contamination this scope removes.

## Validation checklist

- [ ] `## Workspace Impact` was read; a missing section on a workspace plan
      stopped the review instead of widening it to the whole repo.
- [ ] The path list is normalized, sorted, de-duplicated and workspace-relative.
- [ ] `git diff -- <paths>` (or `git status --porcelain -- <paths>`) was used,
      with `--` before the paths.
- [ ] Declared root/shared files are in the list; undeclared ones are reported
      as scope findings, not silently reviewed or dropped.
- [ ] Every finding carries its package (or `[workspace]`) label.
- [ ] Untouched packages are reported as unaffected, not as clean or failed.
- [ ] Standalone repositories still review the full diff.

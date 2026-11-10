# Monorepo versioning — fixed and independent releases

`dh-semver` keeps one versioning algorithm; this file decides **what** it
versions. The policy is declared, never inferred: several `package.json` files
do not make a repository independently versioned.

## Policy source

| Input | Used for |
|---|---|
| `WORKSPACE.md`, else `docs/WORKSPACE.md` → `## Version policy` | `Policy: fixed \| independent`, `Tag format`, `Changelog` |
| `## Workspace Impact` in the active plan | Which packages the release covers |
| `## Packages` table | Package names used in tags and changelog headings |
| Last tag(s) | `git describe` / `git tag --sort=-v:refname` |

Read order: map → plan → tags. No map → standalone (below). Map present but
`## Version policy` missing → **ask** the user; do not infer and do not silently
apply `fixed`.

## Fixed policy

- One version and one tag for the workspace: `v<major>.<minor>.<patch>`,
  created on the workspace branch (`main` under this repo's Git Flow).
- The bump type comes from **all** commits since the last workspace tag
  (`git describe --tags --abbrev=0`), not from one package.
- `CHANGELOG.md` lives at the workspace root; entries may be grouped under
  package headings, but there is one version decision.
- Release train: every package ships together. Report packages with no commits
  as "no changes — riding the train".
- Do not rewrite package manifests' `version` fields unless the user asks; the
  tag is the release record.

## Independent policy

- One version and one tag **per package**: `<package>@<major>.<minor>.<patch>`
  (for example `web@1.4.0`), created on the workspace branch.
- `<package>` is the map's package name (npm name, crate, module or directory
  label) — never a path containing `/` and never a display name invented at
  release time. Normalize a scoped npm name (scope marker plus slash) to
  `scope-web` and record the mapping in the report.
- Bump type per package from its own commits:
  `git log <package>@<last>..HEAD --oneline -- <package path>`; last tag with
  `git describe --tags --abbrev=0 --match "<package>@*"` (or
  `git tag --sort=-v:refname --list "<package>@*" | head -1`).
- Changelog: per-package `<package>/CHANGELOG.md` when the map says so,
  otherwise one workspace `CHANGELOG.md` with one section per released package.
- Release train: only the affected packages, dependency order first (shared
  library before its consumers), each package confirmed independently.
- A package with no commits since its tag is not released and gets no tag.

## Tag format rules

| Policy | Tag | Example |
|---|---|---|
| fixed | `v<X.Y.Z>` | `v1.4.0` |
| independent | `<package>@<X.Y.Z>` | `web@1.4.0` |

- Never mix the two formats in one repository.
- Never reuse, move, or delete a tag.
- Annotated tags (`git tag -a`) with the release message, as today.
- Package tag names must not contain `/`, whitespace, or a second `@`.

## Confirmation before tagging

Every policy keeps the current safety rules:

1. Report the version decision, the changelog, and the exact tag command(s)
   first — one row per released package under independent policy.
2. Ask for confirmation before creating any tag, even though tags are local.
3. Create tags locally only; **never push** without explicit user confirmation.
4. Under independent policy, confirm the package list: an omitted package is a
   skipped release, not a silent no-op.

## Release trains and order

- **fixed:** workspace tag → optional package manifest alignment → report every
  package.
- **independent:** resolve dependency order from the package graph (`apps/web`
  depends on `packages/core` → release `core`, then `web`). Each package step is
  its own tag + changelog + confirmation; a failed step stops the train and
  leaves later packages untagged.
- Hotfixes follow the same policy: one workspace tag (fixed) or one package tag
  (independent), on the release branch the repository uses.

## Standalone fallback

No map and no markers: today's algorithm unchanged — `v<X.Y.Z>`, workspace-root
`CHANGELOG.md`, one tag. Never require a standalone repository to declare a
policy or to adopt package tags.

## Validation checklist

- [ ] The policy came from the map or an explicit user answer; it was never
      inferred from multiple manifests.
- [ ] Fixed → exactly one `v<X.Y.Z>` tag; independent → one
      `<package>@<X.Y.Z>` tag per released package and none for unchanged ones.
- [ ] The tag format matches the map's `Tag format` row and the policy.
- [ ] The last tag for each scope was read with the matching
      `--match`/`describe` command.
- [ ] The changelog location matches the map (workspace or per package).
- [ ] Dependency order was respected; a failed package stopped the train.
- [ ] Every tag was reported and confirmed before creation; nothing was pushed.
- [ ] Standalone repositories kept the single-package behavior.

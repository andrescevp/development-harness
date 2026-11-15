# Workspace index — routing cgr queries to the right graph

`dh-code-query` answers from an indexed code graph. In a monorepo there may be
one workspace index and/or one index per package, and a query against the wrong
one returns false negatives. This file fixes the routing rules; `dh-setup`
installs and indexes, and its reference
[`code-graph-rag.md`](../../dh-setup/references/code-graph-rag.md) owns the
commands.

## Inputs

| Input | Used for |
|---|---|
| `WORKSPACE.md`, else `docs/WORKSPACE.md` → `## Code-graph scope` | `Index: workspace \| per package`, included/excluded paths |
| `## Packages` table | Package roots and names |
| `## Workspace Impact` in the active plan | Which packages the question is about |
| `cgr status` | Which projects exist and when each last synced |

Read order: plan section → map → `cgr status`. No map and no markers:
standalone (single project, today's behavior).

## Index models

| Model | What cgr holds | How it is built | Scope of the answer |
|---|---|---|---|
| Workspace index (one repo) | one project for the whole repository | `cgr start --repo-path <workspace_root> --update-graph` | every package in the repo |
| Per-package index | one project per package root | `cgr start --repo-path <package_root> --update-graph` per package | that package only |
| Named cgr workspace | several projects grouped under a name | `cgr workspace create <name>`; `cgr workspace add-repo <name> <path>` per package; index each repo with `cgr start --repo-path <path> --update-graph` (`cgr start --workspace <name> --update-graph` opens the interactive assistant after syncing) | every project in the group |

A named cgr workspace is a **group**, not a merged index: each repository keeps
its own project (`<dir>__<hash>`), and qualified names stay project-prefixed.
Workspace state lives in `~/.cgr/workspaces/<name>.toml`.

## Routing table

| Question | Route | Command |
|---|---|---|
| One affected package (`apps/web`) | package project | `cgr graph callers <name> --repo-path apps/web` (or `--project <name>`) |
| Root/shared file or workspace-wide architecture | workspace project | `cgr ... --repo-path <workspace_root>` |
| Cross-package dependency or call | workspace project when it holds all packages; otherwise one query per project | `--project` per project, then merge |
| Whole-group structural report | named cgr workspace | `cgr stats --workspace <name>`; `cgr export --workspace <name>` |
| Natural-language question across packages | named cgr workspace session | `cgr start --workspace <name> --ask-agent "<question>" --output-format json` |
| Availability or staleness | every project | `cgr status` |

Rules:

- **Deterministic `cgr graph` queries are single-project.** They select a
  project with `--project` or `--repo-path`, not `--workspace`; for several
  projects run the query once per project, merge the rows, and label each row
  with its project.
- **Default to the workspace index** when it exists and the question is not
  package-scoped; use the **package index** when the user names a package or
  `## Workspace Impact` names exactly one.
- **Require an explicit scope when several indexes exist** and the question is
  ambiguous: list the projects from `cgr status` and ask. Never guess the index.
- **Same name, several projects:** qualify the name
  (`<project>.<package>.<symbol>`) or narrow with `--project`; matches from two
  projects are ambiguity, not a definition.
- `cgr workspace add-repo` takes a repository root. Adding a package of an
  already-indexed repository creates a second project with duplicate symbols —
  use the per-package model only when the map says `per package`.

## Stale checks

A negative answer is only as good as the last sync.

1. `cgr status` lists each project and its last sync time; `(missing)` marks a
   project whose checkout moved or was deleted (re-index it, do not query it).
2. Compare the last sync with the files the question touches:
   `git log -1 --format=%cI -- <path>` and `git status --porcelain -- <path>`
   (uncommitted edits are never in the graph).
3. Stale or dirty → re-sync before querying:
   `cgr start --repo-path <project root> --update-graph`, or
   `cgr start --workspace <name> --update-graph` for a group, or keep
   `cgr watch` running.
4. Report staleness in the answer instead of presenting a stale negative as
   absence.

## Answer template — scope line

Every answer carries one line naming the index it used:

```markdown
**Scope:** workspace index `shop__1a2b3c4d` (workspace root) — all packages
```

```markdown
**Scope:** package index `web__5e6f7a8b` (`apps/web`) — `services/api` not queried
```

Also state the sync time, the question, `path:line` evidence, and any project
that was not queried. A cross-project answer lists every project that
contributed.

## Standalone fallback

No map and no markers: one project, `$PWD` is its root, `cgr status` is the only
scope check, and the scope line names that single project. Nothing here
requires a standalone repository to create a cgr workspace.

## Validation checklist

- [ ] The map's `## Code-graph scope` was read and the index model is named in
      the answer.
- [ ] The project was resolved with `cgr status` before querying; a missing
      project stopped the query.
- [ ] `--repo-path`/`--project` selected the right project; no `--workspace`
      was passed to a `cgr graph` query.
- [ ] Multiple projects → explicit scope or a per-project merge, never a guess.
- [ ] Sync time was checked against the queried paths; stale or dirty graphs
      were re-synced or reported.
- [ ] The scope line names the index, the project and the packages not
      queried.
- [ ] Standalone repositories kept the single-project behavior.

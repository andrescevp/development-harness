---
name: dh-code-query
description: >
  Query a project's code knowledge graph with code-graph-rag (`cgr`): resolve
  definitions, trace callers/callees/importers, find implementors/overrides,
  locate tests, and report dead code or duplicates. Use when a task needs
  graph-backed structural answers before reading files, reviewing a change, or
  planning an edit. Setup and indexing belong to dh-setup.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: bash, read
metadata:
  audience: developers
  workflow: exploration
---

# Code Graph Query

Use [code-graph-rag](https://github.com/vitali87/code-graph-rag) (`cgr`) to
answer structural questions about an indexed project. This skill covers
**querying only**. Installation, language extras, SQLite configuration, graph
indexing, and MCP wiring are owned by `dh-setup` — see
[`../dh-setup/references/code-graph-rag.md`](../dh-setup/references/code-graph-rag.md).

Assumption: `dh-setup` has installed `cgr` and indexed the current project.
If `cgr status` does not list the project, ask for setup before querying.

## Deterministic Queries (Preferred)

These commands use fixed graph queries, print JSON, and need no LLM. Prefer
them whenever the symbol or location is known.

```bash
cgr graph resolve <name-or-path:line>
cgr graph definition <qualified-name>
cgr graph callers <qualified-name> [--depth N]
cgr graph callees <qualified-name> [--depth N]
cgr graph implementors <qualified-name> [--depth N]
cgr graph overrides <qualified-name> [--depth N]
cgr graph importers <qualified-name>
cgr graph tests-reaching <qualified-name>
```

Query rules:

- **Resolve first.** Turn a bare name or `path:line` into a qualified name with
  `cgr graph resolve`, then query that exact name.
- **Start at depth 1.** Increase `--depth` only to answer a specific transitive
  question (who calls the callers, what the callees call).
- **Read the exit status.** `[]` means the name exists in the graph and nothing
  matches; exit `3` means the project is not indexed; exit `4` means the target
  name is not in the graph. Report the difference instead of collapsing both
  into "not found".
- **Treat rows as candidates.** A definition, import, or reference edge is not
  proof of a call. Confirm call sites in the source before reporting them.
- **Cite evidence.** Return `path:line` from the JSON result in the answer.

## Structural Reports

```bash
cgr dead-code --repo-path "$PWD" --format json
cgr duplicates --repo-path "$PWD" --format json --threshold 0.8 --min-size 15
cgr stats --repo-path "$PWD"
cgr export -o /tmp/code-graph.json --repo-path "$PWD"
```

- **Dead code:** the report lists candidates, not a delete list. Dynamic
  dispatch, reflection, string-keyed lookups, and external frameworks can make
  live code look unreachable. For applications/services, add
  `--no-public-roots`; declare framework entry points with
  `--entry-point` / `--decorator-root`; use `--fail-on-found` only in CI.
- **Duplicates:** `--exact-only` reports certain clones; tune `--threshold`
  (0–1) and `--min-size` for near-duplicates; `--open N` shows the first two
  members in the editor.
- **Stats:** confirms the graph has nodes and relationships before trusting a
  negative answer.
- **Export:** write outside the repository (for example `/tmp`) so the export
  is not re-indexed. Scope with `--project` or `--repo-path`.

## Context And Change Checks

```bash
cgr context <symbol-or-location>    # graph-ranked context slice
cgr check <git-ref>                 # structural delta vs a ref
```

Run `cgr help context` / `cgr help check` for the full option set. Use
`cgr context` before editing a symbol to pull its source, caller lines, callee
signatures, types, tests, and docs within a token budget. Use `cgr check` to
find dangling callers/importers, arity changes, new duplicates, and new import
cycles against a base ref.

## Natural-Language Queries

Use these only when a deterministic query cannot express the question. They
require the model configuration that `dh-setup` established; if no provider is
available, fall back to the deterministic commands rather than inventing an
answer.

```bash
cgr start --repo-path "$PWD" --ask-agent "Which functions handle authentication?" --output-format json
cgr start --repo-path "$PWD"
```

- The generated Cypher may be narrower than the question. Inspect the returned
  `query_used`, treat rows as candidates, and cross-check suspiciously short
  results with `rg` / `dh-explore`.
- The interactive session can read files and edit code. For a read-only answer,
  prefer `--ask-agent` or the deterministic commands.
- Query results reflect the last graph sync. If files changed since the sync,
  a negative result is not trustworthy — request a sync first.

## Optional MCP Query Interface

When `dh-setup` wired the read-only MCP server, the same graph is available as
MCP tools: `resolve`, `definition`, `callers`, `callees`, `implementors`,
`overrides`, `importers`, `tests-reaching`, `find_duplicate_code`,
`get_code_snippet`, and `query_code_graph`. The deterministic tools need no
LLM. Configure nothing from this skill; use the server that setup registered.

## Examples

| Question | Command |
|---|---|
| Where is `createUser` defined? | `cgr graph resolve createUser` → `cgr graph definition <qualified-name>` |
| Who calls `UserService.create_user`? | `cgr graph callers UserService.create_user` |
| What does `parse_config` call? | `cgr graph callees parse_config` |
| Which classes implement `Repository`? | `cgr graph implementors Repository --depth 2` |
| Which methods override `save`? | `cgr graph overrides save` |
| What imports `pkg.auth`? | `cgr graph resolve pkg.auth` → `cgr graph importers <qualified-name>` |
| Which tests reach `parse_config`? | `cgr graph tests-reaching parse_config` |
| Give me context to edit `login` | `cgr context login` |
| What changed structurally vs `main`? | `cgr check main` |
| Is there dead code in this service? | `cgr dead-code --repo-path "$PWD" --no-public-roots --format json` |
| Where is this logic duplicated? | `cgr duplicates --repo-path "$PWD" --format json` |
| Find authentication code by intent | `cgr start --repo-path "$PWD" --ask-agent "Find authentication code" --output-format json` |

## Workflow

1. Confirm `cgr status` lists the current project; if not, ask for setup.
2. Resolve the symbol or location first.
3. Run the narrowest deterministic query that answers the question.
4. Verify candidates in the source (read the file or fetch the snippet).
5. Report the query, project, and `path:line` evidence.
6. If the files changed after the last sync, ask for a sync before trusting a
   negative result.

## Output Template

```markdown
## Code graph answer

**Project:** <name> (synced <last sync>)
**Question:** <what was asked>

**Finding:** <direct answer>

**Evidence:**
- `path/to/file.ts:42` — <symbol> (<relationship: caller/definition/importer>)
- ...

**Caveats:** <stale graph, unverified candidates, dynamic dispatch, ...>
```

## Result Safety

- Never present dead-code or duplicate output as safe-to-delete.
- Never turn a candidate row into a claim without source verification.
- Never claim a symbol is unused because one query returned no rows; check the
  project scope, sync freshness, and depth first.
- Do not use graph output as the sole basis for a destructive change.

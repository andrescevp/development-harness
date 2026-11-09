# code-graph-rag Setup (dh-setup reference)

Setup, configuration, and lifecycle for the code knowledge graph used by the
`dh-code-query` skill. Source: [code-graph-rag guide](https://github.com/vitali87/code-graph-rag/blob/main/docs/guide).

## Backend Policy — SQLite Only

Every project uses the embedded SQLite backend. It needs no server, no Docker,
and no `cmake`.

```bash
GRAPH_BACKEND=sqlite
CGR_VECTOR_STORE_BACKEND=sqlite
```

- Never install the `memgraph` or `neo4j` extras.
- Never set `GRAPH_BACKEND=memgraph` / `neo4j` and never run `cgr daemon up`.
- The graph lives in `~/.cgr/graph.sqlite` (override with
  `SQLITE_GRAPH_PATH`); vectors live in `~/.cgr/vectors.sqlite` (override with
  `SQLITE_VECTOR_PATH`).
- The file is shared: every indexed repository is a separate project named
  `<dir>__<hash>`, so one SQLite DB serves all projects without mixing them.
- `cgr doctor` may still print Docker/Memgraph checks; ignore them when the
  backend is SQLite as long as `cgr status` and `cgr graph` work.

## Prerequisites

- Python 3.12+ (the `cgr-graph-rs` native extension ships for Linux
  x86_64/aarch64, macOS, and Windows x64).
- `ripgrep` (`rg`) on `PATH`.
- `uv` (required by this harness) or `pipx`.
- No database container, no Memgraph, no Qdrant.

## Language Extras

Detect the project's languages, then install the smallest extra set that covers
them:

| Detected languages | Extra |
|---|---|
| Python (base), JavaScript, TypeScript/TSX, Rust, Go, Java, C, C++, C#, PHP, Lua, Dart, Julia | `treesitter-full` |
| Ruby, Kotlin, Swift, Elixir, Haskell, Solidity, Bash, Nix | `ast-grep` |
| C/C++ with a `compile_commands.json` (opt-in semantic facts) | `cpp` |
| Semantic search (UniXcoder embeddings, SQLite vector store) | `semantic` |

Notes:

- Python is covered by the base package; every other fully supported language
  needs `treesitter-full`.
- The `ast-grep` tier is structural: modules, functions, and classes only, with
  no call graph. Dead-code and caller analysis skip those files and report how
  many symbols were not analyzed.
- Add `semantic` when queries should match by intent.
- Add `cpp` only when a compilation database exists and the user opts in.

## Install / Upgrade

`uv tool install` is user-level: one `cgr` binary serves every project. Build
the spec from the detected extras:

```bash
# Python only
uv tool install --compile-bytecode code-graph-rag

# TypeScript/JavaScript project
uv tool install --compile-bytecode "code-graph-rag[treesitter-full]"

# Mixed TS + Ruby, with semantic search
uv tool install --compile-bytecode "code-graph-rag[treesitter-full,ast-grep,semantic]"

# C/C++ semantic mode (only when compile_commands.json exists)
uv tool install --compile-bytecode "code-graph-rag[treesitter-full,cpp]"
```

- `--compile-bytecode` avoids a slow first run after install or upgrade.
- Upgrade with `uv tool upgrade code-graph-rag`; extras are preserved.
- An upgrade never adds an extra. If a new language appears, reinstall with
  the full spec.
- `pipx` fallback: `pipx install "code-graph-rag[...]"`; upgrade with
  `pipx upgrade code-graph-rag` (or `pipx reinstall` for a git install).

## Verify

```bash
cgr --version
GRAPH_BACKEND=sqlite cgr doctor
cgr language list-languages
cgr status
```

- `cgr language list-languages` shows every language, its tier, and whether
  this install can parse it. A language marked `no` needs its extra.
- Report unsupported languages explicitly; do not claim full-graph coverage
  for structural-tier files.
- `cgr doctor` checks dependencies and configuration. Treat Docker/Memgraph
  checks as not applicable under the SQLite policy.

## Index / Update

```bash
# First index or incremental sync; parses, syncs, exits
cgr start --repo-path "$PWD" --update-graph

# Verify the project is registered and has content
cgr status
cgr stats --repo-path "$PWD"

# Keep the graph fresh while editing
cgr watch --repo-path "$PWD"
```

- Run from the repository root. Project names are derived from the directory
  plus a path hash, so two checkouts do not overwrite each other.
- Use `--project-name` only when a stable shared name is required; syncing a
  repository under a name another repository already indexes needs `--yes`.
- Re-run the update after edits, or leave `cgr watch` running in a separate
  terminal. A graph answer is only as current as the last sync.
- `cgr start --update-graph` refuses `$HOME`, `/`, and a project name owned by
  another repository unless `--yes` is given. Do not bypass that guard.

## Exclusions And Ignore Rules

- Repeatable `--exclude PATTERN` on `cgr start` / `cgr index`.
- `.cgrignore` at the repository root for persistent ignore rules.
- Exclude generated/vendor/build output, caches, and any file containing
  secrets. Never index `.env`, credentials, private keys, or `.git/config`.
- cgr keeps its own state under `CGR_HOME` (default `~/.cgr`), outside the
  indexed repository.

## Destructive Operations

- `cgr start --clean` deletes **every** project in the shared graph, not just
  the current one. Require explicit user confirmation before using it; in
  scripts pass `--yes` only after that confirmation.
- To rebuild a single project: `cgr delete-project --repo-path "$PWD"`, then
  index again. Other projects are preserved.
- `cgr prune` removes projects whose repository root no longer exists; review
  the list before confirming.

## LLM-Backed Queries (Optional)

Deterministic `cgr graph` commands need no model. The interactive assistant and
`--ask-agent` need an orchestrator and a Cypher model:

```bash
ORCHESTRATOR_PROVIDER=ollama
ORCHESTRATOR_MODEL=qwen2.5-coder
ORCHESTRATOR_ENDPOINT=http://localhost:11434/v1

CYPHER_PROVIDER=ollama
CYPHER_MODEL=qwen2.5-coder
CYPHER_ENDPOINT=http://localhost:11434/v1
```

- Set each role's provider and model together; setting only one is an error.
- With neither set, cgr uses the local Ollama default (`llama3.2`); ensure
  Ollama is running and the model is pulled.
- Hosted providers use `openai`, `google`, `anthropic`, `azure`, `minimax`, or
  `litellm_proxy` with the matching `*_API_KEY`.
- Do not write API keys into a repository `.env` that may be indexed. Use the
  user's environment or a secret manager.

## Optional Read-Only MCP Server

Wire only with user consent. Use an absolute `cgr` path (`which cgr`) so
GUI-launched clients find it:

```jsonc
"cgr": {
  "type": "local",
  "command": ["/absolute/path/to/cgr", "mcp-server", "--read-only"],
  "environment": {
    "TARGET_REPO_PATH": "/absolute/path/to/project",
    "GRAPH_BACKEND": "sqlite",
    "MCP_READ_ONLY": "true"
  }
}
```

- `--read-only` (or `MCP_READ_ONLY=true`) hides indexing, edit, annotate, and
  delete tools. Deterministic query tools need no model; only
  `query_code_graph` and `ask_agent` do.
- Keep `CGR_ALLOW_SENSITIVE_READS` and `CGR_ALLOW_SENSITIVE_WRITES` unset unless
  the user explicitly approves access to credential-like files.
- For a workspace, add `--workspace NAME` or `MCP_WORKSPACE=NAME`.
- After changing the capture configuration, restart the server and re-index;
  indexing and update tools do not accept a capture argument.

## Setup Checklist

- [ ] `cgr --version` succeeds.
- [ ] Extras cover every detected language; `cgr language list-languages` shows
      them as parseable.
- [ ] `GRAPH_BACKEND=sqlite`; no Memgraph/Neo4j extra, no `cgr daemon`.
- [ ] `cgr start --repo-path "$PWD" --update-graph` completed without errors.
- [ ] `cgr status` lists the project and `cgr stats` reports non-zero nodes.
- [ ] Exclusions cover generated/vendor output and secrets.
- [ ] `dh-code-query` can resolve a known symbol in the project.
- [ ] Optional MCP server is read-only and wired only on user decision.

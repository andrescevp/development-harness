---
name: dh-preflight
description: >
  Run tests, linters, static analysis as a release gate: auto-detect tooling, check dirty state, pass/fail verdict with actionable failures (no auto-fixes). Use to run preflight, pre-release check, or validate before release.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: bash, read
metadata:
  audience: developers
  workflow: development
---

## Core Rules

- Use the `@dh-executor` subagent to run all commands — never run bash directly
- Detect the project's tooling automatically:
  - **Python:** `pytest` / `uv run pytest`, `ruff check`, `mypy`
  - **JavaScript/TypeScript:** `npm test` / `pnpm test`, `eslint`, `tsc --noEmit`
  - **Rust:** `cargo test`, `cargo clippy`, `cargo fmt --check`
  - **Go:** `go test ./...`, `golangci-lint run`
  - **Shell:** `shellcheck` on scripts
- If a tool is not installed or configured, skip it — do not install globally
- Check `git status --porcelain` for uncommitted changes
- Report each tool result independently; aggregate into a single pass/fail
- If any tool fails: report exact file, line, and error message
- Do not fix failures — report them and let the user decide

## Output Template

```markdown
# Pre-flight Report

| Check | Result | Details |
|---|---|---|
| Unit tests | ✅ Pass | XX passed, 0 failed |
| Integration tests | ✅ Pass / ⏭️ Skipped | ... |
| Linter | ✅ Pass / ❌ Fail | [file:line: message] |
| Static analysis | ✅ Pass / ❌ Fail | [file:line: message] |
| Format check | ✅ Pass / ❌ Fail | [files with issues] |
| Clean state | ✅ Pass / ⚠️ Dirty | [uncommitted files] |

**Verdict:** ✅ READY / ❌ BLOCKED — [N] failure(s)

## Failures (if any)
- `path/to/file.ext:line` — [error message]
```

## Safety

- Do not run destructive commands (clean, reset, force push)
- Do not modify code to fix failures
- Do not install tools system-wide without asking
- Report timeouts as failures with the tool name

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to `@dh-documentor` — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).

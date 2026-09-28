---
name: preflight
description: >
  Execute the complete test suite, linters, and static analysis tools as a
  formal pre-release gate — auto-detecting the project's tooling, checking for
  uncommitted changes or dirty state, and producing a single pass/fail verdict
  with per-tool results and actionable failure details (blocking release on any
  failure without auto-fixing). Use when preparing a release, running CI checks
  locally, invoked by /release as step 2, or when the user asks "run preflight",
  "pre-release check", "validate before release", "gate check",
  "is this ready to release?", or "run all checks".
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: bash, read
metadata:
  audience: developers
  workflow: development
---

## Core Rules

- Use the `@executor` subagent to run all commands — never run bash directly
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

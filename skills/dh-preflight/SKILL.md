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

- Use the `dh-execute-cli` skill to run all commands — never run bash directly
- Detect the project's tooling automatically:
  - **Python:** `pytest` / `uv run pytest`, `ruff check`, `mypy`
  - **JavaScript/TypeScript:** `npm test` / `pnpm test`, `eslint`, `tsc --noEmit`
  - **Rust:** `cargo test`, `cargo clippy`, `cargo fmt --check`
  - **Go:** `go test ./...`, `golangci-lint run`
  - **Shell:** `shellcheck` on scripts
- If a tool is not installed or configured, skip it — do not install globally
- Check `git status --porcelain` for uncommitted changes
- **Impact triage (read-only, when indexed):** use the `dh-code-query` skill (`tests-reaching`, `callers`, `importers`) on the changed symbols to understand what the gate exercises and what it might miss. This prioritizes attention; it does not replace running the full configured gate.
- Report each tool result independently; aggregate into a single pass/fail
- If any tool fails: report exact file, line, and error message
- Do not fix failures — report them and let the user decide

## Workspace-Aware Gates

- Read `## Workspace Impact` from the active plan (`dh_plan_read`) and the
  workspace map (`WORKSPACE.md`) at the workspace root; the plan declares the
  affected packages, the map supplies their exact commands. Command matrix,
  selection rules and checklist:
  [`references/workspace-gates.md`](references/workspace-gates.md).
- Run each affected package's command (affected mode) or the workspace
  aggregate when the plan is workspace-wide; report every affected package on
  its own row as pass / fail / skipped.
- Never report green for an unvalidated package: a skipped package needs its
  recorded reason, and a green aggregate never covers a package whose own
  command did not run.
- A package listed in `## Workspace Impact` with no map row, no command, or a
  path that does not exist is `unknown package` → **FAIL**, never skipped.
- Run commands from the workspace root; confirm the session base is the
  workspace root before starting (a package-level cwd is a hard stop).
- **Standalone** (no map, no affected packages): keep the single-root behavior
  and single-table report below unchanged.

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

## Package Gates (workspace only)
| Package | Command | Result | Details |
|---|---|---|---|
| `apps/web` | `pnpm --filter web test` | ✅ Pass / ❌ Fail / ⏭️ Skipped | [reason when skipped] |

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

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).

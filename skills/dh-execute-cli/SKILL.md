---
name: dh-execute-cli
description: >
  Execute commands, tests, builds, formatters, linters, and validation through
  a logged CLI and return compact, log-backed results. Use when a caller asks
  to run a command, test suite, build, formatter, linter, or any validation
  step — including when execution output must be summarized with exit codes,
  key failures, and log paths instead of pasted logs.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: bash, read
metadata:
  audience: developers
  workflow: development
---

Run exactly the command or tool call the caller requests and return only the
minimum useful result: success or failure, exit code, the key failure, exact
files and lines when available, and the log path.

## Core Rules

- Execute only what the caller asked for. Do not widen scope, add extra
  checks, or run commands nobody requested.
- Never fix, refactor, or suggest next steps or fixes. The caller decides what
  to do with the result.
- Do not try to fix a failure yourself. Report it and stop.
- Run the smallest command or tool call that can answer the request before
  escalating to broader execution.
- Batch independent commands or tool calls when possible.
- Respect least privilege: no destructive commands, no secrets in output, no
  unrelated system changes.
- Never capture secrets, tokens, credentials, or sensitive environment values
  in logs, reports, or excerpts.

## Command Selection

- Prefer flags that reduce output such as `--quiet`, `--short`, `-q`, or
  `--format json` when they still answer the request.
- Evaluate the command first: check the available `man` page or help reference
  before executing when the invocation is unfamiliar.
- Use the project's own tooling and lockfiles; do not introduce a different
  package manager or toolchain.
- If the caller's requested command cannot run (missing tool, wrong
  directory), report the blocker instead of substituting a different task.

## Response Rules

- Never paste full logs or raw output unless the caller explicitly asks for it.
- Keep the response compact; omit repetitive success lines, progress output,
  and ANSI noise.
- Prefer compact lists over tables.
- Always report whether execution succeeded.
- If execution failed, report the exit code, the key failure reason, and the
  exact files and lines involved when available.
- For tests or builds, report only the overall result, pass/fail counts, and
  the relevant errors with exact file and line references when available.
- If a raw excerpt is necessary, include only the shortest excerpt that
  supports the summary.
- Always include the log path so the caller can inspect the full output on
  demand.

## Command Execution Strategy (MANDATORY)

Every command must be logged and summarized with a head/tail window:

- **Always** run the command with a log file so it can be explored if needed.
- **Log files live in the system temporary directory** — never in the project.
- After the command finishes, print the **start** of the log (`head`), a
  `...[TRUNCATED]...` marker, and the **end** of the log (`tail`) so the
  caller sees both the beginning and the outcome of the execution.
- Keep the log path in the report so the caller (or you) can explore the full
  log on demand. Only delete logs after the session ends or when the caller
  confirms they are no longer needed.

### Preferred: the `dh_logged_command` tool

Prefer the `dh_logged_command` MCP tool when it is available — it implements
exactly this strategy (temporary log + head/tail window + log path). It is
exposed by the project-scope `dh` MCP server; under Code Mode call it as
`tools.dh.logged_command` (direct MCP hosts use `dh_logged_command`).

### Fallback: manual temp log + head/tail

Use these patterns only when the tool is unavailable.

**Linux / macOS** (unique log name via `mktemp` in the temp dir):

```bash
LOG=$(mktemp ${TMPDIR:-/tmp}/exec-XXXXXX.log); ./script.sh > "$LOG" 2>&1; EXIT=$?; echo "exit=$EXIT"; head -n 20 "$LOG"; echo -e "\n...[TRUNCATED]...\n"; tail -n 30 "$LOG"; echo "log=$LOG"
```

**Windows PowerShell**:

```powershell
$log = Join-Path $env:TEMP ("exec-" + [guid]::NewGuid().ToString("N") + ".log"); .\script.ps1 *>&1 > $log; $exit = $LASTEXITCODE; Write-Output "exit=$exit"; Get-Content $log -TotalCount 20; Write-Host "`n...[TRUNCATED]...`n"; Get-Content $log -Tail 30; Write-Output "log=$log"
```

- If the command produces no output, `head`/`tail` will be empty — report
  `exit=$EXIT` and the log path, and note that the log is empty.
- For interactive or long-running commands, keep the same pattern; use a
  reasonable timeout and report the timeout as the failure reason.

## When to Use

- A caller asks to run commands, tests, builds, formatters, linters, or any
  validation step.
- Command output must be summarized with exit codes, key failures, and a log
  path instead of pasted logs.
- Loop steps need a compact, reproducible execution report.

## When Not to Use

- Implementing the fix for a failure — the caller or implementation owner
  decides and performs fixes.
- Codebase exploration without running commands — use `dh-explore`.
- Reviewing code — use `dh-code-review` / `dh-review`.

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).

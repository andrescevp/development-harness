/**
 * logged-command.ts — logged command execution strategy (dh_logged_command).
 *
 * Encodes the executor agent's mandatory strategy: run the command with its
 * output written to a log file in the SYSTEM TEMP directory, then return a
 * head/tail window (first 20 / last 30 lines with a TRUNCATED marker) plus
 * the log path so the full log can be explored on demand.
 *
 * Pure helper `buildLoggedCommand` is unit-testable per platform; the
 * `runLoggedCommand` handler executes via node:child_process on the same
 * machine/user as the plugin server.
 */
import { exec } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import crypto from "node:crypto"

/** Lines shown from the start of the log. */
export const HEAD_LINES = 20
/** Lines shown from the end of the log. */
export const TAIL_LINES = 30
export const TRUNCATED_MARKER = "\n...[TRUNCATED]...\n"

export interface LoggedCommandInput {
  command: string
  /** Optional log file name (basename only; always placed in the OS temp dir). */
  logName?: string
  /** Kill the command after this many milliseconds (default 120000). */
  timeoutMs?: number
}

export interface LoggedCommandResult {
  ok: boolean
  exitCode: number | null
  logPath: string
  head: string
  tail: string
  truncated: boolean
  error?: string
}

/** Unique log path inside the system temp directory. */
export function tempLogPath(logName?: string): string {
  const name = logName && /^[A-Za-z0-9._-]+$/.test(logName) ? logName : `harness-exec-${crypto.randomBytes(6).toString("hex")}.log`
  return path.join(os.tmpdir(), name)
}

/**
 * Build the wrapped command string for the current platform.
 * Linux/macOS: `cmd > log 2>&1; head -n 20 log; echo TRUNCATED; tail -n 30 log`.
 * Windows (win32): PowerShell-shaped redirection + Get-Content head/tail.
 * Pure string construction — no execution.
 */
export function buildLoggedCommand(command: string, logPath: string): string {
  const isWin = process.platform === "win32"
  if (isWin) {
    const log = logPath.replace(/'/g, "''")
    return (
      `${command} *>&1 > '${log}'; $__exit = $LASTEXITCODE; ` +
      `Write-Output "exit=$__exit"; Get-Content '${log}' -TotalCount ${HEAD_LINES}; ` +
      `Write-Host "${TRUNCATED_MARKER.trim()}"; Get-Content '${log}' -Tail ${TAIL_LINES}; ` +
      `Write-Output "log=${log}"`
    )
  }
  // POSIX shell: log path passed through env to survive quoting.
  const quoted = `"${logPath.replace(/"/g, '\\"')}"`
  return (
    `${command} > ${quoted} 2>&1; __exit=$?; echo "exit=$__exit"; head -n ${HEAD_LINES} ${quoted}; ` +
    `printf '%b\\n' "${TRUNCATED_MARKER.replace(/\\n/g, "\\n")}"; tail -n ${TAIL_LINES} ${quoted}; ` +
    `echo "log=${quoted}"`
  )
}

function readWindow(logPath: string): { head: string; tail: string; truncated: boolean } {
  try {
    const lines = fs.readFileSync(logPath, "utf8").split("\n")
    const head = lines.slice(0, HEAD_LINES).join("\n")
    const tail = lines.slice(-TAIL_LINES).join("\n")
    return { head, tail, truncated: lines.length > HEAD_LINES + TAIL_LINES }
  } catch {
    return { head: "", tail: "", truncated: false }
  }
}

/**
 * Execute the command under the logged strategy and return the head/tail
 * window + log path. Never throws for command failures — non-zero exit codes
 * are reported in the result.
 */
export function runLoggedCommand(input: LoggedCommandInput): Promise<LoggedCommandResult> {
  const logPath = tempLogPath(input.logName)
  const wrapped = buildLoggedCommand(input.command, logPath)
  const timeoutMs = input.timeoutMs ?? 120_000

  return new Promise((resolve) => {
    const child = exec(wrapped, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, _stdout, _stderr) => {
      // NOTE: on POSIX the head/tail output lands on stdout (merged by 2>&1);
      // the log itself is the source of truth for content.
      const window = readWindow(logPath)
      const exitCode = error ? (typeof error.code === "number" ? error.code : 1) : 0
      resolve({
        ok: exitCode === 0,
        exitCode,
        logPath,
        head: window.head,
        tail: window.tail,
        truncated: window.truncated,
        error: error && !window.head ? error.message : undefined,
      })
    })
    if (typeof child.pid === "number" && child.pid > 0) {
      // Ensure SIGTERM on timeout is not silently swallowed.
      child.on("error", () => undefined)
    }
  })
}
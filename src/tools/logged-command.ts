/**
 * logged-command.ts — logged command execution strategy (dh_logged_command).
 *
 * Streams the child's stdout and stderr directly into the log while the process
 * tree runs, instead of shell-redirecting to a file. That keeps buffered writes
 * and output from background children: the handler waits for the stdio streams
 * to close, then returns a head/tail window plus the log path so the full output
 * can be explored.
 *
 * Pure helpers stay unit-testable; the `runLoggedCommand` handler executes via
 * node:child_process on the same machine/user as the MCP server.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Lines shown from the start of the log. */
export const HEAD_LINES = 20;
/** Lines shown from the end of the log. */
export const TAIL_LINES = 30;

export interface LoggedCommandInput {
  command: string;
  /** Optional log file name (basename only; always placed in the OS temp dir). */
  logName?: string;
  /** Kill the command after this many milliseconds (default 120000). */
  timeoutMs?: number;
}

export interface LoggedCommandResult {
  ok: boolean;
  exitCode: number | null;
  logPath: string;
  head: string;
  tail: string;
  truncated: boolean;
  error?: string;
}

/** Unique log path inside the system temp directory. */
export function tempLogPath(logName?: string): string {
  const name =
    logName && /^[A-Za-z0-9._-]+$/.test(logName)
      ? logName
      : `harness-exec-${crypto.randomBytes(6).toString('hex')}.log`;
  return path.join(os.tmpdir(), name);
}

function readWindow(logPath: string): { head: string; tail: string; truncated: boolean } {
  try {
    const lines = fs.readFileSync(logPath, 'utf8').split('\n');
    const head = lines.slice(0, HEAD_LINES).join('\n');
    const tail = lines.slice(-TAIL_LINES).join('\n');
    return { head, tail, truncated: lines.length > HEAD_LINES + TAIL_LINES };
  } catch {
    return { head: '', tail: '', truncated: false };
  }
}

/** Kill the child and its descendants so a timeout cannot leave writers behind. */
function killTree(child: ChildProcess): void {
  if (typeof child.pid !== 'number') return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }).unref();
    return;
  }
  try {
    // The child is detached into its own process group on POSIX.
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

/**
 * Execute the command while streaming stdout/stderr into the log. Waits for
 * `close` (all stdio streams closed), not just shell `exit`, so buffered and
 * background-child writes are included. Never throws for command failures.
 */
export function runLoggedCommand(input: LoggedCommandInput): Promise<LoggedCommandResult> {
  const logPath = tempLogPath(input.logName);
  const timeoutMs = input.timeoutMs ?? 120_000;

  return new Promise((resolve) => {
    const log = fs.createWriteStream(logPath, { flags: 'w' });
    const child = spawn(input.command, {
      shell: true,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let settled = false;
    let timedOut = false;
    let spawnError: Error | undefined;
    let fallback: NodeJS.Timeout | undefined;

    const finish = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (fallback !== undefined) clearTimeout(fallback);
      const exitCode = timedOut ? 124 : (code ?? (signal === null ? 0 : 1));
      log.end(() => {
        const window = readWindow(logPath);
        resolve({
          ok: !timedOut && !spawnError && exitCode === 0,
          exitCode,
          logPath,
          head: window.head,
          tail: window.tail,
          truncated: window.truncated,
          error: spawnError?.message ?? (timedOut ? `timed out after ${timeoutMs} ms` : undefined),
        });
      });
    };

    child.stdout?.pipe(log, { end: false });
    child.stderr?.pipe(log, { end: false });
    child.on('error', (error) => {
      spawnError = error;
    });
    child.on('close', finish);

    const timeout = setTimeout(() => {
      timedOut = true;
      killTree(child);
      // A grandchild can keep the pipes open; finalize with the partial log.
      fallback = setTimeout(() => finish(null, null), 2_000);
    }, timeoutMs);
  });
}

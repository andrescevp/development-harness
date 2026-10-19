/**
 * plan-io.ts — plan-file I/O helpers (fd-based read + index append).
 *
 * Final-component symlinks are refused at open time (`O_NOFOLLOW`): the path
 * ACL pre-checks entries, and these fd-based opens close the check-then-use
 * race for the final component (parent-component swaps remain accepted
 * residual). Synchronous on purpose: callers keep read-modify-write free of
 * awaits.
 */
import fs from 'node:fs';
import { assertNoSymlinks, planIndexFile, requireWorkspaceRoot, traversalError } from './plan-paths.js';
import { INITIAL_PHASE_STATUS } from './plan-template.js';

/**
 * Read a plan file. A final-component symlink maps to the ACL error
 * (`ELOOP`); every other failure keeps the descriptive legacy message.
 */
export function readPlanFile(file: string): string {
  try {
    return fs.readFileSync(file, { encoding: 'utf8', flag: fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ELOOP') throw traversalError(file, err);
    throw new Error(`plan file not readable: ${file}`, { cause: err });
  }
}

/**
 * Validate the index chain and return the index path. Used as plan_create's
 * pre-flight AND at the top of `appendPlanIndexRow` (intentional double walk:
 * fail before any write, and keep the append self-defending).
 */
export function assertPlanIndexWritable(workspaceRoot: string): string {
  requireWorkspaceRoot(workspaceRoot);
  const indexFile = planIndexFile(workspaceRoot);
  assertNoSymlinks(workspaceRoot, indexFile);
  return indexFile;
}

/**
 * Append a plan row to docs/plans/index.md (absent → no-op). The open carries
 * `O_NOFOLLOW`, closing the final-component race after the ACL pre-check.
 */
export function appendPlanIndexRow(workspaceRoot: string, slug: string, title: string): void {
  const indexFile = assertPlanIndexWritable(workspaceRoot);
  let fd: number;
  try {
    fd = fs.openSync(indexFile, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return;
    if (code === 'ELOOP') throw traversalError(indexFile, err);
    throw err;
  }
  try {
    // Backslashes first (so `\|` stays literal), then pipes, then line breaks.
    const pipeSafe = (value: string) => value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
    const cell = (value: string) => pipeSafe(value).replace(/[\r\n]+/g, ' ');
    const today = new Date().toISOString().slice(0, 10);
    const row = `| ${cell(title)} | ${cell(slug)} | ${cell(title)} | ${today} | ${today} | ${INITIAL_PHASE_STATUS} | Yes |\n`;
    // writeFileSync loops on the fd (short-write safe); O_APPEND keeps rows atomic.
    fs.writeFileSync(fd, row);
  } finally {
    fs.closeSync(fd);
  }
}

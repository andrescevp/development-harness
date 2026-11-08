/**
 * atomic-write.ts — synchronous atomic file writes for plan files.
 *
 * A same-directory temp file guarantees rename/link atomicity on POSIX (no
 * cross-filesystem copy). Temp+link (exclusive mode) means a crash can never
 * leave a partial plan at the target; a plain `wx` create would create the
 * target before the content is written. `renameSync` REPLACES a
 * final-component symlink instead of writing through it (fail-safe for the
 * plan ACL); parent-component swaps remain accepted residual. A SIGKILL
 * between temp write and commit leaves `<file>.<pid>.<hex>.tmp` behind
 * (residual accepted; best-effort swept on error paths). Synchronous on
 * purpose: callers keep their read-modify-write invariant (no await).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const MAX_TEMP_ATTEMPTS = 5;

function tempFileFor(file: string): string {
  return `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
}

/** Best-effort temp removal — it may already have been renamed away. */
function cleanupTemp(temp: string): void {
  try {
    fs.unlinkSync(temp);
  } catch {
    // Nothing to clean up (or cleanup itself failed); never mask the cause.
  }
}

/**
 * Create the temp file exclusively (`O_CREAT|O_EXCL` refuses symlinks and
 * collisions), retrying with a fresh suffix on EEXIST. The existing target's
 * mode is carried over; ownership/ACLs cannot be preserved without
 * privileges (accepted).
 */
function writeTempExclusive(file: string, contents: string): string {
  const mode = fs.statSync(file, { throwIfNoEntry: false })?.mode;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_TEMP_ATTEMPTS; attempt += 1) {
    const temp = tempFileFor(file);
    try {
      fs.writeFileSync(temp, contents, { encoding: 'utf8', flag: 'wx', mode });
      return temp;
    } catch (err) {
      // A non-EEXIST failure (e.g. EACCES) is not retryable.
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      lastError = err;
    }
  }
  // Deliberately NOT EEXIST-coded: callers map EEXIST from the TARGET commit,
  // and a temp collision must not read as "plan already exists".
  throw new Error(`no unique temp path available for: ${file}`, { cause: lastError });
}

/**
 * Shared write protocol: exclusive temp create → `commit(temp)`. The
 * overwrite commit consumes the temp (rename); the exclusive commit cleans it
 * in its own `finally`. Error paths best-effort remove the temp.
 */
function writeViaTemp(file: string, contents: string, commit: (temp: string) => void): void {
  const temp = writeTempExclusive(file, contents);
  try {
    commit(temp);
  } catch (err) {
    cleanupTemp(temp);
    throw err;
  }
}

/** Overwrite `file` atomically: same-directory temp write + rename. */
export function writeFileAtomic(file: string, contents: string): void {
  writeViaTemp(file, contents, (temp) => fs.renameSync(temp, file));
}

/** Create `file` atomically; throws `EEXIST` when it already exists. */
export function writeFileExclusiveAtomic(file: string, contents: string): void {
  writeViaTemp(file, contents, (temp) => {
    try {
      // Hard link is atomic and never clobbers an existing `file`.
      fs.linkSync(temp, file);
    } finally {
      // The temp hard link survives a successful commit; on error the shared
      // skeleton cleans it (this unlink is then a best-effort no-op).
      cleanupTemp(temp);
    }
  });
}

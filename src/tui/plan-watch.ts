/**
 * plan-watch.ts — debounced plan-tree watching with a poll fallback (§9, §9.4).
 *
 * Trailing debounce 300 ms, max wait 1,000 ms, poll 2,000 ms. Every trigger
 * compares a `(mtimeMs, size)` fingerprint so an unchanged tree skips the parse;
 * `unsubscribe` closes every watcher and timer and is idempotent.
 */
import fs from 'node:fs';
import path from 'node:path';

/** @public — refresh trigger kind recorded in `PlanState.refresh.mode`. */
export type RefreshMode = 'watch' | 'poll' | 'manual';

export interface PlanWatchOptions {
  /** `<workspaceRoot>/docs/plans`; may be missing (the poll keeps retrying). */
  plansDir: string;
  /** Called after the debounce window (immediately for `refresh()`). */
  onRefresh: (mode: RefreshMode) => void;
  debounceMs?: number;
  maxWaitMs?: number;
  pollMs?: number;
  /** Change key; defaults to `fingerprintPlanTree(plansDir)`. */
  fingerprint?: () => string;
  /** Disable `fs.watch` (deterministic tests) while keeping the poll fallback. */
  watch?: boolean;
}

export interface PlanWatcher {
  /** A change was observed: coalesce into the debounce window. */
  notify(): void;
  /** Explicit refresh (panel key): run now and reset the debounce. */
  refresh(): void;
  /** `watch` when an fs watcher is attached, else `poll`. */
  mode(): 'watch' | 'poll';
  unsubscribe(): void;
}

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_MAX_WAIT_MS = 1000;
const DEFAULT_POLL_MS = 2000;
const WATCH_DIR_CAP = 200;

/**
 * `(mtimeMs, size)` fingerprint of every markdown file under the plan tree.
 * Missing/unreadable paths contribute nothing (the tree may not exist yet).
 */
export function fingerprintPlanTree(plansDir: string): string {
  const parts: string[] = [];
  let visited = 0;
  const visit = (directory: string): void => {
    if (visited >= WATCH_DIR_CAP) return;
    visited += 1;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) visit(full);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      try {
        const stat = fs.lstatSync(full);
        parts.push(`${path.relative(plansDir, full)}:${stat.mtimeMs}:${stat.size}`);
      } catch {
        // A file removed between readdir and stat is simply absent this pass.
      }
    }
  };
  visit(plansDir);
  return parts.join('|');
}

/** Directories watched when recursive `fs.watch` is unavailable (bounded). */
function watchedDirectories(plansDir: string): string[] {
  const dirs = [plansDir];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(plansDir, { withFileTypes: true });
  } catch {
    return dirs;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (dirs.length >= WATCH_DIR_CAP) break;
    const directory = path.join(plansDir, entry.name);
    dirs.push(directory);
    const tasks = path.join(directory, 'tasks');
    try {
      if (fs.lstatSync(tasks).isDirectory()) dirs.push(tasks);
    } catch {
      // No tasks/ directory for this plan.
    }
  }
  return dirs;
}

/**
 * Create the watcher. `onRefresh` runs synchronously in the timer callback;
 * re-entrant triggers coalesce into a single follow-up run (single-flight).
 */
export function createPlanWatcher(options: PlanWatchOptions): PlanWatcher {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  const readFingerprint = options.fingerprint ?? (() => fingerprintPlanTree(options.plansDir));
  const safeFingerprint = (): string => {
    try {
      return readFingerprint();
    } catch {
      return '';
    }
  };

  const watchers: fs.FSWatcher[] = [];
  let lastFingerprint = safeFingerprint();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pendingKind: RefreshMode = 'watch';
  let inFlight = false;
  let queued = false;
  let disposed = false;

  function clearTimers(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    if (maxTimer !== null) clearTimeout(maxTimer);
    debounceTimer = null;
    maxTimer = null;
  }

  function run(kind: RefreshMode): void {
    if (disposed) return;
    if (inFlight) {
      queued = true;
      return;
    }
    inFlight = true;
    try {
      const next = safeFingerprint();
      if (kind !== 'manual' && next === lastFingerprint) return;
      lastFingerprint = next;
      options.onRefresh(kind);
    } finally {
      inFlight = false;
      if (queued && !disposed) {
        queued = false;
        schedule(pendingKind);
      }
    }
  }

  function fire(): void {
    if (disposed) return;
    const kind = pendingKind;
    clearTimers();
    run(kind);
  }

  function schedule(kind: RefreshMode): void {
    if (disposed) return;
    pendingKind = kind;
    if (maxTimer === null) maxTimer = setTimeout(fire, maxWaitMs);
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fire, debounceMs);
  }

  function pollTick(): void {
    if (disposed) return;
    if (safeFingerprint() !== lastFingerprint) schedule('poll');
  }

  function attachWatch(): boolean {
    if (options.watch === false) return false;
    try {
      watchers.push(fs.watch(options.plansDir, { recursive: true }, () => schedule('watch')));
      return true;
    } catch {
      // Recursive watch is platform-dependent; fall back to per-directory.
    }
    for (const directory of watchedDirectories(options.plansDir)) {
      try {
        watchers.push(fs.watch(directory, () => schedule('watch')));
      } catch {
        // A directory that vanished is covered by the poll fallback.
      }
    }
    return watchers.length > 0;
  }

  const watching = attachWatch();
  pollTimer = setInterval(pollTick, pollMs);

  return {
    notify(): void {
      schedule('watch');
    },
    refresh(): void {
      if (disposed) return;
      clearTimers();
      run('manual');
    },
    mode(): 'watch' | 'poll' {
      return watching ? 'watch' : 'poll';
    },
    unsubscribe(): void {
      if (disposed) return;
      disposed = true;
      clearTimers();
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      for (const watcher of watchers.splice(0)) {
        try {
          watcher.close();
        } catch {
          // Closing an already-closed watcher is harmless.
        }
      }
    },
  };
}

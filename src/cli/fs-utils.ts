/**
 * fs-utils.ts — atomic, symlink-aware filesystem primitives for the installer.
 *
 * A staged directory is created as a unique sibling of its target, populated,
 * then committed with a rename-based swap: an existing target moves to a
 * backup sibling and is restored if the commit fails. Removal is lstat-based
 * so a symlink is unlinked, never followed. Destructive helpers reject blank,
 * relative, or filesystem-root paths; callers confine targets with
 * `assertConfined`. The `FsOperations` seam exists only for fault injection in
 * tests — production callers use `defaultFsOperations`.
 */
import crypto from 'node:crypto';
import type { Dirent, Stats } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { OperationalError } from './errors.js';
import { errorCode, isMissing, operationError, requireAbsolute } from './fs-errors.js';
import { assertPathWithin } from './scope.js';

const MAX_TEMP_ATTEMPTS = 5;
const DIRECTORY_MODE = 0o755;

/** Minimal filesystem seam; every member maps to an `fs/promises` call. */
export interface FsOperations {
  readonly lstat: (target: string) => Promise<Stats>;
  readonly readdir: (directory: string) => Promise<readonly Dirent[]>;
  readonly mkdir: (target: string, options: { recursive: boolean; mode: number }) => Promise<string | undefined>;
  readonly copyFile: (source: string, destination: string) => Promise<void>;
  readonly chmod: (target: string, mode: number) => Promise<void>;
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly rm: (target: string, options: { recursive: boolean; force: boolean }) => Promise<void>;
}

/** Production filesystem operations; tests spread this to inject failures. */
export const defaultFsOperations: FsOperations = {
  lstat: (target) => fs.promises.lstat(target),
  readdir: (directory) => fs.promises.readdir(directory, { withFileTypes: true }),
  mkdir: async (target, options) => {
    if (options.recursive) return fs.promises.mkdir(target, { recursive: true, mode: options.mode });
    await fs.promises.mkdir(target, { mode: options.mode });
    return undefined;
  },
  copyFile: (source, destination) => fs.promises.copyFile(source, destination),
  chmod: (target, mode) => fs.promises.chmod(target, mode),
  rename: (from, to) => fs.promises.rename(from, to),
  rm: (target, options) => fs.promises.rm(target, { recursive: options.recursive, force: options.force }),
};

/** Destructive operations additionally refuse the filesystem root. */
function refuseFilesystemRoot(action: string, resolved: string): void {
  if (resolved === path.parse(resolved).root) {
    throw new OperationalError(`cannot ${action}: refusing to operate on the filesystem root`);
  }
}

async function lstatIfExists(target: string, ops: FsOperations, action: string): Promise<Stats | undefined> {
  try {
    return await ops.lstat(target);
  } catch (err) {
    if (isMissing(err)) return undefined;
    throw operationError(action, target, err);
  }
}

/** Best-effort removal of a staging/backup path; never masks the real cause. */
async function cleanupBestEffort(target: string, ops: FsOperations): Promise<void> {
  try {
    await ops.rm(target, { recursive: true, force: true });
  } catch {
    // A leftover temp/backup is preferable to hiding the operation failure.
  }
}

/**
 * Create `directory` (and parents) with mode 0755. Idempotent for existing
 * directories; throws `OperationalError` when a non-directory occupies a path
 * component.
 */
export async function ensureDirectory(directory: string, ops: FsOperations = defaultFsOperations): Promise<void> {
  const resolved = requireAbsolute('create a directory', directory);
  try {
    await ops.mkdir(resolved, { recursive: true, mode: DIRECTORY_MODE });
  } catch (err) {
    throw operationError('cannot create directory', resolved, err);
  }
}

/**
 * Create a unique sibling staging directory `<target>.tmp-<pid>-<random>` on
 * the target's filesystem. The target itself is never touched.
 */
export async function stageDirectory(targetDir: string, ops: FsOperations = defaultFsOperations): Promise<string> {
  const target = requireAbsolute('stage an install directory', targetDir);
  refuseFilesystemRoot('stage an install directory', target);
  await ensureDirectory(path.dirname(target), ops);

  for (let attempt = 0; attempt < MAX_TEMP_ATTEMPTS; attempt += 1) {
    const suffix = `${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    const candidate = `${target}.tmp-${suffix}`;
    try {
      await ops.mkdir(candidate, { recursive: false, mode: DIRECTORY_MODE });
      return candidate;
    } catch (err) {
      if (errorCode(err) !== 'EEXIST') {
        throw operationError('cannot stage an install directory', target, err);
      }
    }
  }
  throw new OperationalError(`cannot stage an install directory: no unique temporary path for ${target}`);
}

async function copyEntry(source: string, destination: string, ops: FsOperations): Promise<void> {
  const stats = await lstatIfExists(source, ops, 'cannot copy');
  if (stats === undefined) {
    throw new OperationalError(`cannot copy: source does not exist: ${source}`);
  }
  if (stats.isSymbolicLink()) {
    throw new OperationalError(`refusing to copy symbolic link: ${source}`);
  }
  if (stats.isDirectory()) {
    await ensureDirectory(destination, ops);
    let entries: readonly Dirent[];
    try {
      entries = await ops.readdir(source);
    } catch (err) {
      throw operationError('cannot read directory', source, err);
    }
    const sorted = [...entries].sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of sorted) {
      await copyEntry(path.join(source, entry.name), path.join(destination, entry.name), ops);
    }
    return;
  }
  if (stats.isFile()) {
    try {
      await ops.copyFile(source, destination);
      await ops.chmod(destination, stats.mode);
    } catch (err) {
      throw operationError('cannot copy file', source, err);
    }
    return;
  }
  throw new OperationalError(`refusing to copy unsupported filesystem entry: ${source}`);
}

/**
 * Recursively copy a directory tree, creating destination parents and
 * preserving file modes via `copyFile`. Symlinks and special entries in the
 * source are rejected rather than followed. The copy is not transactional;
 * the caller stages into a temp directory and removes it on failure.
 */
export async function copyTree(
  source: string,
  destination: string,
  ops: FsOperations = defaultFsOperations
): Promise<void> {
  const from = requireAbsolute('copy a directory tree', source);
  const to = requireAbsolute('copy a directory tree', destination);
  refuseFilesystemRoot('copy a directory tree', to);
  await ensureDirectory(path.dirname(to), ops);
  await copyEntry(from, to, ops);
}

/**
 * Atomically move `staging` into `target`. When the target exists it is moved
 * to a backup sibling first and restored if the commit rename fails; the
 * previous target is never deleted on failure. Staging is cleaned once it has
 * been accepted for the swap (rename failures and symlink refusals), and a
 * successful swap best-effort removes the backup.
 */
export async function atomicSwap(
  staging: string,
  target: string,
  ops: FsOperations = defaultFsOperations
): Promise<void> {
  const from = requireAbsolute('swap the staged directory', staging);
  const to = requireAbsolute('swap the staged directory', target);
  refuseFilesystemRoot('swap the staged directory', from);
  refuseFilesystemRoot('swap the staged directory', to);

  const staged = await lstatIfExists(from, ops, 'cannot swap the staged directory');
  if (staged === undefined) throw new OperationalError(`cannot swap: staging directory does not exist: ${from}`);
  if (staged.isSymbolicLink()) throw new OperationalError(`cannot swap: staging path is a symbolic link: ${from}`);
  if (!staged.isDirectory()) throw new OperationalError(`cannot swap: staging path must be a directory: ${from}`);

  const current = await lstatIfExists(to, ops, 'cannot swap the staged directory');
  if (current?.isSymbolicLink() === true) {
    await cleanupBestEffort(from, ops);
    throw new OperationalError(`cannot swap: target is a symbolic link: ${to}`);
  }

  if (current === undefined) {
    try {
      await ops.rename(from, to);
    } catch (err) {
      await cleanupBestEffort(from, ops);
      throw operationError('cannot install the staged directory', to, err);
    }
    return;
  }

  const backup = `${to}.bak-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  try {
    await ops.rename(to, backup);
  } catch (err) {
    await cleanupBestEffort(from, ops);
    throw operationError('cannot move the existing target aside', to, err);
  }

  try {
    await ops.rename(from, to);
  } catch (err) {
    try {
      await ops.rename(backup, to);
    } catch (restoreError) {
      await cleanupBestEffort(from, ops);
      throw new OperationalError(
        `cannot complete the swap and could not restore it; the previous installation remains at ${backup}`,
        { cause: restoreError }
      );
    }
    await cleanupBestEffort(from, ops);
    throw new OperationalError(`cannot complete the swap; the previous installation was restored at ${to}`, {
      cause: err,
    });
  }

  await cleanupBestEffort(backup, ops);
}

/**
 * Remove a path without following symlinks: links are unlinked, directories
 * are removed recursively, and a missing path is a no-op.
 */
export async function removePath(target: string, ops: FsOperations = defaultFsOperations): Promise<void> {
  const resolved = requireAbsolute('remove a path', target);
  refuseFilesystemRoot('remove a path', resolved);

  const stats = await lstatIfExists(resolved, ops, 'cannot remove the path');
  if (stats === undefined) return;

  try {
    await ops.rm(resolved, { recursive: stats.isDirectory(), force: true });
  } catch (err) {
    throw operationError('cannot remove the path', resolved, err);
  }
}

/**
 * `true` when `target` is a symbolic link. Uses `lstat`, so links are never
 * followed; a missing path is `false`, other failures throw.
 */
export async function isSymlink(target: string, ops: FsOperations = defaultFsOperations): Promise<boolean> {
  const resolved = requireAbsolute('inspect a path', target);
  const stats = await lstatIfExists(resolved, ops, 'cannot inspect the path');
  return stats?.isSymbolicLink() ?? false;
}

/** Throw `PathConfinementError` unless `candidate` is `root` or below it. */
export function assertConfined(root: string, candidate: string, platform: NodeJS.Platform = process.platform): void {
  assertPathWithin(root, candidate, platform);
}

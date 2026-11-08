/**
 * config-file.ts — OpenCode config target selection and safe persistence.
 *
 * `resolveConfigFile` prefers an existing `opencode.jsonc`, then
 * `opencode.json`, and defaults to `opencode.jsonc` without creating it.
 * Reads are typed (`missing`/`found`) and never parse the document. Writes
 * compare content first (identical text is a no-op), copy the previous content
 * to `<config>.bak` before the first change, and commit through
 * `writeFileAtomic`. A symlinked config is written through to its real target
 * so dotfile-managed links stay links; the backup remains adjacent to the link
 * (inside the scope root). The file mode is re-applied after the atomic rename
 * because temp-file creation is umask-filtered.
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from '../lib/atomic-write.js';
import { OperationalError } from './errors.js';
import { isMissing, operationError, requireAbsolute } from './fs-errors.js';
import { assertPathWithin, CONFIG_FILE_NAME, type InstallScope } from './scope.js';

/** Suffix of the pre-edit backup kept next to the selected config path. */
export const CONFIG_BACKUP_SUFFIX = '.bak';

const FALLBACK_CONFIG_FILE_NAME = 'opencode.json';
const NEW_FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o755;
const MAX_SYMLINK_DEPTH = 40;

/** Typed read outcome; `mode` carries permission bits only (e.g. `0o600`). */
export type ConfigFileReadResult =
  | { readonly status: 'missing' }
  | { readonly status: 'found'; readonly text: string; readonly mode: number };

/** Inputs for {@link writeConfigFile}. */
export interface WriteConfigOptions {
  /** Copy the previous content to `<path>.bak` before changing it (default true). */
  readonly backup?: boolean;
  /** Scope root; when set, the config path and backup must stay inside it. */
  readonly root?: string;
}

/** Outcome of {@link writeConfigFile}; `backupPath` is present only when a backup was written. */
export interface WriteConfigResult {
  readonly changed: boolean;
  readonly backupPath?: string;
}

/** Inputs for {@link backupConfigFile}. */
export interface BackupConfigOptions {
  /** Destination; defaults to `<configPath>.bak`. An existing backup is replaced. */
  readonly backupPath?: string;
}

function lstatIfExists(target: string, action: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(target);
  } catch (err) {
    if (isMissing(err)) return undefined;
    throw operationError(action, target, err);
  }
}

function readText(file: string, action: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw operationError(action, file, err);
  }
}

/** The scope root that owns the config file: global config dir or project root. */
export function configScopeRoot(scope: InstallScope): string {
  const root = scope.scope === 'global' ? scope.configDir : scope.projectRoot;
  if (root === undefined) {
    throw new OperationalError('cannot resolve the OpenCode config file: project scope has no project root');
  }
  if (!path.isAbsolute(root)) {
    throw new OperationalError(`cannot resolve the OpenCode config file: scope root must be absolute: ${root}`);
  }
  return path.resolve(root);
}

/**
 * Choose the config file for a scope without creating anything: an existing
 * `.jsonc` wins, then an existing `.json`, then the `.jsonc` default. The
 * selected path is always confined to the scope root.
 */
export function resolveConfigFile(scope: InstallScope): string {
  const root = configScopeRoot(scope);
  const preferred = path.join(root, CONFIG_FILE_NAME);
  const fallback = path.join(root, FALLBACK_CONFIG_FILE_NAME);
  const selected = fs.existsSync(preferred) ? preferred : fs.existsSync(fallback) ? fallback : preferred;
  assertPathWithin(root, selected);
  return selected;
}

/**
 * Read a config file without parsing it. A missing path is `missing`; a path
 * that is not a regular file, or any other read failure, is an
 * `OperationalError`. Symlinks are followed to their target.
 */
export function readConfigFile(configPath: string): ConfigFileReadResult {
  const file = requireAbsolute('read the OpenCode config', configPath);
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, 'r');
    const stats = fs.fstatSync(fd);
    if (!stats.isFile()) {
      throw new OperationalError(`cannot read the OpenCode config: not a regular file: ${file}`);
    }
    return { status: 'found', text: fs.readFileSync(fd, 'utf8'), mode: stats.mode & 0o777 };
  } catch (err) {
    if (err instanceof OperationalError) throw err;
    if (isMissing(err)) return { status: 'missing' };
    throw operationError('cannot read the OpenCode config', file, err);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * Resolve a config path to the file that actually receives bytes. Symlinks are
 * followed lexically so a dangling link can still be created; the link itself
 * is never replaced.
 */
function resolveWriteTarget(file: string): string {
  let current = file;
  for (let depth = 0; depth < MAX_SYMLINK_DEPTH; depth += 1) {
    const stats = lstatIfExists(current, 'resolve the OpenCode config');
    if (stats === undefined || !stats.isSymbolicLink()) return current;
    let link: string;
    try {
      link = fs.readlinkSync(current);
    } catch (err) {
      throw operationError('cannot resolve the OpenCode config symlink', current, err);
    }
    current = path.resolve(path.dirname(current), link);
  }
  throw new OperationalError(`cannot resolve the OpenCode config symlink: too many levels: ${file}`);
}

/** Write a backup atomically; a failed backup aborts before the config is touched. */
function writeBackup(backupPath: string, text: string, mode: number): void {
  try {
    writeFileAtomic(backupPath, text);
    fs.chmodSync(backupPath, mode);
  } catch (err) {
    throw operationError('cannot back up the OpenCode config', backupPath, err);
  }
}

/** Create missing config parent directories with 0755, never outside the scope root. */
function createParentDirectories(parent: string, root: string | undefined): void {
  if (fs.existsSync(parent)) return;
  if (root !== undefined) assertPathWithin(root, parent);
  try {
    fs.mkdirSync(parent, { recursive: true, mode: DIRECTORY_MODE });
    fs.chmodSync(parent, DIRECTORY_MODE);
  } catch (err) {
    throw operationError('cannot create the OpenCode config directory', parent, err);
  }
}

/**
 * Back up the current config content to `<configPath>.bak` (or an explicit
 * destination). An existing backup is replaced. A missing source or a
 * non-regular file is an `OperationalError`.
 */
export function backupConfigFile(configPath: string, options: BackupConfigOptions = {}): string {
  const file = requireAbsolute('back up the OpenCode config', configPath);
  const target = resolveWriteTarget(file);
  const stats = lstatIfExists(target, 'back up the OpenCode config');
  if (stats === undefined || !stats.isFile()) {
    throw new OperationalError(`cannot back up the OpenCode config: not a regular file: ${target}`);
  }
  const backupPath =
    options.backupPath === undefined
      ? `${file}${CONFIG_BACKUP_SUFFIX}`
      : requireAbsolute('back up the OpenCode config', options.backupPath);
  writeBackup(backupPath, readText(target, 'back up the OpenCode config'), stats.mode & 0o777);
  return backupPath;
}

/**
 * Persist config text atomically. Identical content is a no-op (no write, no
 * backup). An existing file is backed up to `<configPath>.bak` unless
 * `backup: false`; if the backup fails, the config is left untouched. Existing
 * modes are preserved, new files are 0600, and symlinks are written through
 * without replacing the link.
 */
export function writeConfigFile(configPath: string, text: string, options: WriteConfigOptions = {}): WriteConfigResult {
  const file = requireAbsolute('write the OpenCode config', configPath);
  const root = options.root === undefined ? undefined : requireAbsolute('write the OpenCode config', options.root);
  if (root !== undefined) assertPathWithin(root, file);

  const target = resolveWriteTarget(file);
  const stats = lstatIfExists(target, 'write the OpenCode config');
  if (stats !== undefined && !stats.isFile()) {
    throw new OperationalError(`cannot write the OpenCode config: not a regular file: ${target}`);
  }

  const existing = stats === undefined ? undefined : readText(target, 'read the OpenCode config before writing');
  if (existing === text) return { changed: false };

  let backupPath: string | undefined;
  if (stats !== undefined && existing !== undefined && options.backup !== false) {
    backupPath = `${file}${CONFIG_BACKUP_SUFFIX}`;
    if (root !== undefined) assertPathWithin(root, backupPath);
    writeBackup(backupPath, existing, stats.mode & 0o777);
  }

  createParentDirectories(path.dirname(target), root);
  try {
    writeFileAtomic(target, text);
    fs.chmodSync(target, stats === undefined ? NEW_FILE_MODE : stats.mode & 0o777);
  } catch (err) {
    throw operationError('cannot write the OpenCode config', target, err);
  }

  return backupPath === undefined ? { changed: true } : { changed: true, backupPath };
}

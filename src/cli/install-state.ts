/**
 * install-state.ts — read-only ownership and version classification:
 * `classifyInstall`, semver precedence, and `assertInstallable` force policy.
 * Nothing in this module writes to disk.
 */
import type { Dirent, Stats } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { OperationalError } from './errors.js';
import { type InstallManifest, MANIFEST_FILE_NAME, readManifest } from './manifest.js';

export type VersionComparison = -1 | 0 | 1;

interface ManagedInstallState {
  readonly status: 'managed-current' | 'managed-older' | 'managed-newer';
  readonly target: string;
  readonly cliVersion: string;
  readonly manifest: InstallManifest;
  readonly missingFiles: readonly string[];
  readonly extraFiles: readonly string[];
}

/** Stable classification of what currently occupies an install target. */
export type InstallState =
  | { readonly status: 'absent' | 'corrupt'; readonly target: string; readonly reason: string }
  | ManagedInstallState
  | { readonly status: 'unmanaged'; readonly target: string; readonly reason: string; readonly symlink: boolean };

/** Planned action derived from a classified state. */
type InstallAction = 'install' | 'noop' | 'repair' | 'upgrade' | 'downgrade' | 'replace';

/** Result of {@link assertInstallable}; `warning` is safe to print on stderr. */
export interface InstallDecision {
  readonly action: InstallAction;
  readonly requiresForce: boolean;
  readonly warning?: string;
}

export type AssertInstallableOptions = { readonly force?: boolean };

interface ParsedVersion {
  readonly core: readonly [bigint, bigint, bigint];
  readonly prerelease?: readonly string[];
}

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
const NUMERIC_IDENTIFIER = /^\d+$/;

function invalidVersion(value: string): OperationalError {
  const expected = 'expected a semver-like MAJOR.MINOR.PATCH[-PRERELEASE]';
  return new OperationalError(`invalid version ${JSON.stringify(value)}: ${expected}`);
}

function validateIdentifiers(value: string | undefined, version: string): readonly string[] | undefined {
  if (value === undefined) return undefined;
  const identifiers = value.split('.');
  if (identifiers.includes('')) throw invalidVersion(version);
  return identifiers;
}

function parseVersion(value: string): ParsedVersion {
  const match = VERSION_PATTERN.exec(value);
  if (match === null) throw invalidVersion(value);
  const [, major = '', minor = '', patch = '', prerelease, build] = match;
  validateIdentifiers(build, value);
  return { core: [BigInt(major), BigInt(minor), BigInt(patch)], prerelease: validateIdentifiers(prerelease, value) };
}

function comparePrerelease(left: readonly string[], right: readonly string[]): VersionComparison {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftId = left[index];
    const rightId = right[index];
    if (leftId === undefined) return -1;
    if (rightId === undefined) return 1;
    if (leftId === rightId) continue;
    const leftNumeric = NUMERIC_IDENTIFIER.test(leftId);
    const rightNumeric = NUMERIC_IDENTIFIER.test(rightId);
    if (leftNumeric && rightNumeric) {
      const leftNumber = BigInt(leftId);
      const rightNumber = BigInt(rightId);
      if (leftNumber !== rightNumber) return leftNumber < rightNumber ? -1 : 1;
      continue;
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftId < rightId ? -1 : 1;
  }
  return 0;
}

function compareParsed(left: ParsedVersion, right: ParsedVersion): VersionComparison {
  for (let index = 0; index < left.core.length; index += 1) {
    const leftPart = left.core[index] ?? 0n;
    const rightPart = right.core[index] ?? 0n;
    if (leftPart !== rightPart) return leftPart < rightPart ? -1 : 1;
  }
  if (left.prerelease === undefined) return right.prerelease === undefined ? 0 : 1;
  if (right.prerelease === undefined) return -1;
  return comparePrerelease(left.prerelease, right.prerelease);
}

/** Semver-like precedence comparison; malformed input throws `OperationalError`. */
export function compareVersions(left: string, right: string): VersionComparison {
  return compareParsed(parseVersion(left), parseVersion(right));
}
function resolveTarget(targetDir: string): string {
  if (targetDir.trim() === '') throw new OperationalError('target directory must not be empty');
  if (!path.isAbsolute(targetDir)) throw new OperationalError(`target directory must be absolute: ${targetDir}`);
  return path.resolve(targetDir);
}
function inspectError(action: string, target: string, error: unknown): OperationalError {
  const code = (error as { code?: unknown } | null)?.code;
  const detail = typeof code === 'string' ? code : 'unknown error';
  return new OperationalError(`${action}: ${target} (${detail})`, { cause: error });
}
function targetStats(target: string): Stats | undefined {
  try {
    return fs.lstatSync(target, { throwIfNoEntry: false });
  } catch (err) {
    throw inspectError('cannot inspect the install target', target, err);
  }
}
function readDirectory(directory: string): Dirent[] {
  try {
    return fs.readdirSync(directory, { withFileTypes: true });
  } catch (err) {
    throw inspectError('cannot read the install target', directory, err);
  }
}

/** List target files recursively; symlinks are recorded but never traversed. */
function listFiles(directory: string, prefix = ''): string[] {
  return readDirectory(directory).flatMap((entry) => {
    const relative = `${prefix}${entry.name}`;
    if (relative === MANIFEST_FILE_NAME) return [];
    return entry.isDirectory() ? listFiles(path.join(directory, entry.name), `${relative}/`) : [relative];
  });
}
function managedFileExists(target: string, relative: string): boolean {
  try {
    return fs.lstatSync(path.join(target, relative), { throwIfNoEntry: false })?.isFile() === true;
  } catch (err) {
    throw inspectError(`cannot inspect managed file ${relative} in`, target, err);
  }
}
function classifyManaged(target: string, cliVersion: string, manifest: InstallManifest): InstallState {
  // A bad CLI version is a release bug, not an install-state question: fail.
  parseVersion(cliVersion);
  let comparison: VersionComparison;
  try {
    comparison = compareVersions(manifest.version, cliVersion);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'invalid manifest version';
    return { status: 'corrupt', target, reason: `install manifest version is not comparable: ${reason}` };
  }
  const managed = new Set(manifest.files);
  return {
    status: comparison === 0 ? 'managed-current' : comparison < 0 ? 'managed-older' : 'managed-newer',
    target,
    cliVersion,
    manifest,
    missingFiles: manifest.files.filter((file) => !managedFileExists(target, file)),
    extraFiles: listFiles(target)
      .sort()
      .filter((file) => !managed.has(file)),
  };
}

/**
 * Classify `targetDir` without touching it. Symlinks are never followed: a
 * symlinked target is `unmanaged` with `symlink: true`. Missing/empty targets
 * are `absent`; a non-empty directory without a valid manifest is `unmanaged`;
 * unreadable, unsupported, mismatched, or non-comparable manifests are corrupt.
 */
export function classifyInstall(targetDir: string, cliVersion: string): InstallState {
  const target = resolveTarget(targetDir);
  const stats = targetStats(target);
  if (stats === undefined) return { status: 'absent', target, reason: 'target does not exist' };
  if (stats.isSymbolicLink()) {
    return { status: 'unmanaged', target, symlink: true, reason: 'target is a symbolic link (not followed)' };
  }
  if (!stats.isDirectory()) {
    return { status: 'unmanaged', target, symlink: false, reason: 'target is not a directory' };
  }
  const result = readManifest(target);
  if (result.status === 'valid') return classifyManaged(target, cliVersion, result.manifest);
  if (result.status !== 'missing') return { status: 'corrupt', target, reason: result.reason };
  const entries = readDirectory(target);
  if (entries.length === 0) return { status: 'absent', target, reason: 'target directory is empty' };
  const count = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
  return {
    status: 'unmanaged',
    target,
    symlink: false,
    reason: `target is not empty (${count}) and has no install manifest`,
  };
}

function driftSummary(state: ManagedInstallState): string | undefined {
  const parts: string[] = [];
  if (state.missingFiles.length > 0) parts.push(`${state.missingFiles.length} managed file(s) missing`);
  if (state.extraFiles.length > 0) parts.push(`${state.extraFiles.length} unmanaged file(s) present`);
  return parts.length === 0 ? undefined : parts.join(', ');
}

function managedWarning(state: ManagedInstallState, action: 'repair' | 'upgrade' | 'downgrade'): string | undefined {
  const drift = driftSummary(state);
  if (action === 'downgrade') {
    const suffix =
      state.extraFiles.length === 0 ? '' : `; ${state.extraFiles.length} file(s) not in the manifest will be removed`;
    return (
      `installed version ${state.manifest.version} is newer than this CLI (${state.cliVersion}); ` +
      `continuing will downgrade the managed plugin${suffix}`
    );
  }
  if (action === 'upgrade') {
    const count = state.extraFiles.length;
    return count === 0 ? undefined : `upgrade removes ${count} target file(s) not listed in the manifest`;
  }
  return drift === undefined ? undefined : `managed install is incomplete (${drift}); reinstalling repairs it`;
}

function refuseInstall(target: string, reason: string): never {
  throw new OperationalError(`refusing to install into ${target}: ${reason}; re-run with --force to replace it`);
}
function managedDecision(action: InstallAction, warning: string | undefined): InstallDecision {
  return warning === undefined ? { action, requiresForce: false } : { action, requiresForce: false, warning };
}

/**
 * Decide whether an install may proceed and what it should do. A current
 * managed install without drift is a no-op; drift is a repair; older is an
 * upgrade; newer is a warning-only downgrade. Symlinked targets are always
 * refused. Unmanaged and corrupt targets throw unless `force` is set.
 */
export function assertInstallable(state: InstallState, options: AssertInstallableOptions = {}): InstallDecision {
  const force = options.force === true;
  switch (state.status) {
    case 'absent':
      return { action: 'install', requiresForce: false };
    case 'managed-current': {
      const warning = managedWarning(state, 'repair');
      return managedDecision(warning === undefined ? 'noop' : 'repair', warning);
    }
    case 'managed-older':
      return managedDecision('upgrade', managedWarning(state, 'upgrade'));
    case 'managed-newer':
      return managedDecision('downgrade', managedWarning(state, 'downgrade'));
    case 'unmanaged': {
      if (state.symlink) {
        throw new OperationalError(
          `refusing to install into ${state.target}: the target is a symbolic link; remove it manually first`
        );
      }
      if (!force) refuseInstall(state.target, state.reason);
      return {
        action: 'replace',
        requiresForce: true,
        warning: `replacing the unmanaged target ${state.target} because --force was supplied`,
      };
    }
    case 'corrupt': {
      if (!force) refuseInstall(state.target, `the install manifest is corrupt (${state.reason})`);
      return {
        action: 'replace',
        requiresForce: true,
        warning: `replacing the corrupt managed target ${state.target} because --force was supplied`,
      };
    }
  }
}

function driftSuffix(state: ManagedInstallState): string {
  const drift = driftSummary(state);
  return drift === undefined ? '' : `; ${drift}`;
}

/** One-line printable-ASCII summary for status output; never includes file contents. */
export function describeInstallState(state: InstallState): string {
  switch (state.status) {
    case 'absent':
      return `not installed (${state.reason}; target: ${state.target})`;
    case 'managed-current':
      return `managed install v${state.manifest.version} is current (target: ${state.target})${driftSuffix(state)}`;
    case 'managed-older': {
      const summary = `managed install v${state.manifest.version} is older than CLI v${state.cliVersion}`;
      return `${summary}; upgrade available (target: ${state.target})${driftSuffix(state)}`;
    }
    case 'managed-newer': {
      const summary = `managed install v${state.manifest.version} is newer than CLI v${state.cliVersion}`;
      return `${summary}; downgrade (target: ${state.target})${driftSuffix(state)}`;
    }
    case 'unmanaged':
      return `unmanaged ${state.symlink ? 'symbolic link' : 'target'} at ${state.target} (${state.reason})`;
    case 'corrupt':
      return `corrupt install at ${state.target} (${state.reason})`;
  }
}

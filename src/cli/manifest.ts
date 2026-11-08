/**
 * manifest.ts — the `.dev-harness-install.json` ownership contract.
 *
 * Records installer ownership: what was installed, from which source, into
 * which target, and which files are managed. Reads return a typed
 * missing/valid/corrupt/unsupported result; writes validate first and commit
 * atomically via `writeFileAtomic` (deterministic 2-space JSON, LF).
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from '../lib/atomic-write.js';
import { OperationalError } from './errors.js';
import { MCP_CONFIG_KEY, type Scope } from './scope.js';

/** Manifest file name inside the managed plugin target directory. */
export const MANIFEST_FILE_NAME = '.dev-harness-install.json';
/** Schema version this module reads and writes. */
export const MANIFEST_SCHEMA_VERSION = 1;

/** Managed config entry: config file path, dotted key, and entry fingerprint. */
interface ManifestConfigEntry {
  readonly path: string;
  readonly key: typeof MCP_CONFIG_KEY;
  /** Deep-equal JSON of the managed `dh` entry; absent when MCP wiring was skipped. */
  readonly fingerprint?: unknown;
}

/** Complete installer-owned state for one managed plugin directory. */
export interface InstallManifest {
  readonly schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  readonly package: string;
  readonly version: string;
  /** npm or GitHub spec the install came from. */
  readonly source: string;
  readonly scope: Scope;
  readonly installedAt: string;
  /** Absolute path of the managed plugin directory. */
  readonly target: string;
  readonly config: ManifestConfigEntry;
  /** Managed files as POSIX-style paths relative to `target`. */
  readonly files: readonly string[];
}

/**
 * Typed read outcome: `valid` carries the manifest; every other state carries
 * an actionable reason (never file contents or secrets).
 */
export type ManifestReadResult =
  | { readonly status: 'valid'; readonly manifest: InstallManifest }
  | { readonly status: 'missing'; readonly reason: string }
  | { readonly status: 'corrupt'; readonly reason: string }
  | { readonly status: 'unsupported'; readonly reason: string };

/** Inputs for {@link createManifest}; `installedAt` defaults to the current time. */
export interface CreateManifestInput {
  readonly package: string;
  readonly version: string;
  readonly source: string;
  readonly scope: Scope;
  readonly target: string;
  readonly config: { readonly path: string; readonly fingerprint?: unknown };
  readonly files: readonly string[];
  readonly installedAt?: string;
}

type ManifestFailure = { readonly status: 'corrupt' | 'unsupported'; readonly reason: string };
type Inspection =
  | { readonly ok: true; readonly manifest: InstallManifest }
  | { readonly ok: false; readonly failure: ManifestFailure };

function fail(status: ManifestFailure['status'], reason: string): { ok: false; failure: ManifestFailure } {
  return { ok: false, failure: { status, reason } };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}
const DRIVE_LETTER = /^[A-Za-z]:/;

/** Control characters would corrupt paths and terminal output. */
function hasControlChars(value: string): boolean {
  return [...value].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
}

/**
 * Managed entries are POSIX-style, normalized, relative paths: no drive
 * letters, backslashes, control characters, or `.`/`..`/empty segments.
 */
function isManagedRelativePath(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  if (value.includes('\\') || DRIVE_LETTER.test(value) || hasControlChars(value)) return false;
  return value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && !Number.isNaN(Date.parse(value));
}

/**
 * Validate an unknown value against schema version 1 and rebuild the canonical
 * manifest (unknown fields are dropped, never trusted). Returns a typed
 * failure instead of throwing so reads can report states.
 */
function inspectManifest(value: unknown): Inspection {
  if (!isRecord(value)) return fail('corrupt', 'install manifest must be a JSON object');

  const schemaVersion = value.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isFinite(schemaVersion)) {
    return fail('corrupt', 'install manifest must have a numeric schemaVersion');
  }
  if (schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    return fail(
      'unsupported',
      `install manifest schema version ${schemaVersion} is not supported (expected ${MANIFEST_SCHEMA_VERSION})`
    );
  }

  const packageName = nonEmptyString(value.package);
  if (packageName === undefined) return fail('corrupt', 'install manifest package must be a non-empty string');
  const version = nonEmptyString(value.version);
  if (version === undefined) return fail('corrupt', 'install manifest version must be a non-empty string');
  const source = nonEmptyString(value.source);
  if (source === undefined) return fail('corrupt', 'install manifest source must be a non-empty string');

  const scope = value.scope;
  if (scope !== 'global' && scope !== 'project') {
    return fail('corrupt', 'install manifest scope must be "global" or "project"');
  }

  const installedAt = value.installedAt;
  if (!isTimestamp(installedAt)) return fail('corrupt', 'install manifest installedAt must be a parseable timestamp');

  const target = value.target;
  if (typeof target !== 'string' || !path.isAbsolute(target)) {
    return fail('corrupt', 'install manifest target must be an absolute path');
  }

  const config = value.config;
  if (!isRecord(config)) return fail('corrupt', 'install manifest config must be an object');
  const configPath = config.path;
  if (typeof configPath !== 'string' || !path.isAbsolute(configPath)) {
    return fail('corrupt', 'install manifest config.path must be an absolute path');
  }
  if (config.key !== MCP_CONFIG_KEY) {
    return fail('corrupt', `install manifest config.key must be "${MCP_CONFIG_KEY}"`);
  }
  const fingerprint = 'fingerprint' in config ? config.fingerprint : undefined;

  const entries = value.files;
  if (!Array.isArray(entries)) return fail('corrupt', 'install manifest files must be an array of relative paths');
  const files: string[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry: unknown = entries[index];
    if (!isManagedRelativePath(entry)) {
      return fail('corrupt', `install manifest files[${index}] must be a relative, normalized path`);
    }
    files.push(entry);
  }

  return {
    ok: true,
    manifest: {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      package: packageName,
      version,
      source,
      scope,
      installedAt,
      target,
      config: { path: configPath, key: MCP_CONFIG_KEY, ...(fingerprint === undefined ? {} : { fingerprint }) },
      files,
    },
  };
}

/** Absolute manifest path inside `targetDir`; a pure join, without validation. */
export function manifestPathFor(targetDir: string): string {
  return path.join(targetDir, MANIFEST_FILE_NAME);
}

function requireAbsoluteDir(action: string, targetDir: string): string {
  if (targetDir.trim() === '') throw new OperationalError(`cannot ${action}: target directory must not be empty`);
  if (!path.isAbsolute(targetDir)) {
    throw new OperationalError(`cannot ${action}: target directory must be an absolute path: ${targetDir}`);
  }
  return path.resolve(targetDir);
}

const samePath = (left: string, right: string): boolean => path.resolve(left) === path.resolve(right);

function isExistingDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Build a manifest from command inputs. Validation runs before the value is
 * returned, so a malformed install fails before any file is written.
 */
export function createManifest(input: CreateManifestInput): InstallManifest {
  const inspected = inspectManifest({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    package: input.package,
    version: input.version,
    source: input.source,
    scope: input.scope,
    installedAt: input.installedAt ?? new Date().toISOString(),
    target: input.target,
    config: {
      path: input.config.path,
      key: MCP_CONFIG_KEY,
      ...(input.config.fingerprint === undefined ? {} : { fingerprint: input.config.fingerprint }),
    },
    files: [...input.files],
  });
  if (!inspected.ok) throw new OperationalError(`cannot create the install manifest: ${inspected.failure.reason}`);
  return inspected.manifest;
}

/**
 * Read and validate the manifest in `targetDir`. Never throws for normal
 * states: absent is `missing`; invalid JSON/shape or a `target` mismatch is
 * `corrupt`; an unknown schema version is `unsupported`. Only a blank or
 * relative `targetDir` throws.
 */
export function readManifest(targetDir: string): ManifestReadResult {
  const dir = requireAbsoluteDir('read the install manifest', targetDir);
  const file = manifestPathFor(dir);

  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return { status: 'missing', reason: `no install manifest at ${file}` };
    return { status: 'corrupt', reason: `cannot read the install manifest (${code ?? 'unknown error'})` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', reason: 'install manifest is not valid JSON' };
  }

  const inspected = inspectManifest(parsed);
  if (!inspected.ok) return inspected.failure;
  if (!samePath(inspected.manifest.target, dir)) {
    return { status: 'corrupt', reason: `install manifest target ${inspected.manifest.target} does not match ${dir}` };
  }
  return { status: 'valid', manifest: inspected.manifest };
}

/** Deterministic manifest JSON for an already-validated manifest: 2-space indent, LF. */
export function renderManifest(manifest: InstallManifest): string {
  const config: Record<string, unknown> = { path: manifest.config.path, key: manifest.config.key };
  if (manifest.config.fingerprint !== undefined) config.fingerprint = manifest.config.fingerprint;
  const ordered = {
    schemaVersion: manifest.schemaVersion,
    package: manifest.package,
    version: manifest.version,
    source: manifest.source,
    scope: manifest.scope,
    installedAt: manifest.installedAt,
    target: manifest.target,
    config,
    files: [...manifest.files],
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/**
 * Validate and atomically write the manifest into `targetDir` (which must
 * already exist and match `manifest.target`). Throws `OperationalError` for a
 * blank/relative or mismatched target, an invalid manifest, or a missing
 * directory; the previous manifest is never left partially replaced.
 */
export function writeManifest(targetDir: string, manifest: InstallManifest): void {
  const dir = requireAbsoluteDir('write the install manifest', targetDir);
  const inspected = inspectManifest(manifest);
  if (!inspected.ok) throw new OperationalError(`cannot write the install manifest: ${inspected.failure.reason}`);
  if (!samePath(inspected.manifest.target, dir)) {
    throw new OperationalError(
      `cannot write the install manifest: target ${inspected.manifest.target} does not match ${dir}`
    );
  }
  if (!isExistingDirectory(dir)) {
    throw new OperationalError(`cannot write the install manifest: target is not an existing directory: ${dir}`);
  }
  writeFileAtomic(manifestPathFor(dir), renderManifest(inspected.manifest));
}

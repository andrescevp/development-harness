/**
 * package-meta.ts — locate the running package root and read its metadata.
 *
 * The installer runs from two layouts: the source tree (module at `src/lib` or
 * `src/cli`, two levels below the root) and the built bundle (`dist/cli.js`,
 * one level below it). Both are covered by checking `../package.json` and
 * `../../package.json` relative to the module directory. The name check
 * prevents resolving an unrelated parent package in a checkout or npx cache.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OperationalError } from '../cli/errors.js';

/** Canonical npm package name; also the managed plugin directory name. */
export const PACKAGE_NAME = 'dev-harness-skills';

const PACKAGE_JSON_CANDIDATES = ['../package.json', '../../package.json'] as const;

/** Resolved package identity for one module location. */
export interface PackageMeta {
  /** Absolute package root (the directory containing `package.json`). */
  readonly root: string;
  readonly name: typeof PACKAGE_NAME;
  readonly version: string;
}

interface LocatedPackage {
  readonly root: string;
  readonly file: string;
  readonly parsed: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // Unreadable or malformed candidates are skipped: another layout may match.
    return undefined;
  }
}

/**
 * Walk the two candidate parent directories and return the first
 * `package.json` whose `name` matches this package. Returns the parsed value
 * too so callers do not read the file twice.
 */
function locatePackage(moduleUrl: string | URL): LocatedPackage {
  let moduleDir: string;
  try {
    moduleDir = path.dirname(fileURLToPath(moduleUrl));
  } catch (err) {
    throw new OperationalError('cannot resolve the package root: module URL is not a file URL', { cause: err });
  }

  for (const candidate of PACKAGE_JSON_CANDIDATES) {
    const file = path.resolve(moduleDir, candidate);
    const parsed = readJson(file);
    if (isRecord(parsed) && parsed.name === PACKAGE_NAME) {
      return { root: path.dirname(file), file, parsed };
    }
  }

  throw new OperationalError(
    `cannot locate the ${PACKAGE_NAME} package root from ${moduleDir}: no matching package.json in a parent directory`
  );
}

/**
 * Absolute package root for `moduleUrl` (a file URL or URL instance).
 * Throws `OperationalError` when neither candidate package.json exists or the
 * nearest one belongs to another package.
 */
export function findPackageRoot(moduleUrl: string | URL): string {
  return locatePackage(moduleUrl).root;
}

/**
 * Package root, canonical name, and version in one read. Throws when the root
 * cannot be found or the version is missing/blank.
 */
export function readPackageMeta(moduleUrl: string | URL): PackageMeta {
  const located = locatePackage(moduleUrl);
  const version = isRecord(located.parsed) ? located.parsed.version : undefined;
  if (typeof version !== 'string' || version.trim() === '') {
    throw new OperationalError(`package.json at ${located.file} has no valid version`);
  }
  return { root: located.root, name: PACKAGE_NAME, version };
}

/**
 * Version string from the nearest matching package.json. The message stays
 * stable for the CLI entry's operational-error contract; the underlying reason
 * is preserved as `cause`.
 */
export function resolvePackageVersion(moduleUrl: string | URL): string {
  try {
    return readPackageMeta(moduleUrl).version;
  } catch (err) {
    throw new OperationalError('cannot read the package version from package.json', { cause: err });
  }
}

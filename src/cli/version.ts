/**
 * version.ts — package version lookup shared by commands.
 *
 * Kept at the CLI directory depth so `package-meta` resolves both layouts:
 * source (`src/cli` → `../../package.json`) and the built bundle
 * (`dist/cli.js` → `../package.json`). Importing this module has no side
 * effects; the read happens on call.
 */
import { resolvePackageVersion } from '../lib/package-meta.js';

/** Package version of the running CLI (source or bundled layout). */
export function resolveCliVersion(): string {
  return resolvePackageVersion(import.meta.url);
}

/**
 * plugin-layout.ts — the built artifact layout the managed installer copies.
 *
 * The server plugin ships ONE self-contained bundle (`dist/plugin.js`); the TUI
 * part ships `dist/tui.js`, whose `@opencode/plugin/tui`, `solid-js` and
 * `@opentui/*` imports are injected by the opencode host at runtime. Both live
 * beside the `dist/assets` corpus. Resolution fails early with an actionable
 * error when the checkout was never built; the TUI bundle is validated by
 * presence/size only — its bare imports are expected and never scanned.
 */
import fs from 'node:fs';
import path from 'node:path';
import { OperationalError } from './errors.js';

/** Self-contained server bundle (no bare imports at load time). */
export const BUNDLE_FILE = 'plugin.js';
/** Host-linked TUI part, published as `exports["./tui"]`. */
export const TUI_BUNDLE_FILE = 'tui.js';
/** Agent/skill corpus copied into the managed layout. */
export const ASSETS_DIR = 'assets';

/** Absolute paths of the build artifacts a managed install needs. */
export interface BuiltLayout {
  readonly bundle: string;
  readonly tuiBundle: string;
  readonly assets: string;
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

/** A regular file with at least one byte (a partial/aborted build emits zero). */
export function isNonEmptyFile(candidate: string): boolean {
  try {
    const stats = fs.statSync(candidate);
    return stats.isFile() && stats.size > 0;
  } catch {
    return false;
  }
}

/** Fail early when running from a source checkout without a build. */
export function requireBuiltLayout(packageRoot: string): BuiltLayout {
  const bundle = path.join(packageRoot, 'dist', BUNDLE_FILE);
  const tuiBundle = path.join(packageRoot, 'dist', TUI_BUNDLE_FILE);
  const assets = path.join(packageRoot, 'dist', ASSETS_DIR);
  if (!isFile(bundle)) {
    throw new OperationalError(
      `cannot materialize the plugin: ${bundle} is missing; build the package first (pnpm build) or install from the published package`
    );
  }
  if (!isNonEmptyFile(tuiBundle)) {
    throw new OperationalError(
      `cannot materialize the plugin: ${tuiBundle} is missing or empty; build the package first (pnpm build) or install from the published package`
    );
  }
  if (!isDirectory(assets)) {
    throw new OperationalError(
      `cannot materialize the plugin: ${assets} is missing; build the package assets first (pnpm build)`
    );
  }
  return { bundle, tuiBundle, assets };
}

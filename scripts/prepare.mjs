/**
 * npm `prepare` hook — runs on install, including git installs
 * (`npm i github:andrescevp/development-harness`, the path npx uses to cache
 * this package). Git checkouts never carry dist/, so they build; local
 * installs that already built skip (keeping `pnpm install` fast).
 *
 * Completion is the `dist/.build-ok` sentinel written as the FINAL step of
 * copy-assets (last step of both build variants) — a partial build (tsup
 * emitted, tsc/copy-assets failed) or a zero-byte artifact never counts.
 * `npm` is used deliberately: the install context may lack pnpm.
 *
 * All diagnostics go to STDERR so `npm pack --dry-run --json` stays
 * machine-parseable.
 */
import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = ['dist/plugin.js', 'dist/mcp/stdio.js', 'dist/cli.js'];
const sentinel = join(root, 'dist', '.build-ok');

function isComplete() {
  if (!existsSync(sentinel)) return false;
  return artifacts.every((rel) => {
    try {
      return statSync(join(root, rel)).size > 0;
    } catch {
      return false;
    }
  });
}

if (isComplete()) {
  console.error('[prepare] dist artifacts present — skipping build');
  process.exit(0);
}

// Production installs (`--omit=dev`) carry no tsup; packaged consumers get
// dist from the tarball, so a missing toolchain is a skip, not a failure.
try {
  createRequire(import.meta.url).resolve('tsup');
} catch {
  console.error('[prepare] build tooling not installed (dev dependencies omitted) — skipping build');
  process.exit(0);
}

console.error('[prepare] dist missing — running npm run build:runtime');
try {
  execSync('npm run build:runtime', { cwd: root, stdio: ['ignore', 2, 2] });
} catch (error) {
  // Numeric status → propagate it; signal termination has no numeric status.
  if (typeof error.status === 'number') process.exit(error.status);
  console.error('[prepare] build did not complete:', error.message);
  process.exit(1);
}

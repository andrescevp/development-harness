/**
 * bundle.test.ts — the built dist/plugin.js must be SELF-CONTAINED at load
 * time: opencode v2.0.18's global-plugin loader cannot resolve bare imports
 * from the ~/.config/opencode/plugins directory (documented limitation),
 * so the bundle must not evaluate any bare specifier during module load.
 *
 * Strategy: @opencode/plugin and yaml are bundled in by tsup; duckdb is a
 * lazy require() inside sheet-tools (only evaluated when a sheet tool runs).
 * This test loads dist/plugin.js from an isolated directory with NO
 * node_modules and asserts the module evaluates (builtins + relative paths
 * only at top level).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_PLUGIN = path.join(REPO_ROOT, 'dist', 'plugin.js');

const BUILTIN_MODULES = new Set([
  'node:child_process',
  'child_process',
  'node:crypto',
  'crypto',
  'node:fs',
  'fs',
  'node:module',
  'module',
  'node:os',
  'os',
  'node:path',
  'path',
  'node:url',
  'url',
  'node:util',
  'util',
  'node:events',
  'events',
  'node:stream',
  'node:buffer',
  'buffer',
  'node:assert',
  'node:process',
  'process',
]);

/** duckdb is the one allowed lazy external — a require() inside the
 * getDuckdb() accessor, only evaluated when a sheet tool runs. The
 * isolated-evaluation test below proves it is not evaluated at load. */
const ALLOWED_LAZY_EXTERNALS = new Set(['duckdb']);

describe('dist/plugin.js self-contained bundle', () => {
  it('dist is built (run `pnpm build` first)', () => {
    expect(fs.existsSync(DIST_PLUGIN)).toBe(true);
  });

  it('has no top-level bare imports beyond node builtins', () => {
    const src = fs.readFileSync(DIST_PLUGIN, 'utf8');
    const staticImports = [...src.matchAll(/(?:^|\n)import[^;]*?from\s+"([^"]+)"/g)].map((m) => m[1]!);
    const dynamicImports = [...src.matchAll(/import\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]!);
    const createdRequires = [...src.matchAll(/require2?\("([^"]+)"\)/g)].map((m) => m[1]!);
    const bare = [...staticImports, ...dynamicImports, ...createdRequires].filter((s) => {
      if (s.startsWith('.') || s.startsWith('/')) return false;
      if (BUILTIN_MODULES.has(s)) return false;
      return !ALLOWED_LAZY_EXTERNALS.has(s);
    });
    expect(bare).toEqual([]);
  });

  it('evaluates in an isolated directory with no node_modules', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dhs-bundle-'));
    try {
      const target = path.join(tmp, 'plugin.js');
      fs.copyFileSync(DIST_PLUGIN, target);
      const mod = (await import(pathToFileURL(target).href)) as {
        default: { id: string; setup: () => unknown };
      };
      expect(mod.default.id).toBe('dev-harness-skills');
      expect(typeof mod.default.setup).toBe('function');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
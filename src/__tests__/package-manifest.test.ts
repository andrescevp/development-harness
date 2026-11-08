/**
 * package-manifest.test.ts — npm publish metadata contract (5.2).
 *
 * The registry tarball must resolve the built plugin from `dist` for
 * `opencode plugin add <npm spec>`. Source checkouts keep the repo-root
 * `index.ts`: OpenCode's plugin-directory discovery resolves `<dir>/index`
 * directly (Bun.resolveSync of `path.resolve(dir, 'index')`) and never reads
 * package `main`/`exports`, so moving the package entry does not break it.
 *
 * Guards entry points, shipped files, public publish config, and the
 * build-only pack lifecycle (no Docker or network QA gates).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST_FILE = path.join(REPO_ROOT, 'package.json');
const SOURCE_ENTRY = path.join(REPO_ROOT, 'index.ts');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readManifest(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  if (!isRecord(parsed)) throw new Error('package.json must contain a JSON object');
  return parsed;
}

const manifest = readManifest();
const scripts = isRecord(manifest.scripts) ? manifest.scripts : {};

describe('npm package entrypoints', () => {
  it('points main, types, and exports at the built plugin', () => {
    expect(manifest.main).toBe('./dist/plugin.js');
    expect(manifest.types).toBe('./dist/plugin.d.ts');
    expect(manifest.exports).toEqual({
      '.': {
        types: './dist/plugin.d.ts',
        import: './dist/plugin.js',
        default: './dist/plugin.js',
      },
      './package.json': './package.json',
    });
  });

  it('ships only the built artifacts and README in the tarball', () => {
    expect(manifest.files).toEqual(['dist', 'README.md']);
    expect(manifest.publishConfig).toEqual({ access: 'public' });
  });

  it('keeps source-mode discovery, runtime bins, and engines', () => {
    expect(fs.existsSync(SOURCE_ENTRY)).toBe(true);
    expect(fs.readFileSync(SOURCE_ENTRY, 'utf8')).toContain("export { default } from './src/plugin.js'");
    // npm strips `./`-prefixed bin targets during publish; keep them bare.
    expect(manifest.bin).toEqual({
      'dev-harness': 'dist/cli.js',
      'dev-harness-skills': 'dist/cli.js',
      'dev-harness-mcp': 'dist/mcp/stdio.js',
    });
    expect(manifest.engines).toEqual({ node: '>=20.11' });
  });

  it('builds at pack time without network or Docker QA gates', () => {
    // stdout is redirected to stderr so `npm pack --json` stays parseable.
    expect(scripts.prepack).toBe('npm run build 1>&2');
    expect(scripts.prepare).toBe('node scripts/prepare.mjs');
    for (const script of [scripts.prepack, scripts.prepare]) {
      expect(script).not.toMatch(/qa:check|docker|scan:|audit/);
    }
  });

  it('wires the offline install and tarball smokes into the full QA gate after the build', () => {
    expect(scripts['smoke-install']).toBe('node scripts/smoke-install.mjs');
    expect(scripts['smoke-pack']).toBe('node scripts/smoke-pack.mjs');
    expect(String(scripts['qa:check:full'])).toContain(
      'pnpm build && node scripts/smoke-install.mjs && node scripts/smoke-pack.mjs'
    );
  });
});

/**
 * package-meta.test.ts — shared package root/name/version resolution (2.3).
 *
 * Covers both layouts the installer runs from: the source tree (module two
 * levels below the root) and a built bundle (module inside `dist/`). Temp
 * fixtures cover missing and name-mismatched package.json files. No home,
 * network, or real repo state is touched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OperationalError } from '../cli/errors.js';
import { findPackageRoot, PACKAGE_NAME, readPackageMeta, resolvePackageVersion } from '../lib/package-meta.js';
import { throwingOf } from './helpers/errors.js';
import { withTempDir } from './helpers/temp-dir.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

function writePackage(file: string, name: string, version: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ name, version }), 'utf8');
}

function writeModule(file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '', 'utf8');
}

function moduleUrl(file: string): string {
  return pathToFileURL(file).href;
}

describe('findPackageRoot', () => {
  it('resolves the repo root from the source layout (src/lib)', () => {
    const sourceModule = new URL('../lib/package-meta.ts', import.meta.url);
    expect(findPackageRoot(sourceModule)).toBe(REPO_ROOT);
    expect(findPackageRoot(new URL('../cli/plugin-artifact.ts', import.meta.url))).toBe(REPO_ROOT);
    expect(PACKAGE_NAME).toBe('dev-harness-skills');
  });

  it('resolves a dist-shaped layout from the module directory', async () => {
    await withTempDir((dir) => {
      const root = path.join(dir, 'package');
      const module = path.join(root, 'dist', 'cli.js');
      writePackage(path.join(root, 'package.json'), PACKAGE_NAME, '1.2.3');
      writeModule(module);

      expect(findPackageRoot(moduleUrl(module))).toBe(root);
    });
  });

  it('rejects a parent package with a different name', async () => {
    await withTempDir((dir) => {
      const root = path.join(dir, 'package');
      const module = path.join(root, 'dist', 'cli.js');
      writePackage(path.join(root, 'package.json'), 'some-other-package', '1.2.3');
      writeModule(module);

      const error = throwingOf(() => findPackageRoot(moduleUrl(module)));
      expect(error.message).toMatch(/cannot locate the dev-harness-skills package root/);
      expect(error.message).toContain(path.join(root, 'dist'));
    });
  });

  it('rejects a layout without any package.json', async () => {
    await withTempDir((dir) => {
      const module = path.join(dir, 'loose', 'cli.js');
      writeModule(module);

      expect(throwingOf(() => findPackageRoot(moduleUrl(module))).message).toMatch(/cannot locate/);
    });
  });
});

describe('readPackageMeta + resolvePackageVersion', () => {
  it('returns the absolute root, canonical name, and version', async () => {
    await withTempDir((dir) => {
      const root = path.join(dir, 'package');
      const module = path.join(root, 'dist', 'plugin.js');
      writePackage(path.join(root, 'package.json'), PACKAGE_NAME, '9.8.7');
      writeModule(module);

      expect(readPackageMeta(moduleUrl(module))).toEqual({
        root,
        name: PACKAGE_NAME,
        version: '9.8.7',
      });
      expect(resolvePackageVersion(moduleUrl(module))).toBe('9.8.7');
    });
  });

  it('reports an actionable version failure when no package can be found', async () => {
    await withTempDir((dir) => {
      const module = path.join(dir, 'loose', 'cli.js');
      writeModule(module);

      const error = throwingOf(() => resolvePackageVersion(moduleUrl(module)));
      expect(error.message).toBe('cannot read the package version from package.json');
      expect(error.cause).toBeInstanceOf(OperationalError);
    });
  });

  it('rejects a package.json without a usable version', async () => {
    await withTempDir((dir) => {
      const root = path.join(dir, 'package');
      const module = path.join(root, 'dist', 'cli.js');
      writePackage(path.join(root, 'package.json'), PACKAGE_NAME, '');
      writeModule(module);

      expect(throwingOf(() => resolvePackageVersion(moduleUrl(module))).message).toMatch(/version/);
    });
  });
});

/**
 * fs-utils.test.ts — atomic, symlink-aware filesystem primitives (sub-task 2.2).
 *
 * Covers sibling staging, recursive permission-preserving copies, atomic
 * replace/rollback, symlink-safe removal, path validation, and confinement.
 * Every test uses temp directories under `os.tmpdir()` and removes them in a
 * `finally`; no real home, repo state, or network is touched.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OperationalError } from '../errors.js';
import {
  assertConfined,
  atomicSwap,
  copyTree,
  defaultFsOperations,
  ensureDirectory,
  type FsOperations,
  isSymlink,
  removePath,
  stageDirectory,
} from '../fs-utils.js';
import { PathConfinementError } from '../scope.js';

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'dh-fs-utils-'));
  try {
    await run(dir);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

async function writeFile(file: string, contents: string, mode = 0o644): Promise<void> {
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, contents, { mode });
  await fs.promises.chmod(file, mode); // creation is umask-filtered
}

async function rejected(promise: Promise<unknown>): Promise<OperationalError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(OperationalError);
    return err as OperationalError;
  }
  throw new Error('expected the promise to reject');
}

const entries = async (dir: string): Promise<string[]> => (await fs.promises.readdir(dir)).sort();

const modeOf = async (file: string): Promise<number> => (await fs.promises.stat(file)).mode & 0o777;
const exists = (target: string): boolean => fs.existsSync(target);

describe('stageDirectory', () => {
  it('creates a unique sibling temp directory without touching the target', async () => {
    await withTempDir(async (dir) => {
      const target = path.join(dir, 'plugins', 'dev-harness-skills');
      const first = await stageDirectory(target);
      const second = await stageDirectory(target);
      const pattern = new RegExp(`^${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.tmp-${process.pid}-[0-9a-f]{8}$`);
      expect(first).toMatch(pattern);
      expect(second).not.toBe(first);
      expect((await fs.promises.stat(first)).isDirectory()).toBe(true);
      expect(await isSymlink(first)).toBe(false);
      expect(exists(target)).toBe(false);
    });
  });

  it('creates missing parent directories for the staging sibling', async () => {
    await withTempDir(async (dir) => {
      const target = path.join(dir, 'one', 'two', 'plugin');
      const staging = await stageDirectory(target);
      expect((await fs.promises.stat(path.dirname(staging))).isDirectory()).toBe(true);
    });
  });
});

describe('copyTree', () => {
  it('copies nested files and directories, preserving file modes', async () => {
    await withTempDir(async (dir) => {
      const source = path.join(dir, 'source');
      const destination = path.join(dir, 'deep', 'destination');
      await writeFile(path.join(source, 'plain.txt'), 'plain', 0o640);
      await writeFile(path.join(source, 'nested', 'script.sh'), '#!/bin/sh\n', 0o755);
      await fs.promises.mkdir(path.join(source, 'empty'), { recursive: true });

      await copyTree(source, destination);

      expect(await fs.promises.readFile(path.join(destination, 'plain.txt'), 'utf8')).toBe('plain');
      expect(await modeOf(path.join(destination, 'plain.txt'))).toBe(0o640);
      expect(await fs.promises.readFile(path.join(destination, 'nested', 'script.sh'), 'utf8')).toBe('#!/bin/sh\n');
      expect(await modeOf(path.join(destination, 'nested', 'script.sh'))).toBe(0o755);
      expect((await fs.promises.stat(path.join(destination, 'empty'))).isDirectory()).toBe(true);
    });
  });

  it('rejects symbolic links in the source instead of following them', async () => {
    await withTempDir(async (dir) => {
      const source = path.join(dir, 'source');
      const outside = path.join(dir, 'outside');
      await writeFile(path.join(outside, 'secret.txt'), 'secret', 0o600);
      await writeFile(path.join(source, 'real.txt'), 'real', 0o644);
      await fs.promises.symlink(outside, path.join(source, 'link'), 'dir');

      const error = await rejected(copyTree(source, path.join(dir, 'destination')));

      expect(error.message).toMatch(/symbolic link/);
      expect(exists(path.join(dir, 'destination', 'link'))).toBe(false);
      expect(exists(path.join(outside, 'secret.txt'))).toBe(true);
    });
  });

  it('fails clearly when the source is missing', async () => {
    await withTempDir(async (dir) => {
      const error = await rejected(copyTree(path.join(dir, 'absent'), path.join(dir, 'destination')));
      expect(error.message).toMatch(/cannot copy/);
    });
  });
});

describe('atomicSwap', () => {
  async function swapFixture(dir: string, existing?: string): Promise<{ target: string; staging: string }> {
    const target = path.join(dir, 'plugin');
    const staging = path.join(dir, 'staging');
    if (existing !== undefined) await writeFile(path.join(target, 'old.txt'), existing);
    await writeFile(path.join(staging, 'new.txt'), 'new');
    return { target, staging };
  }

  it('installs into an absent target and leaves no temp or backup residue', async () => {
    await withTempDir(async (dir) => {
      const { target, staging } = await swapFixture(dir);

      await atomicSwap(staging, target);

      expect(await fs.promises.readFile(path.join(target, 'new.txt'), 'utf8')).toBe('new');
      expect(exists(staging)).toBe(false);
      expect(await entries(dir)).toEqual(['plugin']);
    });
  });

  it('replaces an existing target and removes the backup', async () => {
    await withTempDir(async (dir) => {
      const { target, staging } = await swapFixture(dir, 'old');

      await atomicSwap(staging, target);

      expect(await fs.promises.readFile(path.join(target, 'new.txt'), 'utf8')).toBe('new');
      expect(exists(path.join(target, 'old.txt'))).toBe(false);
      expect(exists(staging)).toBe(false);
      expect(await entries(dir)).toEqual(['plugin']);
    });
  });

  it('restores the previous target and cleans staging when the swap fails', async () => {
    await withTempDir(async (dir) => {
      const { target, staging } = await swapFixture(dir, 'old');

      let injected = false;
      const failingOps: FsOperations = {
        ...defaultFsOperations,
        rename: async (from, to) => {
          if (!injected && from === staging && to === target) {
            injected = true;
            throw new Error('injected rename failure');
          }
          await defaultFsOperations.rename(from, to);
        },
      };

      const error = await rejected(atomicSwap(staging, target, failingOps));

      expect(injected).toBe(true);
      expect(error.message).toMatch(/previous installation was restored/);
      expect(await fs.promises.readFile(path.join(target, 'old.txt'), 'utf8')).toBe('old');
      expect(exists(path.join(target, 'new.txt'))).toBe(false);
      expect(exists(staging)).toBe(false);
      expect(await entries(dir)).toEqual(['plugin']);
    });
  });

  it('refuses a symlink target without following or replacing it', async () => {
    await withTempDir(async (dir) => {
      const outside = path.join(dir, 'outside');
      const target = path.join(dir, 'plugin');
      const staging = path.join(dir, 'staging');
      await writeFile(path.join(outside, 'keep.txt'), 'keep');
      await writeFile(path.join(staging, 'new.txt'), 'new');
      await fs.promises.symlink(outside, target, 'dir');

      const error = await rejected(atomicSwap(staging, target));

      expect(error.message).toMatch(/symbolic link/);
      expect(await isSymlink(target)).toBe(true);
      expect(await fs.promises.readFile(path.join(outside, 'keep.txt'), 'utf8')).toBe('keep');
      expect(exists(path.join(outside, 'new.txt'))).toBe(false);
      expect(exists(staging)).toBe(false);
    });
  });
});

describe('removePath', () => {
  it('removes a directory tree recursively', async () => {
    await withTempDir(async (dir) => {
      const victim = path.join(dir, 'victim');
      await writeFile(path.join(victim, 'nested', 'file.txt'), 'content');
      await removePath(victim);
      expect(exists(victim)).toBe(false);
    });
  });

  it('removes a symlink as a link and never follows it', async () => {
    await withTempDir(async (dir) => {
      const outside = path.join(dir, 'outside');
      const link = path.join(dir, 'link');
      await writeFile(path.join(outside, 'keep.txt'), 'keep');
      await fs.promises.symlink(outside, link, 'dir');

      await removePath(link);

      expect(exists(link)).toBe(false);
      expect(await fs.promises.readFile(path.join(outside, 'keep.txt'), 'utf8')).toBe('keep');
    });
  });

  it('is a no-op for a missing path', async () => {
    await withTempDir(async (dir) => {
      await expect(removePath(path.join(dir, 'absent'))).resolves.toBeUndefined();
    });
  });
});

describe('assertConfined', () => {
  it('accepts the root and its descendants and rejects escapes', () => {
    const root = path.join(os.tmpdir(), 'dh-confined-root');
    expect(() => assertConfined(root, root)).not.toThrow();
    expect(() => assertConfined(root, path.join(root, 'plugins', 'a'))).not.toThrow();
    expect(() => assertConfined(root, path.join(root, '..', 'escape'))).toThrow(PathConfinementError);
    expect(() => assertConfined(root, `${root}-other`)).toThrow(PathConfinementError);
  });
});

describe('isSymlink', () => {
  it('detects links and returns false for files, directories, and missing paths', async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'file');
      const directory = path.join(dir, 'directory');
      const link = path.join(dir, 'link');
      await writeFile(file, 'file');
      await fs.promises.mkdir(directory);
      await fs.promises.symlink(file, link);

      expect(await isSymlink(link)).toBe(true);
      expect(await isSymlink(file)).toBe(false);
      expect(await isSymlink(directory)).toBe(false);
      expect(await isSymlink(path.join(dir, 'absent'))).toBe(false);
    });
  });
});

describe('ensureDirectory', () => {
  it('creates nested directories with 0755 and is idempotent', async () => {
    await withTempDir(async (dir) => {
      const nested = path.join(dir, 'one', 'two');
      await ensureDirectory(nested);
      await ensureDirectory(nested);

      expect((await fs.promises.stat(nested)).isDirectory()).toBe(true);
      expect(await modeOf(nested)).toBe(0o755);
    });
  });

  it('fails clearly when the path is an existing file', async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'file');
      await writeFile(file, 'file');
      const error = await rejected(ensureDirectory(file));
      expect(error.message).toMatch(/cannot create directory/);
    });
  });
});

describe('path validation', () => {
  const INVALID = ['', '   ', 'relative/path'];

  it.each(INVALID)('rejects the invalid path %j with an OperationalError', async (value) => {
    const other = path.join(os.tmpdir(), 'dh-fs-utils-other');
    await rejected(removePath(value));
    await rejected(stageDirectory(value));
    await rejected(ensureDirectory(value));
    await rejected(isSymlink(value));
    await rejected(copyTree(value, other));
    await rejected(copyTree(other, value));
    await rejected(atomicSwap(value, other));
    await rejected(atomicSwap(other, value));
  });
});

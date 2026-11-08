/**
 * atomic-write.test.ts — synchronous atomic file writes (overwrite + exclusive).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeFileAtomic, writeFileExclusiveAtomic } from '../lib/atomic-write.js';

let dir: string | undefined;

afterEach(() => {
  vi.restoreAllMocks();
  if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function tempDir(): string {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dhs-atomic-'));
  return dir;
}

function tmpResidue(d: string): string[] {
  return fs.readdirSync(d).filter((name) => name.endsWith('.tmp'));
}

/** Run `write`, returning the thrown errno code (undefined when it succeeds). */
function errnoCode(write: () => void): string | undefined {
  try {
    write();
  } catch (err) {
    return (err as NodeJS.ErrnoException).code;
  }
  return undefined;
}

describe('writeFileAtomic (overwrite)', () => {
  it('writes the exact content and leaves no temp residue', () => {
    const d = tempDir();
    const file = path.join(d, 'plan.md');
    fs.writeFileSync(file, 'old', 'utf8');
    writeFileAtomic(file, 'new content\n');
    expect(fs.readFileSync(file, 'utf8')).toBe('new content\n');
    expect(tmpResidue(d)).toEqual([]);
  });

  it('preserves the original and cleans the temp when the rename fails', () => {
    const d = tempDir();
    const file = path.join(d, 'plan.md');
    fs.writeFileSync(file, 'original', 'utf8');
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('rename boom');
    });
    expect(() => writeFileAtomic(file, 'new')).toThrow('rename boom');
    vi.restoreAllMocks();
    expect(fs.readFileSync(file, 'utf8')).toBe('original');
    expect(tmpResidue(d)).toEqual([]);
  });

  it('replaces a final-component symlink without writing through it', () => {
    const d = tempDir();
    const target = path.join(d, 'outside.md');
    fs.writeFileSync(target, 'untouched', 'utf8');
    const file = path.join(d, 'link.md');
    fs.symlinkSync(target, file);
    writeFileAtomic(file, 'replaced');
    expect(fs.readFileSync(file, 'utf8')).toBe('replaced');
    expect(fs.lstatSync(file).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(target, 'utf8')).toBe('untouched');
  });

  it('preserves the existing file mode on overwrite', () => {
    const d = tempDir();
    const file = path.join(d, 'plan.md');
    fs.writeFileSync(file, 'old', { mode: 0o600 });
    fs.chmodSync(file, 0o600);
    writeFileAtomic(file, 'new');
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it('never writes through a pre-planted temp symlink', () => {
    const d = tempDir();
    const file = path.join(d, 'plan.md');
    fs.writeFileSync(file, 'original', 'utf8');
    const victim = path.join(d, 'victim.md');
    fs.writeFileSync(victim, 'victim', 'utf8');
    // Pin the suffix so every retry lands on the same (pre-planted) temp path.
    const suffix = Buffer.alloc(4, 0xab);
    vi.spyOn(crypto, 'randomBytes').mockReturnValue(suffix as never);
    const temp = `${file}.${process.pid}.${suffix.toString('hex')}.tmp`;
    fs.symlinkSync(victim, temp);
    expect(() => writeFileAtomic(file, 'new')).toThrow(/unique temp/);
    vi.restoreAllMocks();
    expect(fs.readFileSync(victim, 'utf8')).toBe('victim');
    expect(fs.readFileSync(file, 'utf8')).toBe('original');
  });
});

describe('writeFileExclusiveAtomic', () => {
  it('creates the file with the exact content and no temp residue', () => {
    const d = tempDir();
    const file = path.join(d, 'plan.md');
    writeFileExclusiveAtomic(file, 'created\n');
    expect(fs.readFileSync(file, 'utf8')).toBe('created\n');
    expect(tmpResidue(d)).toEqual([]);
  });

  it('refuses an existing file with EEXIST, preserving it and cleaning the temp', () => {
    const d = tempDir();
    const file = path.join(d, 'plan.md');
    fs.writeFileSync(file, 'original', 'utf8');
    expect(errnoCode(() => writeFileExclusiveAtomic(file, 'clobber'))).toBe('EEXIST');
    expect(fs.readFileSync(file, 'utf8')).toBe('original');
    expect(tmpResidue(d)).toEqual([]);
  });

  it('refuses a symlinked destination with EEXIST, leaving the target untouched', () => {
    const d = tempDir();
    const victim = path.join(d, 'victim.md');
    fs.writeFileSync(victim, 'victim', 'utf8');
    const file = path.join(d, 'plan.md');
    fs.symlinkSync(victim, file);
    expect(errnoCode(() => writeFileExclusiveAtomic(file, 'clobber'))).toBe('EEXIST');
    expect(fs.readFileSync(victim, 'utf8')).toBe('victim');
    expect(fs.lstatSync(file).isSymbolicLink()).toBe(true);
    expect(tmpResidue(d)).toEqual([]);
  });
});

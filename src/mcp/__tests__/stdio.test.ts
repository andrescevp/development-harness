/**
 * stdio.test.ts — entry-level guarantees: import purity, version/root
 * resolution, main-entry detection, and the harness instructions.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeHarness, connectHarness } from '../../__tests__/helpers/mcp.js';
import { HARNESS_INSTRUCTIONS, isMainEntry, resolveRoot, resolveVersion } from '../stdio.js';

/** On-disk path of the module under test (source layout, hence `.ts`). */
const STDIO_SOURCE = fileURLToPath(new URL('../stdio.ts', import.meta.url));

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await closeHarness();
});

describe('import purity', () => {
  it('re-evaluates silently twice: no stdout/stderr writes, no signal or stdin listeners', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const sigintBefore = process.listenerCount('SIGINT');
    const sigtermBefore = process.listenerCount('SIGTERM');
    const stdinDataBefore = process.stdin.listenerCount('data');
    vi.resetModules();
    await import('../stdio.js');
    vi.resetModules();
    await import('../stdio.js');
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
    expect(process.listenerCount('SIGINT')).toBe(sigintBefore);
    expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore);
    expect(process.stdin.listenerCount('data')).toBe(stdinDataBefore);
  });
});

describe('isMainEntry', () => {
  it('is true for the real script path', () => {
    expect(isMainEntry(STDIO_SOURCE)).toBe(true);
  });

  it('is true through a symlink to the script (npm/npx bin layout)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dhs-main-'));
    try {
      const link = path.join(dir, 'dev-harness-mcp');
      fs.symlinkSync(STDIO_SOURCE, link);
      expect(isMainEntry(link)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is false for undefined and for non-existent paths (no throw)', () => {
    expect(isMainEntry(undefined)).toBe(false);
    expect(isMainEntry(path.join(os.tmpdir(), 'dhs-main-missing', 'entry.js'))).toBe(false);
  });
});

describe('resolveVersion', () => {
  it('resolves the package version from package.json (source layout)', () => {
    const pkg = JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(resolveVersion()).toBe(pkg.version);
  });

  it('falls back to 0.0.0 when package.json is unreadable', async () => {
    vi.resetModules();
    const mod = await import('../stdio.js');
    const spy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(mod.resolveVersion()).toBe('0.0.0');
    spy.mockRestore();
  });

  it('falls back to 0.0.0 on malformed JSON', async () => {
    vi.resetModules();
    const mod = await import('../stdio.js');
    const spy = vi.spyOn(fs, 'readFileSync').mockReturnValue('{not json');
    expect(mod.resolveVersion()).toBe('0.0.0');
    spy.mockRestore();
  });

  it('reads package.json once per process (memoized)', async () => {
    vi.resetModules();
    const mod = await import('../stdio.js');
    const spy = vi.spyOn(fs, 'readFileSync');
    mod.resolveVersion();
    mod.resolveVersion();
    const reads = spy.mock.calls.filter(([target]) => String(target).endsWith('package.json'));
    expect(reads).toHaveLength(1);
  });
});

describe('resolveRoot', () => {
  it('resolves the workspace root at call time', () => {
    vi.stubEnv('DH_WORKSPACE_ROOT', '');
    vi.spyOn(process, 'cwd').mockReturnValue('/mock-cwd');
    expect(resolveRoot()).toBe(path.resolve('/mock-cwd'));
  });

  it('passes the blank-cwd error through unchanged', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('');
    expect(() => resolveRoot()).toThrow(/no workspace root available: cwd is empty/);
  });

  it('wraps cwd-resolution failures with context and a cause', () => {
    vi.spyOn(process, 'cwd').mockImplementation(() => {
      throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
    });
    let caught: Error | undefined;
    try {
      resolveRoot();
    } catch (err) {
      caught = err as Error;
    }
    if (!(caught instanceof Error)) throw new Error('expected resolveRoot to throw');
    expect(caught.message).toBe('workspace root unavailable: spawn ENOENT');
    expect((caught.cause as NodeJS.ErrnoException).code).toBe('ENOENT');
  });
});

describe('harness instructions', () => {
  it('are control-character free', () => {
    const hasControlChars = [...HARNESS_INSTRUCTIONS].some(
      (ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f
    );
    expect(hasControlChars).toBe(false);
  });

  it('surface through the initialize result (constructor mechanism)', async () => {
    const h = await connectHarness({ instructions: HARNESS_INSTRUCTIONS });
    expect(h.client.getInstructions()).toBe(HARNESS_INSTRUCTIONS);
  });
});

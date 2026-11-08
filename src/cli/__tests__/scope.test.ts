/**
 * scope.test.ts — scope resolution and path confinement (sub-task 1.2).
 *
 * Covers the global config-directory precedence, project root resolution from
 * `--path`/cwd, trailing-separator normalization, lexical (non-realpath) paths,
 * and the confinement primitive used to guard every write. Tests use temp
 * directories only and never touch the real home or OpenCode config.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXIT_FAILURE, OperationalError, parseArgs } from '../args.js';
import {
  assertPathWithin,
  CONFIG_FILE_NAME,
  type InstallScope,
  isPathWithin,
  MCP_CONFIG_KEY,
  PathConfinementError,
  PLUGIN_DIR_NAME,
  type ResolveScopeInput,
  resolveGlobalConfigDir,
  resolveInstallScope,
  type Scope,
} from '../scope.js';

const POSIX = path.posix;
const WIN32 = path.win32;

function thrown(run: () => unknown): unknown {
  try {
    run();
  } catch (err) {
    return err;
  }
  throw new Error('expected the function to throw');
}

function operationalError(run: () => unknown): OperationalError {
  const err = thrown(run);
  expect(err).toBeInstanceOf(OperationalError);
  expect((err as OperationalError).exitCode).toBe(EXIT_FAILURE);
  return err as OperationalError;
}

interface GlobalCase {
  readonly name: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform?: NodeJS.Platform;
  readonly cwd?: string;
  readonly home?: string;
  readonly expectedConfigDir: string;
}

const GLOBAL_CASES: readonly GlobalCase[] = [
  {
    name: 'OPENCODE_CONFIG_DIR wins over XDG and home',
    env: { OPENCODE_CONFIG_DIR: '/custom/opencode//', XDG_CONFIG_HOME: '/xdg' },
    cwd: '/work',
    home: '/home/alice',
    expectedConfigDir: '/custom/opencode',
  },
  {
    name: 'relative OPENCODE_CONFIG_DIR resolves from cwd',
    env: { OPENCODE_CONFIG_DIR: './opencode-alt/' },
    cwd: '/work',
    home: '/home/alice',
    expectedConfigDir: '/work/opencode-alt',
  },
  {
    name: 'blank OPENCODE_CONFIG_DIR falls through to XDG',
    env: { OPENCODE_CONFIG_DIR: '   ', XDG_CONFIG_HOME: '/xdg/' },
    cwd: '/work',
    home: '/home/alice',
    expectedConfigDir: '/xdg/opencode',
  },
  {
    name: 'XDG_CONFIG_HOME wins over home',
    env: { XDG_CONFIG_HOME: '/xdg' },
    cwd: '/work',
    home: '/home/alice',
    expectedConfigDir: '/xdg/opencode',
  },
  {
    name: 'home fallback uses ~/.config/opencode',
    env: {},
    cwd: '/work',
    home: '/home/alice',
    expectedConfigDir: '/home/alice/.config/opencode',
  },
  {
    name: 'Windows fallback uses APPDATA',
    env: { APPDATA: 'C:\\Users\\alice\\AppData\\Roaming\\' },
    platform: 'win32',
    cwd: 'C:\\work',
    home: 'C:\\Users\\alice',
    expectedConfigDir: WIN32.join('C:\\Users\\alice\\AppData\\Roaming', 'opencode'),
  },
];

describe.each(GLOBAL_CASES)('global scope: $name', ({ env, platform, cwd, home, expectedConfigDir }) => {
  it('resolves an absolute config dir and confined managed paths', () => {
    const isWindows = platform === 'win32';
    const p = isWindows ? WIN32 : POSIX;
    const result = resolveInstallScope({
      scope: 'global',
      env,
      platform: platform ?? 'linux',
      cwd: cwd ?? '/work',
      home: home ?? '/home/alice',
    });

    expect(result.scope).toBe('global');
    expect(result.configDir).toBe(expectedConfigDir);
    expect(result.targetDir).toBe(p.join(expectedConfigDir, 'plugins', PLUGIN_DIR_NAME));
    expect(result.configPath).toBe(p.join(expectedConfigDir, CONFIG_FILE_NAME));
    expect(result.configKey).toBe(MCP_CONFIG_KEY);
    expect(result.projectRoot).toBeUndefined();
    expect(p.isAbsolute(result.configDir)).toBe(true);
    expect(p.isAbsolute(result.targetDir)).toBe(true);
    expect(p.isAbsolute(result.configPath)).toBe(true);
  });
});

describe('global scope errors', () => {
  it('fails clearly when Windows APPDATA is unavailable', () => {
    const error = operationalError(() =>
      resolveGlobalConfigDir({ platform: 'win32', env: {}, cwd: 'C:\\work', home: 'C:\\Users\\alice' })
    );
    expect(error.message).toMatch(/APPDATA/);
  });

  it('never inspects the filesystem for the global scope', () => {
    let checked = false;
    resolveInstallScope({
      scope: 'global',
      env: { OPENCODE_CONFIG_DIR: '/tmp/opencode' },
      platform: 'linux',
      isDirectory: () => {
        checked = true;
        return false;
      },
    });
    expect(checked).toBe(false);
  });
});

let workspace: string;

beforeAll(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'dh-scope-'));
});

afterAll(() => {
  fs.rmSync(workspace, { recursive: true, force: true });
});

function projectDir(...segments: string[]): string {
  const dir = path.join(workspace, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveProject(overrides: Partial<ResolveScopeInput> = {}): InstallScope {
  return resolveInstallScope({
    scope: 'project',
    env: {},
    platform: 'linux',
    cwd: workspace,
    home: '/home/alice',
    ...overrides,
  });
}

function projectRootOf(scope: InstallScope): string {
  const root = scope.projectRoot;
  if (root === undefined) throw new Error('expected a project root');
  return root;
}

describe('project scope', () => {
  it('resolves a relative --path from cwd', () => {
    const expectedRoot = projectDir('packages', 'app');
    const result = resolveProject({ path: `${POSIX.join('packages', 'app')}/` });

    expect(result.scope).toBe('project');
    expect(projectRootOf(result)).toBe(expectedRoot);
    expect(result.configDir).toBe(path.join(expectedRoot, '.opencode'));
    expect(result.targetDir).toBe(path.join(expectedRoot, '.opencode', 'plugins', PLUGIN_DIR_NAME));
    expect(result.configPath).toBe(path.join(expectedRoot, CONFIG_FILE_NAME));
    expect(result.configKey).toBe(MCP_CONFIG_KEY);
    expect(fs.existsSync(result.configDir)).toBe(false);
    expect(fs.existsSync(result.targetDir)).toBe(false);
  });

  it('accepts an absolute --path and normalizes trailing separators', () => {
    const expectedRoot = projectDir('absolute');
    const result = resolveProject({ path: `${expectedRoot}${path.sep}${path.sep}` });

    expect(projectRootOf(result)).toBe(expectedRoot);
    expect(result.targetDir.endsWith(path.sep)).toBe(false);
    expect(result.configPath).toBe(path.join(expectedRoot, CONFIG_FILE_NAME));
  });

  it('defaults the project root to cwd', () => {
    const expectedRoot = projectDir('cwd-default');
    const result = resolveProject({ cwd: expectedRoot });

    expect(projectRootOf(result)).toBe(expectedRoot);
    expect(path.isAbsolute(result.targetDir)).toBe(true);
    expect(path.isAbsolute(result.configPath)).toBe(true);
  });

  it.skipIf(process.platform === 'win32')('keeps the lexical path instead of resolving symlinks', () => {
    const real = projectDir('real-project');
    const link = path.join(workspace, 'linked-project');
    fs.symlinkSync(real, link, 'dir');

    const result = resolveProject({ path: link });

    expect(projectRootOf(result)).toBe(link);
    expect(projectRootOf(result)).not.toBe(fs.realpathSync(link));
  });

  it('uses the injected directory checker', () => {
    const checked: string[] = [];
    const result = resolveProject({
      path: '/virtual/project',
      cwd: '/',
      isDirectory: (candidate) => {
        checked.push(candidate);
        return true;
      },
    });

    expect(projectRootOf(result)).toBe('/virtual/project');
    expect(checked).toEqual(['/virtual/project']);
  });
});

describe('project scope errors', () => {
  it('rejects a missing project directory', () => {
    const missing = path.join(workspace, 'missing');
    const error = operationalError(() => resolveProject({ path: missing }));
    expect(error.message).toMatch(/must be an existing directory/);
    expect(error.message).toContain(missing);
  });

  it('rejects a project path that is a file', () => {
    const file = path.join(workspace, 'not-a-dir.txt');
    fs.writeFileSync(file, 'x');
    const error = operationalError(() => resolveProject({ path: file }));
    expect(error.message).toMatch(/must be an existing directory/);
  });

  it.each(['', '   ', '\t'])('rejects a blank project path %j', (blank) => {
    const error = operationalError(() => resolveProject({ path: blank }));
    expect(error.message).toMatch(/must not be empty/);
  });
});

describe('path confinement', () => {
  it.each([
    { platform: 'linux' as const, root: '/root', candidate: '/root/child', expected: true },
    { platform: 'linux' as const, root: '/root', candidate: '/root/child/deep', expected: true },
    { platform: 'linux' as const, root: '/root', candidate: '/root', expected: true },
    { platform: 'linux' as const, root: '/root/', candidate: '/root/child', expected: true },
    { platform: 'linux' as const, root: '/root', candidate: '/other', expected: false },
    { platform: 'linux' as const, root: '/root', candidate: '/root-other', expected: false },
    { platform: 'linux' as const, root: '/root', candidate: '/root/../root-other', expected: false },
    { platform: 'linux' as const, root: '/root', candidate: '/root/child/../../escape', expected: false },
    { platform: 'win32' as const, root: 'C:\\root', candidate: 'C:\\root\\child', expected: true },
    { platform: 'win32' as const, root: 'C:\\root', candidate: 'C:\\root-other', expected: false },
    { platform: 'win32' as const, root: 'C:\\root', candidate: 'D:\\root\\child', expected: false },
  ])('$platform: isPathWithin($root, $candidate) is $expected', ({ platform, root, candidate, expected }) => {
    expect(isPathWithin(root, candidate, platform)).toBe(expected);
  });

  it('accepts children and throws a typed operational error on escapes', () => {
    expect(() => assertPathWithin('/root', '/root/child', 'linux')).not.toThrow();

    const err = thrown(() => assertPathWithin('/root', '/root-other', 'linux'));
    expect(err).toBeInstanceOf(PathConfinementError);
    expect(err).toBeInstanceOf(OperationalError);
    expect((err as PathConfinementError).exitCode).toBe(EXIT_FAILURE);
    expect((err as Error).message).toMatch(/escapes its install root/);
  });
});

describe('parser integration', () => {
  it('shares the Scope type with the argument parser', () => {
    const result = parseArgs(['install', '--global']);
    if (!result.ok || result.invocation.kind !== 'command') throw new Error('expected a command invocation');

    const scope: Scope | undefined = result.invocation.options.scope;
    expect(scope).toBe('global');
  });
});

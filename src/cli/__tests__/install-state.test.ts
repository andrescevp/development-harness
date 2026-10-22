/**
 * install-state.test.ts — ownership, version, and force classification (2.4).
 * Temp directories only; no home, network, or repo state is touched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { throwingOf } from '../../__tests__/helpers/errors.js';
import { withTempDir } from '../../__tests__/helpers/temp-dir.js';
import { OperationalError } from '../errors.js';
import {
  assertInstallable,
  classifyInstall,
  compareVersions,
  describeInstallState,
  type InstallState,
} from '../install-state.js';
import { createManifest, type InstallManifest, manifestPathFor } from '../manifest.js';

const CLI_VERSION = '1.2.3';
type ManifestMode = 'valid' | 'none' | 'corrupt' | 'unsupported' | 'mismatch';

interface TargetOptions {
  readonly version?: string;
  readonly files?: readonly string[];
  readonly onDisk?: readonly string[];
  readonly manifest?: ManifestMode;
  readonly rawVersion?: string;
}
function writeFile(root: string, relative: string): void {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `// ${relative}\n`, 'utf8');
}
function buildManifest(target: string, version: string, files: readonly string[]): InstallManifest {
  return createManifest({
    package: 'dev-harness-skills',
    version,
    source: 'dev-harness-skills',
    scope: 'global',
    target,
    config: { path: path.join(path.dirname(path.dirname(target)), 'opencode.jsonc') },
    files,
    installedAt: '2026-10-22T10:00:00.000Z',
  });
}

/** Build a plugin target with an optional manifest and on-disk files. */
function createTarget(root: string, options: TargetOptions = {}): string {
  const target = path.join(root, 'plugins', 'dev-harness-skills');
  fs.mkdirSync(target, { recursive: true });
  for (const file of options.onDisk ?? options.files ?? []) writeFile(target, file);

  const mode = options.manifest ?? 'valid';
  if (mode === 'none') return target;
  if (mode === 'corrupt') {
    fs.writeFileSync(manifestPathFor(target), '{ not json', 'utf8');
    return target;
  }

  const raw: Record<string, unknown> = {
    ...buildManifest(target, options.version ?? CLI_VERSION, options.files ?? []),
  };
  if (mode === 'unsupported') raw.schemaVersion = 2;
  if (mode === 'mismatch') raw.target = path.join(root, 'elsewhere');
  if (options.rawVersion !== undefined) raw.version = options.rawVersion;
  fs.writeFileSync(manifestPathFor(target), JSON.stringify(raw, null, 2), 'utf8');
  return target;
}

function managedState(root: string, options: TargetOptions = {}): InstallState {
  return classifyInstall(createTarget(root, options), CLI_VERSION);
}

/** Create a symlink pointing at a real managed target inside `root`. */
function symlinkTarget(root: string): string {
  const link = path.join(root, 'linked-target');
  fs.symlinkSync(createTarget(root, { files: [] }), link, 'dir');
  return link;
}

describe('classifyInstall', () => {
  it('treats a missing target and an empty directory as absent', async () => {
    await withTempDir((root) => {
      expect(classifyInstall(path.join(root, 'missing'), CLI_VERSION)).toMatchObject({
        status: 'absent',
        target: path.join(root, 'missing'),
      });
      const empty = path.join(root, 'empty');
      fs.mkdirSync(empty);
      expect(classifyInstall(empty, CLI_VERSION)).toMatchObject({
        status: 'absent',
        reason: expect.stringMatching(/empty/),
      });
    });
  });

  const MANAGED_CASES = [
    { name: 'current', installed: '1.2.3', cli: '1.2.3', status: 'managed-current' },
    { name: 'older', installed: '1.2.2', cli: '1.2.3', status: 'managed-older' },
    { name: 'newer', installed: '1.3.0', cli: '1.2.3', status: 'managed-newer' },
    { name: 'prerelease older', installed: '1.2.3-rc.2', cli: '1.2.3', status: 'managed-older' },
    { name: 'prerelease newer', installed: '1.2.3', cli: '1.2.3-rc.2', status: 'managed-newer' },
  ] as const;
  it.each(MANAGED_CASES)('classifies a $name managed install', async ({ installed, cli, status }) => {
    await withTempDir((root) => {
      const target = createTarget(root, { version: installed });
      const state = classifyInstall(target, cli);
      expect(state.status).toBe(status);
      expect(state.target).toBe(target);
      if ('manifest' in state) {
        expect(state.manifest.version).toBe(installed);
        expect(state.cliVersion).toBe(cli);
        expect(state.extraFiles).toEqual([]);
        expect(state.missingFiles).toEqual([]);
      }
    });
  });
  it('reports missing and extra files without touching them', async () => {
    await withTempDir((root) => {
      const target = createTarget(root, { files: ['index.ts', 'package.json'], onDisk: ['index.ts', 'notes.txt'] });
      expect(classifyInstall(target, CLI_VERSION)).toMatchObject({
        status: 'managed-current',
        missingFiles: ['package.json'],
        extraFiles: ['notes.txt'],
      });
    });
  });
  it('counts a symlink inside the target as an extra file and never follows it', async () => {
    await withTempDir((root) => {
      const target = createTarget(root, { files: [] });
      const outside = path.join(root, 'outside.txt');
      fs.writeFileSync(outside, 'outside\n', 'utf8');
      fs.symlinkSync(outside, path.join(target, 'linked.txt'));
      expect(classifyInstall(target, CLI_VERSION)).toMatchObject({
        status: 'managed-current',
        extraFiles: ['linked.txt'],
      });
    });
  });
  it('reports a non-empty directory and a regular file as unmanaged', async () => {
    await withTempDir((root) => {
      const dirState = classifyInstall(createTarget(root, { onDisk: ['index.ts'], manifest: 'none' }), CLI_VERSION);
      expect(dirState).toMatchObject({ status: 'unmanaged', symlink: false });
      if (dirState.status === 'unmanaged') expect(dirState.reason).toMatch(/manifest/);
      const file = path.join(root, 'target');
      fs.writeFileSync(file, 'not a directory\n', 'utf8');
      const fileState = classifyInstall(file, CLI_VERSION);
      expect(fileState).toMatchObject({ status: 'unmanaged', symlink: false });
      if (fileState.status === 'unmanaged') expect(fileState.reason).toMatch(/not a directory/);
    });
  });

  it.skipIf(process.platform === 'win32')('flags a symlinked target as unmanaged without following it', async () => {
    await withTempDir((root) => {
      const state = classifyInstall(symlinkTarget(root), CLI_VERSION);
      expect(state).toMatchObject({ status: 'unmanaged', symlink: true });
      if (state.status === 'unmanaged') expect(state.reason).toMatch(/symbolic link/);
    });
  });

  const CORRUPT_CASES = [
    { name: 'invalid JSON', options: { manifest: 'corrupt' }, pattern: /JSON/ },
    { name: 'a future schema version', options: { manifest: 'unsupported' }, pattern: /not supported/ },
    { name: 'a mismatched target', options: { manifest: 'mismatch' }, pattern: /does not match/ },
    { name: 'a malformed version', options: { rawVersion: 'not-a-version' }, pattern: /version/ },
  ] as const;
  it.each(CORRUPT_CASES)('reports $name as corrupt', async ({ options, pattern }) => {
    await withTempDir((root) => {
      const state = managedState(root, options);
      expect(state.status).toBe('corrupt');
      if (state.status === 'corrupt') expect(state.reason).toMatch(pattern);
    });
  });
  it('rejects blank and relative target directories', () => {
    expect(() => classifyInstall('', CLI_VERSION)).toThrow(OperationalError);
    expect(() => classifyInstall('plugins/dev-harness-skills', CLI_VERSION)).toThrow(/absolute/);
  });
});

describe('compareVersions', () => {
  const ORDERED = [
    '1.0.0-alpha',
    '1.0.0-alpha.1',
    '1.0.0-alpha.beta',
    '1.0.0-beta',
    '1.0.0-beta.2',
    '1.0.0-beta.11',
    '1.0.0-rc.1',
    '1.0.0',
  ];
  it('orders semver-like versions including prereleases', () => {
    for (let index = 1; index < ORDERED.length; index += 1) {
      expect(compareVersions(ORDERED[index - 1]!, ORDERED[index]!)).toBe(-1);
      expect(compareVersions(ORDERED[index]!, ORDERED[index - 1]!)).toBe(1);
      expect(compareVersions(ORDERED[index]!, ORDERED[index]!)).toBe(0);
    }
  });
  it('compares numeric cores numerically and ignores build metadata', () => {
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '10.0.0')).toBe(-1);
    expect(compareVersions('999999999999999999999.0.0', '2.0.0')).toBe(1);
    expect(compareVersions('1.2.3+build.9', '1.2.3')).toBe(0);
  });

  it.each(['1.2', 'v1.2.3', '1.2.3.4', '', ' 1.2.3', '1.2.x', '1.2.3-'])('rejects malformed version %j', (version) => {
    const error = throwingOf(() => compareVersions(version, '1.2.3'));
    expect(error.message).toMatch(/semver-like/);
  });
});

describe('assertInstallable', () => {
  it('allows absent, current, and upgrade states without force', async () => {
    await withTempDir((root) => {
      expect(assertInstallable(classifyInstall(path.join(root, 'missing'), CLI_VERSION))).toMatchObject({
        action: 'install',
        requiresForce: false,
      });
      expect(assertInstallable(managedState(root, { version: '1.2.3' }))).toMatchObject({
        action: 'noop',
        requiresForce: false,
      });
      expect(assertInstallable(managedState(root, { version: '1.0.0' }))).toMatchObject({
        action: 'upgrade',
        requiresForce: false,
      });
    });
  });
  it('allows a downgrade with a warning and no force', async () => {
    await withTempDir((root) => {
      const decision = assertInstallable(managedState(root, { version: '2.0.0' }));
      expect(decision.action).toBe('downgrade');
      expect(decision.requiresForce).toBe(false);
      expect(decision.warning).toMatch(/newer.*downgrade/);
    });
  });
  it('repairs drift at the current version with a warning', async () => {
    await withTempDir((root) => {
      const state = managedState(root, { files: ['index.ts'], onDisk: ['index.ts', 'extra.txt'] });
      const decision = assertInstallable(state);
      expect(decision.action).toBe('repair');
      expect(decision.warning).toMatch(/extra\.txt|unmanaged file/);
    });
  });
  it('refuses unmanaged and corrupt targets without force', async () => {
    await withTempDir((root) => {
      const unmanaged = classifyInstall(createTarget(root, { onDisk: ['index.ts'], manifest: 'none' }), CLI_VERSION);
      const error = throwingOf(() => assertInstallable(unmanaged));
      expect(error.message).toContain(path.join(root, 'plugins', 'dev-harness-skills'));
      expect(error.message).toMatch(/--force/);

      const corrupt = managedState(root, { manifest: 'corrupt' });
      expect(throwingOf(() => assertInstallable(corrupt)).message).toMatch(/corrupt.*--force/);
    });
  });
  it('replaces unmanaged and corrupt targets when forced', async () => {
    await withTempDir((root) => {
      const unmanaged = classifyInstall(createTarget(root, { onDisk: ['index.ts'], manifest: 'none' }), CLI_VERSION);
      expect(assertInstallable(unmanaged, { force: true })).toMatchObject({ action: 'replace', requiresForce: true });
      const corrupt = managedState(root, { manifest: 'corrupt' });
      expect(assertInstallable(corrupt, { force: true })).toMatchObject({ action: 'replace', requiresForce: true });
    });
  });

  it.skipIf(process.platform === 'win32')('never replaces a symlinked target, even with force', async () => {
    await withTempDir((root) => {
      const state = classifyInstall(symlinkTarget(root), CLI_VERSION);
      expect(throwingOf(() => assertInstallable(state, { force: true })).message).toMatch(/symbolic link/);
    });
  });
});

describe('describeInstallState', () => {
  it('produces single-line ASCII summaries for every state', async () => {
    await withTempDir((root) => {
      const states: InstallState[] = [
        classifyInstall(path.join(root, 'missing'), CLI_VERSION),
        managedState(path.join(root, 'current'), { version: '1.2.3' }),
        managedState(path.join(root, 'older'), { version: '1.0.0' }),
        managedState(path.join(root, 'newer'), { version: '2.0.0' }),
        classifyInstall(
          createTarget(path.join(root, 'unmanaged'), { onDisk: ['index.ts'], manifest: 'none' }),
          CLI_VERSION
        ),
        managedState(path.join(root, 'corrupt'), { manifest: 'corrupt' }),
      ];
      const lines = states.map(describeInstallState);
      for (const line of lines) {
        expect(line).toMatch(/^[\x20-\x7E]+$/);
        expect(line).not.toContain('\n');
      }
      expect(lines[0]).toMatch(/not installed/);
      expect(lines[1]).toMatch(/current/);
      expect(lines[2]).toMatch(/older/);
      expect(lines[3]).toMatch(/newer.*downgrade/);
      expect(lines[4]).toMatch(/unmanaged/);
      expect(lines[5]).toMatch(/corrupt/);
    });
  });
});

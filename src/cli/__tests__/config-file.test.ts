/**
 * config-file.test.ts — OpenCode config selection and safe persistence (3.2).
 *
 * Covers format selection (jsonc preferred over json), typed reads, atomic
 * writes with backups, mode preservation, parent creation, symlink write-
 * through, and scope confinement. Temp dirs only; no real home or network.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { throwingOf } from '../../__tests__/helpers/errors.js';
import { withTempDir } from '../../__tests__/helpers/temp-dir.js';
import {
  backupConfigFile,
  CONFIG_BACKUP_SUFFIX,
  readConfigFile,
  resolveConfigFile,
  writeConfigFile,
} from '../config-file.js';
import { type InstallScope, isPathWithin, MCP_CONFIG_KEY, type Scope } from '../scope.js';

function writeFile(file: string, contents: string, mode = 0o644): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, { mode });
  fs.chmodSync(file, mode);
}

function makeScope(root: string, scope: Scope): InstallScope {
  const configDir = scope === 'global' ? root : path.join(root, '.opencode');
  return {
    scope,
    configDir,
    targetDir: path.join(configDir, 'plugins', 'dev-harness-skills'),
    configPath: path.join(root, 'opencode.jsonc'),
    configKey: MCP_CONFIG_KEY,
    ...(scope === 'project' ? { projectRoot: root } : {}),
  };
}

const modeOf = (file: string): number => fs.statSync(file).mode & 0o777;
const exists = (target: string): boolean => fs.existsSync(target);
const tempResidue = (dir: string): string[] => fs.readdirSync(dir).filter((name) => name.endsWith('.tmp'));

interface SelectionCase {
  readonly name: string;
  readonly scope: Scope;
  readonly files: readonly string[];
  readonly expected: string;
}

const SELECTION_CASES: readonly SelectionCase[] = [
  { name: 'global jsonc only', scope: 'global', files: ['opencode.jsonc'], expected: 'opencode.jsonc' },
  { name: 'global json only', scope: 'global', files: ['opencode.json'], expected: 'opencode.json' },
  { name: 'global both', scope: 'global', files: ['opencode.json', 'opencode.jsonc'], expected: 'opencode.jsonc' },
  { name: 'global neither', scope: 'global', files: [], expected: 'opencode.jsonc' },
  { name: 'project jsonc only', scope: 'project', files: ['opencode.jsonc'], expected: 'opencode.jsonc' },
  { name: 'project json only', scope: 'project', files: ['opencode.json'], expected: 'opencode.json' },
  { name: 'project both', scope: 'project', files: ['opencode.json', 'opencode.jsonc'], expected: 'opencode.jsonc' },
  { name: 'project neither', scope: 'project', files: [], expected: 'opencode.jsonc' },
];

describe.each(SELECTION_CASES)('resolveConfigFile: $name', ({ scope, files, expected }) => {
  it('selects the config file inside the scope root', async () => {
    await withTempDir((dir) => {
      const root = path.join(dir, 'root');
      fs.mkdirSync(root);
      for (const file of files) writeFile(path.join(root, file), '{}\n');
      const resolved = resolveConfigFile(makeScope(root, scope));

      expect(resolved).toBe(path.join(root, expected));
      expect(isPathWithin(root, resolved)).toBe(true);
    });
  });
});

describe('resolveConfigFile edge cases', () => {
  it('ignores a project config stored inside .opencode', async () => {
    await withTempDir((dir) => {
      const root = path.join(dir, 'project');
      writeFile(path.join(root, '.opencode', 'opencode.json'), '{}\n');
      expect(resolveConfigFile(makeScope(root, 'project'))).toBe(path.join(root, 'opencode.jsonc'));
    });
  });

  it('rejects a project scope without a project root', () => {
    const scope: InstallScope = {
      scope: 'project',
      configDir: '/v/.opencode',
      targetDir: '/v/.opencode/plugins/x',
      configPath: '/v/opencode.jsonc',
      configKey: MCP_CONFIG_KEY,
    };
    expect(throwingOf(() => resolveConfigFile(scope)).message).toMatch(/project root/);
  });

  it('rejects a relative scope root', () => {
    const scope: InstallScope = {
      scope: 'global',
      configDir: 'relative/opencode',
      targetDir: 'relative/opencode/plugins/x',
      configPath: 'relative/opencode/opencode.jsonc',
      configKey: MCP_CONFIG_KEY,
    };
    expect(throwingOf(() => resolveConfigFile(scope)).message).toMatch(/must be absolute/);
  });
});

describe('readConfigFile', () => {
  it('returns missing for an absent config', async () => {
    await withTempDir((dir) => {
      expect(readConfigFile(path.join(dir, 'opencode.jsonc'))).toEqual({ status: 'missing' });
    });
  });

  it('returns text and permission bits for an existing config', async () => {
    await withTempDir((dir) => {
      const file = path.join(dir, 'opencode.jsonc');
      writeFile(file, '{\n  // keep\n}\n', 0o640);
      expect(readConfigFile(file)).toEqual({ status: 'found', text: '{\n  // keep\n}\n', mode: 0o640 });
    });
  });

  it('throws when the config path is not a regular file', async () => {
    await withTempDir((dir) => {
      const directory = path.join(dir, 'opencode.jsonc');
      fs.mkdirSync(directory);
      expect(throwingOf(() => readConfigFile(directory)).message).toMatch(/not a regular file/);
    });
  });

  it.each(['', '   ', 'relative/opencode.jsonc'])('rejects the invalid path %j', (value) => {
    expect(throwingOf(() => readConfigFile(value)).message).toMatch(/must be absolute|must not be blank/);
  });
});

describe('writeConfigFile', () => {
  it('creates a new config with mode 0600 and no backup or temp residue', async () => {
    await withTempDir((dir) => {
      const file = path.join(dir, 'opencode.jsonc');
      expect(writeConfigFile(file, '{}\n')).toEqual({ changed: true });
      expect(fs.readFileSync(file, 'utf8')).toBe('{}\n');
      expect(modeOf(file)).toBe(0o600);
      expect(exists(`${file}${CONFIG_BACKUP_SUFFIX}`)).toBe(false);
      expect(fs.readdirSync(dir)).toEqual(['opencode.jsonc']);
      expect(tempResidue(dir)).toEqual([]);
    });
  });

  it('creates missing parent directories with 0755 inside the scope root', async () => {
    await withTempDir((dir) => {
      const root = path.join(dir, 'deep', 'opencode');
      const file = path.join(root, 'opencode.jsonc');
      writeConfigFile(file, '{}\n', { root });
      expect(modeOf(root)).toBe(0o755);
      expect(fs.readFileSync(file, 'utf8')).toBe('{}\n');
    });
  });

  it('backs up the previous content and preserves the file mode on overwrite', async () => {
    await withTempDir((dir) => {
      const file = path.join(dir, 'opencode.jsonc');
      writeFile(file, 'old\n', 0o640);

      const result = writeConfigFile(file, 'new\n');

      expect(result).toEqual({ changed: true, backupPath: `${file}${CONFIG_BACKUP_SUFFIX}` });
      expect(readConfigFile(file)).toEqual({ status: 'found', text: 'new\n', mode: 0o640 });
      expect(readConfigFile(`${file}${CONFIG_BACKUP_SUFFIX}`)).toEqual({ status: 'found', text: 'old\n', mode: 0o640 });
      expect(tempResidue(dir)).toEqual([]);
    });
  });

  it('preserves a wider existing mode under a restrictive umask', async () => {
    await withTempDir((dir) => {
      const file = path.join(dir, 'opencode.jsonc');
      writeFile(file, 'old\n', 0o644);
      const previous = process.umask(0o077);
      try {
        writeConfigFile(file, 'new\n', { backup: false });
      } finally {
        process.umask(previous);
      }
      expect(modeOf(file)).toBe(0o644);
    });
  });

  it('is a no-op for identical content: no write, no backup, same inode', async () => {
    await withTempDir((dir) => {
      const file = path.join(dir, 'opencode.jsonc');
      writeFile(file, 'same\n', 0o640);
      const inode = fs.statSync(file).ino;
      expect(writeConfigFile(file, 'same\n')).toEqual({ changed: false });
      expect(fs.statSync(file).ino).toBe(inode);
      expect(exists(`${file}${CONFIG_BACKUP_SUFFIX}`)).toBe(false);
    });
  });

  it('skips the backup when backup is false', async () => {
    await withTempDir((dir) => {
      const file = path.join(dir, 'opencode.jsonc');
      writeFile(file, 'old\n');
      expect(writeConfigFile(file, 'new\n', { backup: false })).toEqual({ changed: true });
      expect(fs.readFileSync(file, 'utf8')).toBe('new\n');
      expect(exists(`${file}${CONFIG_BACKUP_SUFFIX}`)).toBe(false);
    });
  });

  it('aborts without writing when the backup cannot be created', async () => {
    await withTempDir((dir) => {
      const file = path.join(dir, 'opencode.jsonc');
      writeFile(file, 'old\n');
      fs.mkdirSync(`${file}${CONFIG_BACKUP_SUFFIX}`);
      expect(throwingOf(() => writeConfigFile(file, 'new\n')).message).toMatch(/back up/);
      expect(fs.readFileSync(file, 'utf8')).toBe('old\n');
      expect(tempResidue(dir)).toEqual([]);
    });
  });

  it.skipIf(process.platform === 'win32')('writes through a symlink and keeps the link intact', async () => {
    await withTempDir((dir) => {
      const root = path.join(dir, 'scope');
      const real = path.join(dir, 'dotfiles', 'opencode.jsonc');
      const link = path.join(root, 'opencode.jsonc');
      writeFile(real, 'old\n', 0o640);
      fs.mkdirSync(root);
      fs.symlinkSync(real, link);

      const result = writeConfigFile(link, 'new\n', { root });

      expect(result).toEqual({ changed: true, backupPath: `${link}${CONFIG_BACKUP_SUFFIX}` });
      expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
      expect(fs.readlinkSync(link)).toBe(real);
      expect(fs.readFileSync(real, 'utf8')).toBe('new\n');
      expect(modeOf(real)).toBe(0o640);
      expect(fs.readFileSync(`${link}${CONFIG_BACKUP_SUFFIX}`, 'utf8')).toBe('old\n');
      expect(exists(`${real}${CONFIG_BACKUP_SUFFIX}`)).toBe(false);
      expect(tempResidue(root)).toEqual([]);
      expect(tempResidue(path.dirname(real))).toEqual([]);
    });
  });

  it('refuses to write outside the resolved scope root', async () => {
    await withTempDir((dir) => {
      const root = path.join(dir, 'scope');
      const outside = path.join(dir, 'outside', 'opencode.jsonc');
      expect(throwingOf(() => writeConfigFile(outside, '{}\n', { root })).message).toMatch(/escapes its install root/);
      expect(exists(outside)).toBe(false);
      expect(exists(root)).toBe(false);
    });
  });

  it.each(['', 'relative/opencode.jsonc'])('rejects the invalid path %j', (value) => {
    expect(throwingOf(() => writeConfigFile(value, '{}\n')).message).toMatch(/must be absolute|must not be blank/);
  });
});

describe('backupConfigFile', () => {
  it('copies content and mode to the adjacent .bak path', async () => {
    await withTempDir((dir) => {
      const file = path.join(dir, 'opencode.jsonc');
      writeFile(file, 'old\n', 0o640);
      expect(backupConfigFile(file)).toBe(`${file}${CONFIG_BACKUP_SUFFIX}`);
      expect(readConfigFile(`${file}${CONFIG_BACKUP_SUFFIX}`)).toEqual({ status: 'found', text: 'old\n', mode: 0o640 });
    });
  });

  it('overwrites an existing backup', async () => {
    await withTempDir((dir) => {
      const file = path.join(dir, 'opencode.jsonc');
      writeFile(file, 'current\n');
      writeFile(`${file}${CONFIG_BACKUP_SUFFIX}`, 'stale\n');
      backupConfigFile(file);
      expect(fs.readFileSync(`${file}${CONFIG_BACKUP_SUFFIX}`, 'utf8')).toBe('current\n');
    });
  });

  it('rejects a missing source', async () => {
    await withTempDir((dir) => {
      expect(throwingOf(() => backupConfigFile(path.join(dir, 'absent.jsonc'))).message).toMatch(/not a regular file/);
    });
  });

  it.skipIf(process.platform === 'win32')('backs up the real target next to the symlink', async () => {
    await withTempDir((dir) => {
      const real = path.join(dir, 'dotfiles', 'opencode.jsonc');
      const link = path.join(dir, 'opencode.jsonc');
      writeFile(real, 'old\n');
      fs.symlinkSync(real, link);
      expect(backupConfigFile(link)).toBe(`${link}${CONFIG_BACKUP_SUFFIX}`);
      expect(fs.readFileSync(`${link}${CONFIG_BACKUP_SUFFIX}`, 'utf8')).toBe('old\n');
      expect(exists(`${real}${CONFIG_BACKUP_SUFFIX}`)).toBe(false);
    });
  });
});

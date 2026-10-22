/**
 * manifest.test.ts — install manifest schema, validation, and atomic I/O (2.1).
 *
 * Locks the `.dev-harness-install.json` contract: canonical fields, typed read
 * states (missing/valid/corrupt/unsupported), target trust, safe relative file
 * lists, deterministic serialization, and atomic overwrites. Temp dirs only;
 * no home, network, or repo state is touched.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OperationalError } from '../errors.js';
import {
  type CreateManifestInput,
  createManifest,
  type InstallManifest,
  MANIFEST_FILE_NAME,
  MANIFEST_SCHEMA_VERSION,
  manifestPathFor,
  readManifest,
  writeManifest,
} from '../manifest.js';

type Raw = Record<string, unknown>;
type VersionCase = { name: string; version: unknown; status: 'corrupt' | 'unsupported'; pattern: RegExp };

function configPath(dir: string): string {
  return path.join(dir, '..', 'opencode.jsonc');
}

function withTempDir(run: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dh-manifest-'));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function manifestInput(dir: string, overrides: Partial<CreateManifestInput> = {}): CreateManifestInput {
  return {
    package: 'dev-harness-skills',
    version: '0.4.0',
    source: 'dev-harness-skills',
    scope: 'global',
    target: dir,
    config: { path: configPath(dir), fingerprint: { type: 'local' } },
    files: ['index.ts', 'package.json', 'dist/plugin.js', 'dist/assets/agents/dh-reviewer.md'],
    installedAt: '2026-10-22T10:00:00.000Z',
    ...overrides,
  };
}

function createValid(dir: string, overrides: Partial<CreateManifestInput> = {}): InstallManifest {
  return createManifest(manifestInput(dir, overrides));
}

function writeRaw(dir: string, contents: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(manifestPathFor(dir), contents, 'utf8');
}

function thrown(run: () => unknown): OperationalError {
  try {
    run();
  } catch (err) {
    expect(err).toBeInstanceOf(OperationalError);
    return err as OperationalError;
  }
  throw new Error('expected the function to throw');
}

function corruptReason(dir: string): string {
  const result = readManifest(dir);
  if (result.status !== 'corrupt') throw new Error(`expected corrupt, got ${result.status}`);
  return result.reason;
}

function validManifest(dir: string): InstallManifest {
  const result = readManifest(dir);
  if (result.status !== 'valid') throw new Error(`expected a valid manifest, got ${result.status}`);
  return result.manifest;
}

describe('createManifest', () => {
  it('builds a schema version 1 manifest with the canonical fields', () => {
    withTempDir((dir) => {
      expect(createValid(dir)).toEqual({
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        package: 'dev-harness-skills',
        version: '0.4.0',
        source: 'dev-harness-skills',
        scope: 'global',
        installedAt: '2026-10-22T10:00:00.000Z',
        target: dir,
        config: { path: configPath(dir), key: 'mcp.servers.dh', fingerprint: { type: 'local' } },
        files: ['index.ts', 'package.json', 'dist/plugin.js', 'dist/assets/agents/dh-reviewer.md'],
      });
      const { installedAt, config } = createValid(dir, { installedAt: undefined, config: { path: configPath(dir) } });
      expect(new Date(installedAt).toISOString()).toBe(installedAt);
      expect(Object.keys(config)).toEqual(['path', 'key']);
    });
  });

  const INVALID_INPUTS: ReadonlyArray<{ name: string; overrides: Partial<CreateManifestInput>; pattern: RegExp }> = [
    { name: 'a blank package', overrides: { package: '  ' }, pattern: /package/ },
    { name: 'a blank version', overrides: { version: '' }, pattern: /version/ },
    { name: 'a blank source', overrides: { source: '' }, pattern: /source/ },
    { name: 'an unknown scope', overrides: { scope: 'user' as never }, pattern: /scope/ },
    { name: 'a relative target', overrides: { target: 'plugins/dev-harness-skills' }, pattern: /target/ },
    { name: 'an unparseable installedAt', overrides: { installedAt: 'someday' }, pattern: /installedAt/ },
    { name: 'a relative config path', overrides: { config: { path: 'opencode.jsonc' } }, pattern: /config\.path/ },
    { name: 'an empty files entry', overrides: { files: [''] }, pattern: /files\[0\]/ },
    { name: 'an escaping files entry', overrides: { files: ['dist/../../escape'] }, pattern: /files\[0\]/ },
    { name: 'an absolute files entry', overrides: { files: ['/etc/passwd'] }, pattern: /files\[0\]/ },
  ];

  it.each(INVALID_INPUTS)('rejects $name', ({ overrides, pattern }) => {
    withTempDir((dir) => {
      const error = thrown(() => createManifest(manifestInput(dir, overrides)));
      expect(error.message).toMatch(/cannot create the install manifest/);
      expect(error.message).toMatch(pattern);
    });
  });
});

describe('writeManifest + readManifest round trip', () => {
  it('writes the manifest inside the target directory and reads it back', () => {
    withTempDir((dir) => {
      const manifest = createValid(dir);
      writeManifest(dir, manifest);
      expect(MANIFEST_FILE_NAME).toBe('.dev-harness-install.json');
      expect(manifestPathFor(dir)).toBe(path.join(dir, MANIFEST_FILE_NAME));
      expect(fs.readdirSync(dir)).toEqual([MANIFEST_FILE_NAME]);
      expect(readManifest(dir)).toEqual({ status: 'valid', manifest });
    });
  });
  it('serializes deterministic 2-space JSON with a trailing newline', () => {
    withTempDir((dir) => {
      writeManifest(dir, createValid(dir));
      const raw = fs.readFileSync(manifestPathFor(dir), 'utf8');
      expect(raw.endsWith('\n')).toBe(true);
      expect(raw).toContain('\n  "schemaVersion": 1,');
      writeManifest(dir, createValid(dir));
      expect(fs.readFileSync(manifestPathFor(dir), 'utf8')).toBe(raw);
    });
  });
  it('round-trips fingerprints, keeps null, and omits an absent one', () => {
    withTempDir((dir) => {
      const fingerprint = { type: 'local', command: ['npx', '-y'] };
      writeManifest(dir, createValid(dir, { config: { path: configPath(dir), fingerprint } }));
      expect(validManifest(dir)).toEqual(createValid(dir, { config: { path: configPath(dir), fingerprint } }));
      writeManifest(dir, createValid(dir, { config: { path: configPath(dir), fingerprint: null } }));
      expect(validManifest(dir).config.fingerprint).toBeNull();

      writeManifest(dir, createValid(dir, { config: { path: configPath(dir) } }));
      expect(fs.readFileSync(manifestPathFor(dir), 'utf8')).not.toContain('fingerprint');
    });
  });
  it('overwrites atomically with no temp residue', () => {
    withTempDir((dir) => {
      writeManifest(dir, createValid(dir, { version: '0.4.0' }));
      writeManifest(dir, createValid(dir, { version: '0.5.0' }));
      expect(validManifest(dir).version).toBe('0.5.0');
      expect(fs.readdirSync(dir)).toEqual([MANIFEST_FILE_NAME]);
    });
  });
});

describe('readManifest states', () => {
  it('reports missing for an absent manifest and corrupt for an unreadable one', () => {
    withTempDir((dir) => {
      expect(readManifest(dir)).toMatchObject({ status: 'missing' });
      expect(readManifest(path.join(dir, 'never-created'))).toMatchObject({ status: 'missing' });
      fs.mkdirSync(manifestPathFor(dir), { recursive: true });
      expect(corruptReason(dir)).toMatch(/cannot read/);
    });
  });
  const CORRUPT_PAYLOADS: ReadonlyArray<{ raw: string; pattern: RegExp }> = [
    { raw: '{ "schemaVersion": 1, oops', pattern: /not valid JSON/ },
    { raw: 'null', pattern: /JSON object/ },
    { raw: '[1, 2]', pattern: /JSON object/ },
  ];

  it.each(CORRUPT_PAYLOADS)('reports corrupt for $raw without echoing it', ({ raw, pattern }) => {
    withTempDir((dir) => {
      writeRaw(dir, raw);
      const reason = corruptReason(dir);
      expect(reason).toMatch(pattern);
      expect(reason).not.toContain('oops');
    });
  });
  const CFG: Raw = { path: '/v/opencode.jsonc', key: 'mcp.servers.dh' };
  const BASE: Raw = {
    schemaVersion: 1,
    package: 'dev-harness-skills',
    version: '0.4.0',
    source: 'dev-harness-skills',
    scope: 'global',
    installedAt: '2026-10-22T10:00:00.000Z',
    target: '/v/plugin',
    config: CFG,
    files: ['index.ts'],
  };

  const INVALID_SHAPES: ReadonlyArray<{ name: string; raw: Raw; pattern: RegExp }> = [
    { name: 'a missing package', raw: { ...BASE, package: undefined }, pattern: /package/ },
    { name: 'a numeric version', raw: { ...BASE, version: 4 }, pattern: /version/ },
    { name: 'an unknown scope', raw: { ...BASE, scope: 'user' }, pattern: /scope/ },
    { name: 'an unparseable installedAt', raw: { ...BASE, installedAt: 'someday' }, pattern: /installedAt/ },
    { name: 'a relative target', raw: { ...BASE, target: 'plugins/x' }, pattern: /absolute/ },
    { name: 'a missing config', raw: { ...BASE, config: undefined }, pattern: /config/ },
    { name: 'a wrong config key', raw: { ...BASE, config: { ...CFG, key: 'other' } }, pattern: /config\.key/ },
    { name: 'a relative config path', raw: { ...BASE, config: { ...CFG, path: 'x.jsonc' } }, pattern: /config\.path/ },
    { name: 'a non-array files field', raw: { ...BASE, files: 'index.ts' }, pattern: /files/ },
    { name: 'a non-string files entry', raw: { ...BASE, files: [42] }, pattern: /files\[0\]/ },
    { name: 'an escaping files entry', raw: { ...BASE, files: ['index.ts', '../escape'] }, pattern: /files\[1\]/ },
    { name: 'a windows-style files entry', raw: { ...BASE, files: ['dist\\plugin.js'] }, pattern: /files\[0\]/ },
  ];

  it.each(INVALID_SHAPES)('reports corrupt for $name', ({ raw, pattern }) => {
    withTempDir((dir) => {
      writeRaw(dir, JSON.stringify(raw, null, 2));
      expect(corruptReason(dir)).toMatch(pattern);
    });
  });
  const SCHEMA_VERSIONS: ReadonlyArray<VersionCase> = [
    { name: 'a future schema version', version: 2, status: 'unsupported', pattern: /version 2 is not supported/ },
    { name: 'schema version zero', version: 0, status: 'unsupported', pattern: /not supported/ },
    { name: 'a negative schema version', version: -1, status: 'unsupported', pattern: /not supported/ },
    { name: 'a fractional schema version', version: 1.5, status: 'unsupported', pattern: /not supported/ },
    { name: 'a string schemaVersion', version: '1', status: 'corrupt', pattern: /numeric schemaVersion/ },
    { name: 'a null schemaVersion', version: null, status: 'corrupt', pattern: /numeric schemaVersion/ },
    { name: 'a missing schemaVersion', version: undefined, status: 'corrupt', pattern: /numeric schemaVersion/ },
  ];

  it.each(SCHEMA_VERSIONS)('reports $status for $name', ({ version, status, pattern }) => {
    withTempDir((dir) => {
      writeRaw(dir, JSON.stringify({ ...BASE, schemaVersion: version }, null, 2));
      const result = readManifest(dir);
      expect(result.status).toBe(status);
      if (result.status === 'valid') throw new Error('expected a failure state');
      expect(result.reason).toMatch(pattern);
    });
  });
  it('ignores unknown fields in a same-version manifest', () => {
    withTempDir((dir) => {
      const raw = JSON.parse(JSON.stringify(createValid(dir))) as Raw;
      raw.futureField = { anything: true };
      writeRaw(dir, JSON.stringify(raw, null, 2));
      expect('futureField' in validManifest(dir)).toBe(false);
    });
  });
  it('reports corrupt when the manifest target does not match its directory', () => {
    withTempDir((dir) => {
      const other = path.join(dir, 'other');
      fs.mkdirSync(other, { recursive: true });
      const contents = JSON.stringify(JSON.parse(JSON.stringify(createValid(dir))) as Raw, null, 2);
      writeRaw(other, contents);
      const reason = corruptReason(other);
      expect(reason).toMatch(/does not match/);
      expect(reason).toContain(dir);
      expect(fs.readFileSync(manifestPathFor(other), 'utf8')).toBe(contents);
    });
  });
});

describe('target validation', () => {
  it.each([
    { name: 'a blank target directory', target: '   ', pattern: /must not be empty/ },
    { name: 'a relative target directory', target: 'plugins/dev-harness-skills', pattern: /absolute/ },
  ])('rejects $name', ({ target, pattern }) => {
    withTempDir((dir) => {
      expect(thrown(() => writeManifest(target, createValid(dir))).message).toMatch(pattern);
    });
  });
  it('refuses mismatched targets, missing directories, and unsafe file entries', () => {
    withTempDir((dir) => {
      const other = path.join(dir, 'other');
      fs.mkdirSync(other, { recursive: true });
      expect(thrown(() => writeManifest(other, createValid(dir))).message).toMatch(/does not match/);
      expect(fs.existsSync(manifestPathFor(other))).toBe(false);

      const missing = path.join(dir, 'missing');
      expect(thrown(() => writeManifest(missing, createValid(missing))).message).toMatch(/existing directory/);
      expect(fs.existsSync(missing)).toBe(false);

      const tampered: InstallManifest = { ...createValid(dir), files: ['index.ts', '../escape'] };
      expect(thrown(() => writeManifest(dir, tampered)).message).toMatch(/files\[1\]/);
      expect(fs.existsSync(manifestPathFor(dir))).toBe(false);
    });
  });

  it('rejects a blank or relative target directory on read', () => {
    expect(() => readManifest('')).toThrow(OperationalError);
    expect(() => readManifest('plugins/dev-harness-skills')).toThrow(/absolute/);
  });
});

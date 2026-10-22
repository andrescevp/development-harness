/**
 * install-command.test.ts — install orchestration (sub-task 4.1).
 *
 * Every case runs against a temp HOME/XDG/OPENCODE config, project dir, and
 * fixture package root; nothing touches the real home or the network. Covers
 * both scopes, idempotency, dry-run, --no-mcp, conflicts/force, invalid JSONC,
 * JSON output, prompt routing, and partial-failure semantics.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { rejectionOf } from '../../__tests__/helpers/errors.js';
import type { CommandOptions } from '../args.js';
import { type InstallDeps, runInstall } from '../commands/install.js';
import { OperationalError, UsageError } from '../errors.js';
import { MANIFEST_FILE_NAME } from '../manifest.js';
import { buildMcpEntry, mcpEntryFingerprint } from '../mcp-entry.js';
import { PromptCancelledError } from '../prompt.js';
import {
  type ConfigLike,
  FIXTURE_VERSION,
  globalConfig,
  globalTarget,
  type InstallHarness,
  type ManifestLike,
  projectConfig,
  projectTarget,
  readJson,
  readJsonc,
  withInstallHarness,
  writeFile,
} from './helpers/install-harness.js';

function run(harness: InstallHarness, options: Partial<CommandOptions> = {}, deps: Partial<InstallDeps> = {}) {
  return runInstall(harness.options(options), harness.deps(deps));
}

const manifestAt = (target: string): ManifestLike =>
  readJson(path.join(target, MANIFEST_FILE_NAME)) as unknown as ManifestLike;
const configAt = (file: string): ConfigLike => readJson(file) as ConfigLike;

describe('runInstall', () => {
  it('installs globally with a manifest and the default npm MCP entry', async () => {
    await withInstallHarness(async (harness) => {
      await run(harness, { scope: 'global' });
      const target = globalTarget(harness);
      const manifest = manifestAt(target);

      expect(manifest).toMatchObject({
        package: 'dev-harness-skills',
        version: FIXTURE_VERSION,
        source: 'dev-harness-skills',
        scope: 'global',
        target,
      });
      expect(manifest.files).toEqual(expect.arrayContaining(['index.ts', 'package.json', 'dist/plugin.js']));
      expect(fs.readdirSync(path.join(target, 'dist', 'assets', 'agents'))).toHaveLength(7);
      expect(fs.readdirSync(path.join(target, 'dist', 'assets', 'skills'))).toHaveLength(17);
      expect(manifest.config).toEqual({
        path: globalConfig(harness),
        key: 'mcp.servers.dh',
        fingerprint: mcpEntryFingerprint(buildMcpEntry()),
      });
      expect(configAt(globalConfig(harness)).mcp?.servers?.dh).toEqual(buildMcpEntry());
      expect(harness.stdout.text).toContain('install:');
      expect(harness.stderr.text).toBe('');
    });
  });

  it('installs into a project, reusing an existing opencode.json and the GitHub MCP source', async () => {
    await withInstallHarness(async (harness) => {
      const config = path.join(harness.projectDir, 'opencode.json');
      writeFile(config, '{\n  "theme": "dark"\n}\n');

      await run(harness, { scope: 'project', path: harness.projectDir, mcpSource: 'github' });
      const target = projectTarget(harness);
      const manifest = manifestAt(target);

      expect(manifest).toMatchObject({ scope: 'project', source: 'github:andrescevp/development-harness', target });
      expect(configAt(config)).toMatchObject({ theme: 'dark' });
      expect(configAt(config).mcp?.servers?.dh).toEqual(buildMcpEntry({ source: 'github' }));
      expect(fs.existsSync(projectConfig(harness))).toBe(false);
    });
  });

  it('is a no-op on the second run, leaving the installation and config untouched', async () => {
    await withInstallHarness(async (harness) => {
      await run(harness, { scope: 'global' });
      const manifestFile = path.join(globalTarget(harness), MANIFEST_FILE_NAME);
      const before = fs.readFileSync(manifestFile, 'utf8');
      const configBefore = fs.readFileSync(globalConfig(harness), 'utf8');
      harness.stdout.text = '';

      await run(harness, { scope: 'global' });

      expect(fs.readFileSync(manifestFile, 'utf8')).toBe(before);
      expect(fs.readFileSync(globalConfig(harness), 'utf8')).toBe(configBefore);
      expect(harness.stdout.text).toContain('already up to date');
      expect(fs.readdirSync(path.dirname(globalTarget(harness))).filter((name) => name.includes('.tmp-'))).toEqual([]);
    });
  });

  it('skips config reads and writes with --no-mcp', async () => {
    await withInstallHarness(async (harness) => {
      await run(harness, { scope: 'global', noMcp: true });
      expect(fs.existsSync(globalConfig(harness))).toBe(false);
      expect(manifestAt(globalTarget(harness)).config).toEqual({
        path: globalConfig(harness),
        key: 'mcp.servers.dh',
      });

      const existing = '// keep\n{\n  "theme": "dark"\n}\n';
      writeFile(projectConfig(harness), existing);
      await run(harness, { scope: 'project', path: harness.projectDir, noMcp: true });
      expect(fs.readFileSync(projectConfig(harness), 'utf8')).toBe(existing);
    });
  });

  it('writes nothing in --dry-run mode', async () => {
    await withInstallHarness(async (harness) => {
      await run(harness, { scope: 'global', dryRun: true });

      expect(fs.existsSync(globalTarget(harness))).toBe(false);
      expect(fs.existsSync(globalConfig(harness))).toBe(false);
      expect(harness.stdout.text).toContain('dry run: no changes written');
      expect(harness.stdout.text).toContain('install');
    });
  });

  it('refuses an unmanaged target unless --force is supplied', async () => {
    await withInstallHarness(async (harness) => {
      const target = globalTarget(harness);
      writeFile(path.join(target, 'stray.txt'), 'user file\n');

      const error = await rejectionOf(run(harness, { scope: 'global' }));
      expect(error.message).toMatch(/refusing to install/);
      expect(fs.existsSync(path.join(target, 'stray.txt'))).toBe(true);
      expect(fs.existsSync(globalConfig(harness))).toBe(false);

      await run(harness, { scope: 'global', force: true });
      expect(fs.existsSync(path.join(target, 'stray.txt'))).toBe(false);
      expect(manifestAt(target).version).toBe(FIXTURE_VERSION);
    });
  });

  it('preserves a differing dh entry with a warning and overwrites it with --force', async () => {
    await withInstallHarness(async (harness) => {
      const custom = {
        type: 'local',
        command: ['custom-server'],
        protocol: '2026-07-28',
        timeout: { startup: 1 },
      };
      const original = `// keep this comment\n{\n  "mcp": { "servers": { "dh": ${JSON.stringify(custom)} } }\n}\n`;
      writeFile(projectConfig(harness), original);

      await run(harness, { scope: 'project', path: harness.projectDir });
      expect(fs.readFileSync(projectConfig(harness), 'utf8')).toBe(original);
      expect(harness.stderr.text).toMatch(/warning: .*different value/);
      expect(fs.existsSync(projectTarget(harness))).toBe(true);

      await run(harness, { scope: 'project', path: harness.projectDir, force: true });
      const text = fs.readFileSync(projectConfig(harness), 'utf8');
      expect(text.startsWith('// keep this comment')).toBe(true);
      expect((readJsonc(projectConfig(harness)) as ConfigLike).mcp?.servers?.dh).toEqual(buildMcpEntry());
    });
  });

  it('aborts on invalid JSONC before writing the plugin', async () => {
    await withInstallHarness(async (harness) => {
      const broken = '{\n  "mcp": {\n';
      writeFile(globalConfig(harness), broken);

      const error = await rejectionOf(run(harness, { scope: 'global' }));
      expect(error).toBeInstanceOf(OperationalError);
      expect(error.message).toMatch(/cannot update the dh MCP entry/);
      expect(fs.existsSync(globalTarget(harness))).toBe(false);
      expect(fs.readFileSync(globalConfig(harness), 'utf8')).toBe(broken);
    });
  });

  it('emits one JSON envelope with stable fields', async () => {
    await withInstallHarness(async (harness) => {
      await run(harness, { scope: 'project', path: harness.projectDir, json: true });
      const lines = harness.stdout.text.trimEnd().split('\n');
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0] ?? '')).toEqual({
        ok: true,
        command: 'install',
        scope: 'project',
        target: projectTarget(harness),
        config: projectConfig(harness),
        action: 'install',
        changed: true,
        version: FIXTURE_VERSION,
        mcp: { action: 'inserted', changed: true },
        dryRun: false,
      });
      expect(harness.stderr.text).toBe('');

      harness.stdout.text = '';
      await run(harness, { scope: 'project', path: harness.projectDir, json: true });
      expect(JSON.parse(harness.stdout.text)).toMatchObject({
        action: 'noop',
        changed: false,
        mcp: { action: 'noop', changed: false },
      });
    });
  });

  it('reports intended actions in a dry-run JSON envelope', async () => {
    await withInstallHarness(async (harness) => {
      await run(harness, { scope: 'global', json: true, dryRun: true });
      expect(JSON.parse(harness.stdout.text)).toMatchObject({
        ok: true,
        command: 'install',
        scope: 'global',
        action: 'install',
        changed: true,
        mcp: { action: 'inserted', changed: true },
        dryRun: true,
      });
      expect(fs.existsSync(globalTarget(harness))).toBe(false);
    });
  });

  it('fails with a usage error when no scope is selected in a non-TTY', async () => {
    await withInstallHarness(async (harness) => {
      await expect(run(harness)).rejects.toMatchObject({ name: 'UsageError', exitCode: 2 });
      await expect(run(harness)).rejects.toThrow(/--global or --project/);
      expect(fs.existsSync(globalTarget(harness))).toBe(false);
    });
  });

  it('never prompts in JSON mode and surfaces a cancelled prompt as operational', async () => {
    await withInstallHarness(async (harness) => {
      const jsonReader = vi.fn(async () => ({ question: async () => 'G', close: () => {} }));
      await expect(
        run(harness, { json: true }, { inputIsTTY: true, outputIsTTY: true, createReader: jsonReader })
      ).rejects.toBeInstanceOf(UsageError);
      expect(jsonReader).not.toHaveBeenCalled();

      const cancelReader = vi.fn(async () => ({ question: async () => 'C', close: () => {} }));
      await expect(
        run(harness, {}, { inputIsTTY: true, outputIsTTY: true, createReader: cancelReader })
      ).rejects.toBeInstanceOf(PromptCancelledError);
      expect(cancelReader).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the plugin installed when the config write fails after the swap', async () => {
    await withInstallHarness(async (harness) => {
      const blocked = path.join(harness.projectDir, 'blocked');
      fs.writeFileSync(blocked, 'not a directory\n');
      fs.symlinkSync(path.join(blocked, 'opencode.jsonc'), projectConfig(harness));

      const error = await rejectionOf(run(harness, { scope: 'project', path: harness.projectDir }));
      expect(fs.existsSync(projectTarget(harness))).toBe(true);
      expect(error.message).toMatch(/plugin is installed at/);
      expect(error.message).toMatch(/re-run/);
    });
  });
});

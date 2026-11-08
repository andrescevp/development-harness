/**
 * mcp-only-install.test.ts — config-only install path (sub-task 4.4).
 *
 * `install --mcp-only` must wire `mcp.servers.dh` for users who load the plugin
 * through `opencode plugin add`: no target directory, no manifest, no
 * classification, and no config write in `--dry-run`. Every case runs against
 * the isolated harness (temp HOME/XDG/OPENCODE/project/fixture package).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { rejectionOf } from '../../__tests__/helpers/errors.js';
import type { CommandOptions } from '../args.js';
import { runInstall } from '../commands/install.js';
import { MANIFEST_FILE_NAME } from '../manifest.js';
import { buildMcpEntry } from '../mcp-entry.js';
import {
  type ConfigLike,
  globalConfig,
  globalTarget,
  type InstallHarness,
  projectConfig,
  projectTarget,
  readJsonc,
  withInstallHarness,
  writeFile,
} from './helpers/install-harness.js';

const run = (h: InstallHarness, options: Partial<CommandOptions> = {}) => runInstall(h.options(options), h.deps());
const dhAt = (config: string): unknown => (readJsonc(config) as ConfigLike).mcp?.servers?.dh;

describe('runInstall --mcp-only', () => {
  it('writes only the global config entry and never creates a plugin target or manifest', async () => {
    await withInstallHarness(async (h) => {
      await run(h, { scope: 'global', mcpOnly: true, json: true });

      expect(h.stdout.text.trimEnd().split('\n')).toHaveLength(1);
      expect(JSON.parse(h.stdout.text)).toEqual({
        ok: true,
        command: 'install',
        scope: 'global',
        target: globalTarget(h),
        config: globalConfig(h),
        action: 'mcp-only',
        changed: true,
        mcp: { action: 'inserted', changed: true },
        dryRun: false,
      });
      expect(h.stderr.text).toBe('');
      expect(fs.existsSync(globalTarget(h))).toBe(false);
      expect(fs.existsSync(path.join(h.globalDir, 'plugins'))).toBe(false);
      expect(fs.existsSync(path.join(globalTarget(h), MANIFEST_FILE_NAME))).toBe(false);
      expect(dhAt(globalConfig(h))).toEqual(buildMcpEntry());
    });
  });

  it('reuses an existing project opencode.json, preserving comments and unrelated keys', async () => {
    await withInstallHarness(async (h) => {
      const config = path.join(h.projectDir, 'opencode.json');
      writeFile(config, '// keep this comment\n{\n  "theme": "dark"\n}\n');

      await run(h, { scope: 'project', path: h.projectDir, mcpOnly: true });

      const text = fs.readFileSync(config, 'utf8');
      expect(text.startsWith('// keep this comment')).toBe(true);
      expect(readJsonc(config)).toMatchObject({ theme: 'dark' });
      expect(dhAt(config)).toEqual(buildMcpEntry());
      expect(fs.existsSync(projectConfig(h))).toBe(false);
      expect(fs.existsSync(path.join(h.projectDir, '.opencode'))).toBe(false);
      expect(fs.existsSync(projectTarget(h))).toBe(false);
      expect(h.stdout.text).toContain('install: scope: project');
      expect(h.stdout.text).toContain('mcp-only');
    });
  });

  it.each([
    { options: { mcpSource: 'github' as const }, expected: buildMcpEntry({ source: 'github' }) },
    {
      options: { mcpPackage: 'github:andrescevp/development-harness#v1.0.0' },
      expected: buildMcpEntry({ packageSpec: 'github:andrescevp/development-harness#v1.0.0' }),
    },
  ])('honors the selected MCP channel: $options', async ({ options, expected }) => {
    await withInstallHarness(async (h) => {
      await run(h, { scope: 'global', mcpOnly: true, ...options });
      expect(dhAt(globalConfig(h))).toEqual(expected);
    });
  });

  it('preserves a differing dh entry with a warning and replaces it with --force', async () => {
    await withInstallHarness(async (h) => {
      const custom = { type: 'local', command: ['custom-server'], protocol: '2026-07-28', timeout: { startup: 1 } };
      const original = `{\n  "mcp": { "servers": { "dh": ${JSON.stringify(custom)} } }\n}\n`;
      writeFile(globalConfig(h), original);

      await run(h, { scope: 'global', mcpOnly: true });
      expect(fs.readFileSync(globalConfig(h), 'utf8')).toBe(original);
      expect(h.stderr.text).toMatch(/warning: .*different value/);
      expect(h.stdout.text).toContain('left unchanged');

      await run(h, { scope: 'global', mcpOnly: true, force: true });
      expect(dhAt(globalConfig(h))).toEqual(buildMcpEntry());
    });
  });

  it('is a no-op on a second run and reports a stable envelope', async () => {
    await withInstallHarness(async (h) => {
      await run(h, { scope: 'global', mcpOnly: true });
      const before = fs.readFileSync(globalConfig(h), 'utf8');
      h.stdout.text = '';
      h.stderr.text = '';

      await run(h, { scope: 'global', mcpOnly: true, json: true });

      expect(fs.readFileSync(globalConfig(h), 'utf8')).toBe(before);
      expect(JSON.parse(h.stdout.text)).toMatchObject({
        action: 'mcp-only',
        changed: false,
        mcp: { action: 'noop', changed: false },
        dryRun: false,
      });
      expect(h.stderr.text).toBe('');
    });
  });

  it('writes nothing in --dry-run mode', async () => {
    await withInstallHarness(async (h) => {
      await run(h, { scope: 'global', mcpOnly: true, dryRun: true });

      expect(fs.existsSync(globalConfig(h))).toBe(false);
      expect(fs.existsSync(globalTarget(h))).toBe(false);
      expect(h.stdout.text).toContain('would insert mcp.servers.dh');
      expect(h.stdout.text).toContain('dry run: no changes written');

      h.stdout.text = '';
      await run(h, { scope: 'project', path: h.projectDir, mcpOnly: true, dryRun: true, json: true });
      expect(JSON.parse(h.stdout.text)).toEqual({
        ok: true,
        command: 'install',
        scope: 'project',
        target: projectTarget(h),
        config: projectConfig(h),
        action: 'mcp-only',
        changed: true,
        mcp: { action: 'inserted', changed: true },
        dryRun: true,
      });
      expect(fs.existsSync(projectConfig(h))).toBe(false);
    });
  });

  it('aborts on invalid JSONC before writing anything', async () => {
    await withInstallHarness(async (h) => {
      const broken = '{\n  "mcp": {\n';
      writeFile(globalConfig(h), broken);

      const error = await rejectionOf(run(h, { scope: 'global', mcpOnly: true }));
      expect(error.message).toMatch(/cannot update the dh MCP entry/);
      expect(fs.readFileSync(globalConfig(h), 'utf8')).toBe(broken);
      expect(fs.existsSync(globalTarget(h))).toBe(false);
      expect(fs.existsSync(`${globalConfig(h)}.bak`)).toBe(false);
    });
  });

  it('creates missing config parents inside the scope root without a plugin directory', async () => {
    await withInstallHarness(async (h) => {
      await run(h, { scope: 'global', mcpOnly: true });
      expect(fs.existsSync(h.globalDir)).toBe(true);
      expect(fs.readdirSync(h.globalDir)).toEqual(['opencode.jsonc']);
    });
  });

  it('ignores an unmanaged target instead of classifying or replacing it', async () => {
    await withInstallHarness(async (h) => {
      writeFile(path.join(globalTarget(h), 'stray.txt'), 'user file\n');

      await run(h, { scope: 'global', mcpOnly: true });

      expect(fs.readFileSync(path.join(globalTarget(h), 'stray.txt'), 'utf8')).toBe('user file\n');
      expect(dhAt(globalConfig(h))).toEqual(buildMcpEntry());
    });
  });
});

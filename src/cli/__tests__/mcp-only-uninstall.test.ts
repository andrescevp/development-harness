/**
 * mcp-only-uninstall.test.ts — config-only uninstall path (sub-task 4.4).
 *
 * `uninstall --mcp-only` removes only the expected `dh` entry (npm default,
 * overridable), prunes containers it emptied, and never classifies, touches, or
 * deletes the plugin directory or manifest. Missing configs are a no-op and
 * invalid JSONC aborts before any write.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { rejectionOf } from '../../__tests__/helpers/errors.js';
import { MANIFEST_FILE_NAME } from '../manifest.js';
import {
  globalUninstallEnvelope,
  install,
  mcpOnlyRemoval,
  uninstall,
  uninstallJson,
} from './helpers/command-harness.js';
import {
  type ConfigLike,
  globalConfig,
  globalTarget,
  projectConfig,
  projectTarget,
  readJsonc,
  withInstallHarness,
  writeFile,
} from './helpers/install-harness.js';

const dhAt = (config: string): unknown => (readJsonc(config) as ConfigLike).mcp?.servers?.dh;

describe('runUninstall --mcp-only', () => {
  it('removes only the dh entry, prunes empty containers, and reports a stable envelope', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global', mcpOnly: true });
      const body = await uninstallJson(h, { scope: 'global', mcpOnly: true });

      expect(h.stdout.text.trimEnd().split('\n')).toHaveLength(1);
      expect(body).toEqual(globalUninstallEnvelope(h, 'mcp-only', 'removed', true, false));
      expect(h.stderr.text).toBe('');
      expect(readJsonc(globalConfig(h))).toEqual({});
      expect(fs.existsSync(globalTarget(h))).toBe(false);
    });
  });

  it('leaves a managed plugin directory and manifest untouched', async () => {
    await withInstallHarness(async (h) => {
      writeFile(globalConfig(h), '{\n  "theme": "dark"\n}\n');
      await install(h, { scope: 'global' });
      const manifestFile = path.join(globalTarget(h), MANIFEST_FILE_NAME);
      const manifestBefore = fs.readFileSync(manifestFile, 'utf8');

      await mcpOnlyRemoval(h, { scope: 'global' });

      expect(fs.existsSync(globalTarget(h))).toBe(true);
      expect(fs.readFileSync(manifestFile, 'utf8')).toBe(manifestBefore);
      expect(dhAt(globalConfig(h))).toBeUndefined();
      expect(readJsonc(globalConfig(h))).toMatchObject({ theme: 'dark' });
    });
  });

  it('preserves sibling MCP servers and only prunes the emptied dh containers', async () => {
    await withInstallHarness(async (h) => {
      const other = { type: 'local', command: ['other'] };
      writeFile(projectConfig(h), `${JSON.stringify({ theme: 'dark', mcp: { servers: { other } } }, null, 2)}\n`);
      await install(h, { scope: 'project', path: h.projectDir, mcpOnly: true });
      await uninstallJson(h, { scope: 'project', path: h.projectDir, mcpOnly: true });

      const parsed = readJsonc(projectConfig(h)) as ConfigLike;
      const servers = (parsed.mcp?.servers ?? {}) as Record<string, unknown>;
      expect(parsed.theme).toBe('dark');
      expect(parsed.mcp?.servers?.dh).toBeUndefined();
      expect(servers.other).toEqual(other);
      expect(fs.existsSync(projectTarget(h))).toBe(false);
    });
  });

  it('keeps a GitHub-wired entry unless the matching channel is selected', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global', mcpOnly: true, mcpSource: 'github' });
      const before = fs.readFileSync(globalConfig(h), 'utf8');

      const mismatch = await uninstallJson(h, { scope: 'global', mcpOnly: true });
      expect(mismatch.mcp).toMatchObject({ action: 'mismatch', changed: false });
      expect(fs.readFileSync(globalConfig(h), 'utf8')).toBe(before);
      expect(h.stderr.text).toMatch(/does not match the managed entry/);

      const removed = await uninstallJson(h, { scope: 'global', mcpOnly: true, mcpSource: 'github' });
      expect(removed.mcp).toEqual({ action: 'removed', changed: true });
      expect(readJsonc(globalConfig(h))).toEqual({});
    });
  });

  it('removes a differing dh entry only with --force', async () => {
    await withInstallHarness(async (h) => {
      const custom = { type: 'local', command: ['custom'], protocol: '2026-07-28', timeout: { startup: 1 } };
      writeFile(globalConfig(h), `${JSON.stringify({ mcp: { servers: { dh: custom } } }, null, 2)}\n`);

      await uninstallJson(h, { scope: 'global', mcpOnly: true });
      expect(dhAt(globalConfig(h))).toEqual(custom);

      const forced = await uninstallJson(h, { scope: 'global', mcpOnly: true, force: true });
      expect(forced.mcp).toEqual({ action: 'removed', changed: true });
      expect(readJsonc(globalConfig(h))).toEqual({});
    });
  });

  it('treats a missing config as a no-op without creating one', async () => {
    await withInstallHarness(async (h) => {
      const body = await uninstallJson(h, { scope: 'global', mcpOnly: true });

      expect(body).toMatchObject({
        action: 'mcp-only',
        changed: false,
        mcp: { action: 'missing', changed: false },
        dryRun: false,
      });
      expect(fs.existsSync(globalConfig(h))).toBe(false);
      expect(fs.existsSync(h.globalDir)).toBe(false);

      h.stdout.text = '';
      await uninstall(h, { scope: 'global', mcpOnly: true });
      expect(h.stdout.text).toContain('no dh entry');
    });
  });

  it('aborts on invalid JSONC without touching the file', async () => {
    await withInstallHarness(async (h) => {
      const broken = '{\n  "mcp": {\n';
      writeFile(globalConfig(h), broken);

      const error = await rejectionOf(uninstall(h, { scope: 'global', mcpOnly: true }));
      expect(error.message).toMatch(/cannot remove the dh MCP entry/);
      expect(fs.readFileSync(globalConfig(h), 'utf8')).toBe(broken);
      expect(fs.existsSync(`${globalConfig(h)}.bak`)).toBe(false);
    });
  });

  it('plans only in --dry-run, leaving the config and backup untouched', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global', mcpOnly: true });
      const before = fs.readFileSync(globalConfig(h), 'utf8');

      const body = await uninstallJson(h, { scope: 'global', mcpOnly: true, dryRun: true });
      expect(body).toMatchObject({
        action: 'mcp-only',
        changed: true,
        mcp: { action: 'removed', changed: true },
        dryRun: true,
      });
      expect(fs.readFileSync(globalConfig(h), 'utf8')).toBe(before);
      expect(fs.existsSync(`${globalConfig(h)}.bak`)).toBe(false);
    });
  });

  it('writes a backup when it changes an existing config', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global', mcpOnly: true });
      const before = fs.readFileSync(globalConfig(h), 'utf8');
      await uninstall(h, { scope: 'global', mcpOnly: true });
      expect(fs.readFileSync(`${globalConfig(h)}.bak`, 'utf8')).toBe(before);
    });
  });

  it('ignores an unmanaged plugin directory instead of refusing', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global', mcpOnly: true });
      writeFile(path.join(globalTarget(h), 'stray.txt'), 'user file\n');

      await mcpOnlyRemoval(h, { scope: 'global' });

      expect(fs.readFileSync(path.join(globalTarget(h), 'stray.txt'), 'utf8')).toBe('user file\n');
      expect(dhAt(globalConfig(h))).toBeUndefined();
    });
  });
});

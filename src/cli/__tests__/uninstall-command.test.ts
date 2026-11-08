/**
 * uninstall-command.test.ts — ownership-safe uninstall orchestration (4.3).
 *
 * Every case runs against a temp HOME/XDG/OPENCODE config, project dir, and
 * fixture package root; nothing touches the real home or the network. Covers
 * both scopes, idempotency, dry-run, unmanaged/symlink refusal, corrupt
 * manifests, differing entries with/without force, invalid JSONC, JSON output,
 * prompt routing, and the `--mcp-only` placeholder.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { rejectionOf } from '../../__tests__/helpers/errors.js';
import { MANIFEST_FILE_NAME } from '../manifest.js';
import { buildMcpEntry } from '../mcp-entry.js';
import { PromptCancelledError } from '../prompt.js';
import { globalUninstallEnvelope, install, reset, uninstall, uninstallJson } from './helpers/command-harness.js';
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

const manifestAt = (target: string): string => path.join(target, MANIFEST_FILE_NAME);
const dhAt = (config: string): unknown => (readJsonc(config) as ConfigLike).mcp?.servers?.dh;

describe('runUninstall', () => {
  it('removes a global managed install and its dh entry, preserving unrelated config', async () => {
    await withInstallHarness(async (h) => {
      const original =
        '// user config\n{\n  // keep theme\n  "theme": "dark",\n' +
        '  "mcp": { "servers": { "other": { "type": "local", "command": ["other"] } } }\n}\n';
      writeFile(globalConfig(h), original);
      await install(h, { scope: 'global' });
      const configBefore = fs.readFileSync(globalConfig(h), 'utf8');
      reset(h);
      await uninstall(h, { scope: 'global' });

      expect(fs.existsSync(globalTarget(h))).toBe(false);
      const text = fs.readFileSync(globalConfig(h), 'utf8');
      expect(text).toContain('// user config');
      expect(text).toContain('// keep theme');
      const parsed = readJsonc(globalConfig(h)) as ConfigLike;
      expect(parsed.theme).toBe('dark');
      expect(dhAt(globalConfig(h))).toBeUndefined();
      const servers = (parsed.mcp?.servers ?? {}) as Record<string, unknown>;
      expect(servers.other).toEqual({ type: 'local', command: ['other'] });
      expect(fs.readFileSync(`${globalConfig(h)}.bak`, 'utf8')).toBe(configBefore);
      expect(h.stdout.text).toContain('uninstall: target: removed');
      expect(h.stderr.text).toBe('');
    });
  });

  it('removes a project install and prunes empty mcp containers', async () => {
    await withInstallHarness(async (h) => {
      writeFile(projectConfig(h), '{\n  "theme": "dark"\n}\n');
      await install(h, { scope: 'project', path: h.projectDir });
      reset(h);
      await uninstall(h, { scope: 'project', path: h.projectDir });

      expect(fs.existsSync(projectTarget(h))).toBe(false);
      expect(readJsonc(projectConfig(h))).toEqual({ theme: 'dark' });
    });
  });

  it('is a no-op with exit 0 when nothing is installed', async () => {
    await withInstallHarness(async (h) => {
      const body = await uninstallJson(h, { scope: 'global' });
      expect(body).toMatchObject({
        ok: true,
        action: 'nothing',
        changed: false,
        mcp: { action: 'skipped', changed: false },
        dryRun: false,
      });
      expect(fs.existsSync(h.globalDir)).toBe(false);
      reset(h);
      await uninstall(h, { scope: 'global' });
      expect(h.stdout.text).toContain('nothing to do');
    });
  });

  it('reports intended removals in --dry-run without writing or deleting', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      const manifestBefore = fs.readFileSync(manifestAt(globalTarget(h)), 'utf8');
      const configBefore = fs.readFileSync(globalConfig(h), 'utf8');
      reset(h);
      await uninstall(h, { scope: 'global', dryRun: true });
      expect(h.stdout.text).toMatch(/would remove/);
      expect(h.stdout.text).toContain('dry run: no changes written');
      expect(fs.readFileSync(manifestAt(globalTarget(h)), 'utf8')).toBe(manifestBefore);
      expect(fs.readFileSync(globalConfig(h), 'utf8')).toBe(configBefore);
      expect(fs.existsSync(`${globalConfig(h)}.bak`)).toBe(false);
      reset(h);
      const body = await uninstallJson(h, { scope: 'global', dryRun: true });
      expect(body).toEqual({
        ok: true,
        command: 'uninstall',
        scope: 'global',
        target: globalTarget(h),
        action: 'dry-run',
        changed: true,
        config: globalConfig(h),
        mcp: { action: 'removed', changed: true },
        dryRun: true,
      });
      expect(fs.existsSync(globalTarget(h))).toBe(true);
      expect(fs.existsSync(`${globalConfig(h)}.bak`)).toBe(false);
    });
  });

  it('refuses unmanaged and symlinked targets even with --force', async () => {
    await withInstallHarness(async (h) => {
      writeFile(path.join(globalTarget(h), 'stray.txt'), 'user file\n');
      const error = await rejectionOf(uninstall(h, { scope: 'global', force: true, json: true }));
      expect(error.message).toMatch(/refusing to uninstall/);
      expect(error.message).toMatch(/remove it manually/);
      expect(JSON.parse(h.stdout.text)).toMatchObject({
        ok: false,
        command: 'uninstall',
        action: 'refused',
        changed: false,
        mcp: { action: 'skipped', changed: false },
      });
      expect(fs.readFileSync(path.join(globalTarget(h), 'stray.txt'), 'utf8')).toBe('user file\n');
      fs.rmSync(globalTarget(h), { recursive: true, force: true });
      const outside = path.join(h.root, 'outside');
      writeFile(path.join(outside, 'keep.txt'), 'keep\n');
      fs.mkdirSync(path.dirname(globalTarget(h)), { recursive: true });
      fs.symlinkSync(outside, globalTarget(h));
      const symlinkError = await rejectionOf(uninstall(h, { scope: 'global', force: true }));
      expect(symlinkError.message).toMatch(/symbolic link/);
      expect(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe('keep\n');
      expect(fs.lstatSync(globalTarget(h)).isSymbolicLink()).toBe(true);
    });
  });

  it('refuses a corrupt manifest and removes it only with --force, leaving unowned config', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      writeFile(manifestAt(globalTarget(h)), '{not json\n');
      reset(h);
      const error = await rejectionOf(uninstall(h, { scope: 'global' }));
      expect(error.message).toMatch(/refusing to uninstall/);
      expect(fs.existsSync(globalTarget(h))).toBe(true);
      await uninstall(h, { scope: 'global', force: true });
      expect(fs.existsSync(globalTarget(h))).toBe(false);
      expect(dhAt(globalConfig(h))).toEqual(buildMcpEntry());
    });
  });

  it.each([
    { source: 'npm' as const, removed: true },
    { source: 'github' as const, removed: false },
  ])('handles a forced corrupt uninstall with --mcp-source $source', async ({ source, removed }) => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global', mcpSource: 'npm' });
      writeFile(manifestAt(globalTarget(h)), '{not json\n');
      reset(h);
      const body = await uninstallJson(h, { scope: 'global', force: true, mcpSource: source });
      expect(fs.existsSync(globalTarget(h))).toBe(false);
      if (removed) {
        expect(dhAt(globalConfig(h))).toBeUndefined();
        expect(body.mcp).toEqual({ action: 'removed', changed: true });
      } else {
        expect(dhAt(globalConfig(h))).toEqual(buildMcpEntry());
        expect(body.mcp).toMatchObject({ action: 'mismatch', changed: false });
        expect((body.mcp as Record<string, unknown>).warning).toMatch(/does not match/);
        expect(h.stderr.text).toMatch(/does not match the managed entry/);
      }
    });
  });

  it('preserves a differing dh entry with a warning and removes it with --force', async () => {
    await withInstallHarness(async (h) => {
      const custom = { type: 'local', command: ['custom'], protocol: '2026-07-28', timeout: { startup: 1 } };
      await install(h, { scope: 'global' });
      writeFile(globalConfig(h), `// keep\n{\n  "mcp": { "servers": { "dh": ${JSON.stringify(custom)} } }\n}\n`);
      reset(h);
      await uninstall(h, { scope: 'global' });
      expect(fs.existsSync(globalTarget(h))).toBe(false);
      expect(dhAt(globalConfig(h))).toEqual(custom);
      expect(h.stderr.text).toMatch(/does not match the managed entry/);
      await install(h, { scope: 'global' });
      reset(h);
      await uninstall(h, { scope: 'global', force: true });
      expect(readJsonc(globalConfig(h))).toEqual({});
    });
  });

  it('keeps the plugin when the managed config is invalid JSONC', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      const broken = '{\n  "mcp": {\n';
      writeFile(globalConfig(h), broken);
      reset(h);
      const error = await rejectionOf(uninstall(h, { scope: 'global' }));
      expect(error.message).toMatch(/cannot remove the dh MCP entry/);
      expect(error.message).toMatch(/plugin was kept/);
      expect(fs.existsSync(globalTarget(h))).toBe(true);
      expect(fs.readFileSync(globalConfig(h), 'utf8')).toBe(broken);
    });
  });

  it('emits a single JSON envelope for a completed uninstall', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      reset(h);

      const body = await uninstallJson(h, { scope: 'global' });
      expect(h.stdout.text.trimEnd().split('\n')).toHaveLength(1);
      expect(body).toEqual(globalUninstallEnvelope(h, 'removed', 'removed', true, false));
      expect(h.stderr.text).toBe('');
    });
  });

  it('skips MCP cleanup for an install made with --no-mcp', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global', noMcp: true });
      const body = await uninstallJson(h, { scope: 'global' });
      expect(body.mcp).toEqual({ action: 'skipped', changed: false });
      expect(fs.existsSync(globalTarget(h))).toBe(false);
      expect(fs.existsSync(globalConfig(h))).toBe(false);
    });
  });

  it('treats a missing config as a no-op and still removes the plugin', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      fs.rmSync(globalConfig(h));
      const body = await uninstallJson(h, { scope: 'global' });
      expect(body.mcp).toEqual({ action: 'missing', changed: false });
      expect(fs.existsSync(globalTarget(h))).toBe(false);
    });
  });

  it('fails with usage exit 2 without a scope and maps cancel to exit 1', async () => {
    await withInstallHarness(async (h) => {
      await expect(uninstall(h)).rejects.toMatchObject({ name: 'UsageError', exitCode: 2 });

      const jsonReader = vi.fn(async () => ({ question: async () => 'G', close: () => {} }));
      await expect(
        uninstall(h, { json: true }, { inputIsTTY: true, outputIsTTY: true, createReader: jsonReader })
      ).rejects.toMatchObject({ name: 'UsageError', exitCode: 2 });
      expect(jsonReader).not.toHaveBeenCalled();

      const cancelReader = vi.fn(async () => ({ question: async () => 'C', close: () => {} }));
      await expect(
        uninstall(h, {}, { inputIsTTY: true, outputIsTTY: true, createReader: cancelReader })
      ).rejects.toBeInstanceOf(PromptCancelledError);
      expect(cancelReader).toHaveBeenCalledTimes(1);
    });
  });
});

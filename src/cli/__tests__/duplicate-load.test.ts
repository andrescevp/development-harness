/**
 * duplicate-load.test.ts — coexist warning for `opencode plugin add` (4.4).
 *
 * A managed copy plus a `plugins` config entry loads the plugin twice. Normal
 * installs warn without editing the OpenCode-owned array, `--mcp-only` stays
 * silent, and status exposes the entry for inspection without changing its
 * exit-code policy.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CommandOptions } from '../args.js';
import { runInstall } from '../commands/install.js';
import { runStatus } from '../commands/status.js';
import { EXIT_FAILURE, EXIT_SUCCESS } from '../errors.js';
import { buildMcpEntry } from '../mcp-entry.js';
import {
  type ConfigLike,
  globalConfig,
  globalTarget,
  type InstallHarness,
  readJsonc,
  withInstallHarness,
  writeFile,
} from './helpers/install-harness.js';

const install = (h: InstallHarness, options: Partial<CommandOptions> = {}) => runInstall(h.options(options), h.deps());
const status = (h: InstallHarness, options: Partial<CommandOptions> = {}) => runStatus(h.options(options), h.deps());
const pluginsAt = (config: string): unknown => (readJsonc(config) as ConfigLike).plugins;
const reset = (h: InstallHarness): void => {
  h.stdout.text = '';
  h.stderr.text = '';
};

/** Write a config that is already wired to the canonical dh entry. */
function writeWiredConfig(h: InstallHarness, plugins: readonly string[]): void {
  writeFile(globalConfig(h), `${JSON.stringify({ plugins, mcp: { servers: { dh: buildMcpEntry() } } }, null, 2)}\n`);
}

async function statusJson(h: InstallHarness, options: Partial<CommandOptions> = {}): Promise<Record<string, unknown>> {
  reset(h);
  const code = await status(h, { ...options, json: true });
  return { ...(JSON.parse(h.stdout.text) as Record<string, unknown>), exitCode: code };
}

describe('duplicate-load detection', () => {
  it.each([
    'dev-harness-skills',
    'dev-harness-skills@1.2.3',
    'github:andrescevp/development-harness#main',
    'git+https://github.com/andrescevp/development-harness.git',
  ])('warns on a managed install when the plugins array lists %s', async (specifier) => {
    await withInstallHarness(async (h) => {
      writeFile(globalConfig(h), `${JSON.stringify({ plugins: ['other-plugin', specifier] }, null, 2)}\n`);

      await install(h, { scope: 'global' });

      expect(h.stderr.text).toMatch(/already loads this plugin/);
      expect(h.stderr.text).toMatch(/load it twice/);
      expect(h.stderr.text).toContain('--mcp-only');
      expect(h.stderr.text).toContain(specifier);
      expect(pluginsAt(globalConfig(h))).toEqual(['other-plugin', specifier]);
      expect(fs.existsSync(globalTarget(h))).toBe(true);
    });
  });

  it('does not warn for unrelated plugin entries', async () => {
    await withInstallHarness(async (h) => {
      writeFile(globalConfig(h), `${JSON.stringify({ plugins: ['other-plugin@1.0.0'] }, null, 2)}\n`);
      await install(h, { scope: 'global' });
      expect(h.stderr.text).toBe('');
    });
  });

  it('does not warn in --mcp-only mode even when the plugins array matches', async () => {
    await withInstallHarness(async (h) => {
      writeFile(globalConfig(h), `${JSON.stringify({ plugins: ['dev-harness-skills@1.2.3'] }, null, 2)}\n`);
      await install(h, { scope: 'global', mcpOnly: true });

      expect(h.stderr.text).toBe('');
      expect(pluginsAt(globalConfig(h))).toEqual(['dev-harness-skills@1.2.3']);
      expect(fs.existsSync(globalTarget(h))).toBe(false);
    });
  });

  it('reports duplicateLoad in status without changing the successful exit code', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      writeWiredConfig(h, ['dev-harness-skills@1.2.3']);

      const body = await statusJson(h, { scope: 'global' });
      expect(body.exitCode).toBe(EXIT_SUCCESS);
      expect(body).toMatchObject({
        ok: true,
        installed: true,
        duplicateLoad: true,
        pluginEntries: ['dev-harness-skills@1.2.3'],
        mcp: { status: 'matching', matching: true },
      });
      expect((body.issues as string[]).join(' ')).toMatch(/already loads this plugin/);
      expect(h.stderr.text).toMatch(/warning: .*already loads this plugin/);
    });
  });

  it('exposes plugin entries without duplicateLoad when no managed copy exists', async () => {
    await withInstallHarness(async (h) => {
      writeFile(
        globalConfig(h),
        `${JSON.stringify({ plugins: ['github:andrescevp/development-harness#main'] }, null, 2)}\n`
      );

      const body = await statusJson(h, { scope: 'global' });
      expect(body.exitCode).toBe(EXIT_FAILURE);
      expect(body).toMatchObject({
        ok: false,
        installed: false,
        duplicateLoad: false,
        pluginEntries: ['github:andrescevp/development-harness#main'],
      });
      expect(h.stderr.text).toBe('');
    });
  });

  it('reports no entries or issue for unrelated plugins', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      writeWiredConfig(h, ['other-plugin']);

      const body = await statusJson(h, { scope: 'global' });
      expect(body).toMatchObject({ duplicateLoad: false, pluginEntries: [] });
      expect(body.issues).toEqual([]);
      expect(h.stderr.text).toBe('');
    });
  });
});

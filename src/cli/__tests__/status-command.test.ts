/**
 * status-command.test.ts — read-only status orchestration (sub-task 4.2).
 *
 * Every case runs against a temp HOME/XDG/OPENCODE config, project dir, and
 * fixture package root; nothing touches the real home or the network. Covers
 * managed current/older/newer, absent, unmanaged, corrupt manifests, config
 * missing/different/invalid/unreadable, JSON exit codes, prompt routing, and
 * the read-only guarantee.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { EXIT_FAILURE, EXIT_SUCCESS, EXIT_USAGE } from '../errors.js';
import {
  FIXTURE_VERSION,
  globalConfig,
  globalTarget,
  projectTarget,
  withInstallHarness,
  writeFile,
} from './helpers/install-harness.js';
import { install, manifestFile, reset, snapshot, status, statusJson } from './helpers/status-harness.js';

describe('runStatus', () => {
  it('reports a current global install with a stable JSON envelope', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      reset(h);

      const { code, body } = await statusJson(h, { scope: 'global' });
      expect(code).toBe(EXIT_SUCCESS);
      expect(h.stdout.text.trimEnd().split('\n')).toHaveLength(1);
      expect(body).toEqual({
        ok: true,
        command: 'status',
        scope: 'global',
        target: globalTarget(h),
        installed: true,
        version: FIXTURE_VERSION,
        state: 'managed-current',
        plugin: {
          status: 'managed-current',
          version: FIXTURE_VERSION,
          missingFiles: [],
          extraFiles: [],
        },
        config: globalConfig(h),
        mcp: { status: 'matching', matching: true },
        duplicateLoad: false,
        pluginEntries: [],
        issues: [],
      });
      expect(h.stderr.text).toBe('');
    });
  });

  it('reports project state in human output, honoring an existing opencode.json', async () => {
    await withInstallHarness(async (h) => {
      const config = path.join(h.projectDir, 'opencode.json');
      writeFile(config, '{\n  "theme": "dark"\n}\n');
      await install(h, { scope: 'project', path: h.projectDir });
      reset(h);

      expect(await status(h, { scope: 'project', path: h.projectDir })).toBe(EXIT_SUCCESS);
      expect(h.stdout.text).toContain('status: scope: project');
      expect(h.stdout.text).toContain(`status: target: ${projectTarget(h)}`);
      expect(h.stdout.text).toContain('status: plugin: managed install v1.2.3 is current');
      expect(h.stdout.text).toContain(`status: config: ${config}`);
      expect(h.stdout.text).toContain('status: dh MCP entry: matching');
      expect(h.stderr.text).toBe('');
    });
  });

  it('reports absent as exit 1 in JSON and human output without an error line', async () => {
    await withInstallHarness(async (h) => {
      const { code, body } = await statusJson(h, { scope: 'global' });
      expect(code).toBe(EXIT_FAILURE);
      expect(body).toMatchObject({
        ok: false,
        command: 'status',
        scope: 'global',
        target: globalTarget(h),
        installed: false,
        version: FIXTURE_VERSION,
        state: 'absent',
        plugin: { status: 'absent' },
        config: globalConfig(h),
        mcp: { status: 'missing', matching: false },
      });
      expect(body.issues).toContain('not installed');

      reset(h);
      expect(await status(h, { scope: 'global' })).toBe(EXIT_FAILURE);
      expect(h.stdout.text).toContain('not installed');
      expect(h.stderr.text).toBe('');
    });
  });

  it('reports an unmanaged target as exit 1 and leaves it untouched', async () => {
    await withInstallHarness(async (h) => {
      writeFile(path.join(globalTarget(h), 'stray.txt'), 'user file\n');

      const { code, body } = await statusJson(h, { scope: 'global' });
      expect(code).toBe(EXIT_FAILURE);
      expect(body).toMatchObject({
        ok: false,
        installed: false,
        state: 'unmanaged',
        plugin: { status: 'unmanaged', reason: expect.stringContaining('no install manifest') as unknown },
      });
      expect(fs.readFileSync(path.join(globalTarget(h), 'stray.txt'), 'utf8')).toBe('user file\n');
    });
  });

  it('reports a corrupt manifest as inspectable (exit 0) with a diagnostic', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      writeFile(manifestFile(globalTarget(h)), '{not json\n');
      reset(h);

      const { code, body } = await statusJson(h, { scope: 'global' });
      expect(code).toBe(EXIT_SUCCESS);
      expect(body).toMatchObject({
        ok: true,
        installed: true,
        state: 'corrupt',
        plugin: { status: 'corrupt', reason: 'install manifest is not valid JSON' },
        mcp: { status: 'matching', matching: true },
      });
      expect(body.issues).toContain('install manifest is corrupt: install manifest is not valid JSON');
      expect(h.stderr.text).toContain('install manifest is corrupt');
    });
  });

  it.each([
    { cli: '2.0.0', state: 'managed-older', drift: /older than CLI version 2\.0\.0/ },
    { cli: '1.0.0', state: 'managed-newer', drift: /newer than CLI version 1\.0\.0/ },
  ])('reports $state against CLI $cli', async ({ cli, state, drift }) => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      reset(h);

      const { code, body } = await statusJson(h, { scope: 'global' }, { version: cli });
      expect(code).toBe(EXIT_SUCCESS);
      expect(body).toMatchObject({
        ok: true,
        installed: true,
        version: cli,
        state,
        plugin: { status: state, version: FIXTURE_VERSION },
        mcp: { status: 'matching', matching: true },
      });
      expect((body.issues as string[]).join(' ')).toMatch(drift);
      expect(h.stderr.text).toMatch(/warning:/);
    });
  });

  it('reports missing and extra files as drift without failing', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      fs.rmSync(path.join(globalTarget(h), 'dist', 'assets', 'agents', 'agent-0.md'));
      writeFile(path.join(globalTarget(h), 'notes.txt'), 'user file\n');
      reset(h);

      const { code, body } = await statusJson(h, { scope: 'global' });
      expect(code).toBe(EXIT_SUCCESS);
      expect(body).toMatchObject({
        state: 'managed-current',
        plugin: {
          status: 'managed-current',
          missingFiles: ['dist/assets/agents/agent-0.md'],
          extraFiles: ['notes.txt'],
        },
      });
      expect(body.issues).toEqual(
        expect.arrayContaining(['1 managed file(s) missing', '1 file(s) not managed by the installer'])
      );
      expect(h.stderr.text).toContain('1 managed file(s) missing');
    });
  });

  it('reports a missing dh entry while keeping a managed install successful', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      fs.rmSync(globalConfig(h));
      reset(h);

      const result = await statusJson(h, { scope: 'global' });
      expect(result.code).toBe(EXIT_SUCCESS);
      expect(result.body).toMatchObject({ ok: true, installed: true, mcp: { status: 'missing', matching: false } });
      expect(result.body.issues).toContain('dh MCP entry is missing');
      expect(h.stderr.text).toContain('dh MCP entry is missing');
      expect(fs.existsSync(globalConfig(h))).toBe(false);
    });
  });

  it('reports a differing dh entry without printing its contents', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      const custom = { type: 'local', command: ['custom-server'], secret: 'do-not-print' };
      writeFile(globalConfig(h), `${JSON.stringify({ mcp: { servers: { dh: custom } } })}\n`);
      reset(h);

      const { code, body } = await statusJson(h, { scope: 'global' });
      expect(code).toBe(EXIT_SUCCESS);
      expect(body).toMatchObject({ installed: true, mcp: { status: 'different', matching: false } });
      expect(body.issues).toContain('dh MCP entry differs from the expected entry');
      expect(h.stdout.text).not.toContain('do-not-print');
      expect(h.stderr.text).not.toContain('do-not-print');
    });
  });

  it('reports invalid JSONC as exit 1 without throwing and still emits JSON', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      writeFile(globalConfig(h), '{\n  "mcp": {\n');
      reset(h);

      const { code, body } = await statusJson(h, { scope: 'global' });
      expect(code).toBe(EXIT_FAILURE);
      expect(body).toMatchObject({ ok: false, installed: true, mcp: { status: 'invalid', matching: false } });
      expect((body.issues as string[]).join(' ')).toMatch(/config is not valid JSONC/);
      expect(h.stderr.text).toMatch(/warning: config is not valid JSONC/);
      expect(h.stderr.text).not.toContain('"mcp"');
    });
  });

  it('reports an unreadable config path as exit 1', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      fs.rmSync(globalConfig(h));
      fs.mkdirSync(globalConfig(h));
      reset(h);

      const { code, body } = await statusJson(h, { scope: 'global' });
      expect(code).toBe(EXIT_FAILURE);
      expect(body).toMatchObject({ ok: false, mcp: { status: 'unreadable', matching: false } });
      expect(h.stderr.text).toMatch(/warning: config is unreadable/);
    });
  });

  it('honors an explicit GitHub MCP source when classifying the entry', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global', mcpSource: 'github' });
      reset(h);

      expect((await statusJson(h, { scope: 'global' })).body.mcp).toEqual({ status: 'different', matching: false });
      reset(h);
      expect((await statusJson(h, { scope: 'global', mcpSource: 'github' })).body.mcp).toEqual({
        status: 'matching',
        matching: true,
      });
    });
  });

  it('fails with exit 2 without a scope in a non-TTY and never prompts in JSON mode', async () => {
    await withInstallHarness(async (h) => {
      await expect(status(h)).rejects.toMatchObject({ name: 'UsageError', exitCode: EXIT_USAGE });
      await expect(status(h)).rejects.toThrow(/--global or --project/);

      const reader = vi.fn(async () => ({ question: async () => 'G', close: () => {} }));
      await expect(
        status(h, { json: true }, { inputIsTTY: true, outputIsTTY: true, createReader: reader })
      ).rejects.toMatchObject({ name: 'UsageError', exitCode: EXIT_USAGE });
      expect(reader).not.toHaveBeenCalled();
    });
  });

  it('maps a cancelled prompt to exit 1', async () => {
    await withInstallHarness(async (h) => {
      const reader = vi.fn(async () => ({ question: async () => 'C', close: () => {} }));
      await expect(status(h, {}, { inputIsTTY: true, outputIsTTY: true, createReader: reader })).rejects.toMatchObject({
        name: 'PromptCancelledError',
        exitCode: EXIT_FAILURE,
      });
      expect(reader).toHaveBeenCalledTimes(1);
    });
  });

  it('never writes: config, targets, home, and fixture are unchanged', async () => {
    await withInstallHarness(async (h) => {
      await install(h, { scope: 'global' });
      await install(h, { scope: 'project', path: h.projectDir });
      const tree = () => ({
        home: snapshot(h.home),
        global: snapshot(h.globalDir),
        project: snapshot(h.projectDir),
        fixture: snapshot(h.packageRoot),
      });
      const before = tree();

      expect(await status(h, { scope: 'global', json: true })).toBe(EXIT_SUCCESS);
      expect(await status(h, { scope: 'project', path: h.projectDir })).toBe(EXIT_SUCCESS);
      expect(await status(h, { scope: 'project', path: h.projectDir, json: true })).toBe(EXIT_SUCCESS);

      expect(tree()).toEqual(before);
    });
  });
});

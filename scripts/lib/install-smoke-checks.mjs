/**
 * install-smoke-checks.mjs — filesystem assertions for scripts/smoke-install.mjs.
 *
 * Keeps the smoke orchestrator focused on command order. Each helper reports
 * through the caller's `check(label, ok, detail)` so failures still print one
 * line per assertion and the script exits non-zero with a clear summary.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readJson, readJsonc } from './install-smoke.mjs';

function describe(error) {
  return error instanceof Error ? error.message : String(error);
}

function isFileWithContent(file) {
  const stats = fs.statSync(file, { throwIfNoEntry: false });
  return stats?.isFile() === true && stats.size > 0;
}

export function isDirectory(dir) {
  return fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory() === true;
}

function readEntries(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isDhEntry(entry) {
  return (
    entry?.type === 'local' &&
    Array.isArray(entry.command) &&
    entry.command.join(' ') === 'npx -y --package=dev-harness-skills dev-harness-mcp' &&
    entry.protocol === '2026-07-28' &&
    entry.timeout?.startup === 300_000
  );
}

/** Require the built CLI, bundle, and the 7-agent/17-skill corpus. */
export function preflight(repoRoot, check) {
  const cli = path.join(repoRoot, 'dist', 'cli.js');
  const plugin = path.join(repoRoot, 'dist', 'plugin.js');
  const assets = path.join(repoRoot, 'dist', 'assets');
  const skills = path.join(assets, 'skills');
  const agents = readEntries(path.join(assets, 'agents')).filter(
    (entry) => entry.isFile() && entry.name.endsWith('.md')
  );
  const skillDirs = readEntries(skills).filter(
    (entry) => entry.isDirectory() && fs.existsSync(path.join(skills, entry.name, 'SKILL.md'))
  );

  check('dist/cli.js exists and is non-empty', isFileWithContent(cli), 'run pnpm build');
  check('dist/plugin.js exists and is non-empty', isFileWithContent(plugin), 'run pnpm build');
  check('dist/assets exists', isDirectory(assets), 'run pnpm build');
  check('dist/assets has exactly 7 agent files', agents.length === 7, `found ${agents.length}`);
  check('dist/assets has exactly 17 skill directories', skillDirs.length === 17, `found ${skillDirs.length}`);
  return (
    isFileWithContent(cli) &&
    isFileWithContent(plugin) &&
    isDirectory(assets) &&
    agents.length === 7 &&
    skillDirs.length === 17
  );
}

/** Validate the installer-owned manifest fields and managed file list. */
export function inspectManifest(target, configPath, version, check) {
  let manifest;
  try {
    manifest = readJson(path.join(target, '.dev-harness-install.json'));
  } catch (error) {
    check('project: install manifest is valid JSON', false, describe(error));
    return;
  }
  check(
    'project: manifest records package, version, scope, and target',
    manifest.schemaVersion === 1 &&
      manifest.package === 'dev-harness-skills' &&
      manifest.version === version &&
      manifest.scope === 'project' &&
      manifest.target === target
  );
  check(
    'project: manifest records the managed config and files',
    manifest.config?.path === configPath &&
      manifest.config?.key === 'mcp.servers.dh' &&
      ['index.ts', 'package.json', 'dist/plugin.js'].every((entry) => manifest.files?.includes(entry))
  );
}

/** Parse a config and assert the dh entry, unrelated data, and comment survival. */
export function inspectConfig(label, file, expected, check) {
  let parsed;
  try {
    parsed = readJsonc(file);
  } catch (error) {
    check(`${label}: config readable`, false, describe(error));
    return;
  }
  check(`${label}: valid JSONC`, parsed.ok, file);
  if (!parsed.ok) return;

  const servers = parsed.value?.mcp?.servers;
  check(
    `${label}: dh ${expected.dh ? 'wired with the canonical entry' : 'removed'}`,
    expected.dh ? isDhEntry(servers?.dh) : servers?.dh === undefined,
    JSON.stringify(servers?.dh)
  );
  if (expected.other === true) {
    check(
      `${label}: unrelated server, theme, and comment preserved`,
      servers?.other?.command?.[0] === 'echo' &&
        parsed.value?.theme === 'smoke' &&
        parsed.text.includes('// smoke: preserve this comment')
    );
  }
}

/** Import the installed bundle exactly as OpenCode's loader would. */
export async function inspectInstalledPlugin(target, check) {
  const bundle = path.join(target, 'dist', 'plugin.js');
  try {
    const module = await import(`${pathToFileURL(bundle).href}?smoke=${Date.now()}`);
    const plugin = module.default;
    check(
      'project: installed dist/plugin.js imports with id and setup',
      typeof plugin?.id === 'string' && plugin.id.length > 0 && typeof plugin?.setup === 'function'
    );
  } catch (error) {
    check('project: installed dist/plugin.js imports with id and setup', false, describe(error));
  }
}

#!/usr/bin/env node
/**
 * smoke-install.mjs — release-gate smoke over the BUILT installer CLI.
 *
 * Every command runs as `node dist/cli.js` in a fresh temp root with isolated
 * HOME, XDG_CONFIG_HOME, and OPENCODE_CONFIG_DIR; no network, npm/npx, or real
 * HOME access. Covers the project and global lifecycles, idempotent re-runs,
 * status, uninstall, dry-run, --no-mcp, --mcp-only, non-TTY usage errors, the
 * single-object `--json` stdout contract, and installed-plugin importability.
 *
 * One line per check; exit 0 on success, 1 on any failure. The temp root is
 * removed in `finally`, and the developer's real config surface is snapshotted
 * before/after to prove the isolation held.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  changedPaths,
  createIsolatedEnv,
  createProject,
  createRoot,
  parseSuccessEnvelope,
  readJson,
  runCli,
  snapshotRealConfig,
  writeFile,
} from './lib/install-smoke.mjs';
import {
  inspectConfig,
  inspectInstalledPlugin,
  inspectManifest,
  isDirectory,
  preflight,
} from './lib/install-smoke-checks.mjs';
import { cleanupRoot, createChecker, reportResult } from './lib/smoke-report.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG = '[smoke-install]';
const PLUGIN_DIR = 'dev-harness-skills';
const CONFIG_FILE = 'opencode.jsonc';
const EXPECTED_JSON_COMMANDS = 11;
const PACKAGE_VERSION = readJson(path.join(REPO_ROOT, 'package.json')).version;
const SEEDED_CONFIG = `// smoke: preserve this comment
{
  "theme": "smoke",
  "mcp": {
    "servers": {
      "other": {
        "type": "local",
        "command": ["echo"],
      },
    },
  },
}
`;

const { check, count } = createChecker();
let jsonCommands = 0;
let jsonFailures = 0;

function describe(error) {
  return error instanceof Error ? error.message : String(error);
}

/** Run one `--json` command and enforce the single-envelope contract. */
function jsonCommand(label, env, cwd, args, command) {
  jsonCommands += 1;
  const result = runCli(REPO_ROOT, args, cwd, env);
  const parsed = parseSuccessEnvelope(result, command);
  if (!parsed.ok) jsonFailures += 1;
  check(`${label}: ${command} --json exits 0 with one envelope`, parsed.ok, parsed.reason);
  return parsed.ok ? parsed.value : undefined;
}

async function runProjectLifecycle(root, env) {
  const project = createProject(root, 'project');
  const target = path.join(project, '.opencode', 'plugins', PLUGIN_DIR);
  const config = path.join(project, CONFIG_FILE);
  writeFile(config, SEEDED_CONFIG);

  jsonCommand('project install', env, root, ['install', '--project', '--path', project, '--yes', '--json'], 'install');
  check('project: managed target created', isDirectory(target));
  inspectManifest(target, config, PACKAGE_VERSION, check);
  inspectConfig('project install', config, { dh: true, other: true }, check);
  await inspectInstalledPlugin(target, check);

  const mtime = fs.statSync(target).mtimeMs;
  const rerun = jsonCommand(
    'project re-run',
    env,
    root,
    ['install', '--project', '--path', project, '--yes', '--json'],
    'install'
  );
  check(
    'project: idempotent re-run reports changed:false and mcp noop',
    rerun?.changed === false && rerun?.mcp?.action === 'noop' && rerun?.mcp?.changed === false
  );
  check('project: idempotent re-run leaves the target mtime unchanged', fs.statSync(target).mtimeMs === mtime);

  const status = jsonCommand(
    'project status',
    env,
    root,
    ['status', '--project', '--path', project, '--json'],
    'status'
  );
  check(
    'project: status reports installed with a matching dh entry',
    status?.installed === true && status?.mcp?.status === 'matching' && status?.mcp?.matching === true
  );

  jsonCommand(
    'project uninstall',
    env,
    root,
    ['uninstall', '--project', '--path', project, '--yes', '--json'],
    'uninstall'
  );
  check('project: uninstall removed the managed target', !fs.existsSync(target));
  inspectConfig('project uninstall', config, { dh: false, other: true }, check);
}

function runGlobalLifecycle(root, isolated) {
  const config = path.join(isolated.globalDir, CONFIG_FILE);
  writeFile(config, SEEDED_CONFIG);
  const target = path.join(isolated.globalDir, 'plugins', PLUGIN_DIR);

  const install = jsonCommand(
    'global install',
    isolated.env,
    root,
    ['install', '--global', '--yes', '--json'],
    'install'
  );
  check(
    'global: install used the isolated OPENCODE_CONFIG_DIR',
    isDirectory(target) && install?.target === target && install?.config === config
  );
  inspectConfig('global install', config, { dh: true, other: true }, check);

  const status = jsonCommand('global status', isolated.env, root, ['status', '--global', '--json'], 'status');
  check(
    'global: status reports installed with a matching dh entry',
    status?.installed === true && status?.mcp?.matching === true
  );

  jsonCommand('global uninstall', isolated.env, root, ['uninstall', '--global', '--yes', '--json'], 'uninstall');
  check('global: uninstall removed the managed target', !fs.existsSync(target));
  inspectConfig('global uninstall', config, { dh: false, other: true }, check);
}

function runFlagMatrix(root, env) {
  const dryProject = createProject(root, 'dry-project');
  const dry = jsonCommand(
    'dry-run install',
    env,
    root,
    ['install', '--project', '--path', dryProject, '--yes', '--json', '--dry-run'],
    'install'
  );
  check(
    'dry-run: reports dryRun:true and a planned dh insert',
    dry?.dryRun === true && dry?.mcp?.action === 'inserted'
  );
  check(
    'dry-run: created no target and no config',
    !fs.existsSync(path.join(dryProject, '.opencode')) && !fs.existsSync(path.join(dryProject, CONFIG_FILE))
  );

  const noMcpProject = createProject(root, 'no-mcp-project');
  jsonCommand(
    'no-mcp install',
    env,
    root,
    ['install', '--project', '--path', noMcpProject, '--yes', '--json', '--no-mcp'],
    'install'
  );
  check('no-mcp: installed the plugin', isDirectory(path.join(noMcpProject, '.opencode', 'plugins', PLUGIN_DIR)));
  check(
    'no-mcp: created no config file',
    !fs.existsSync(path.join(noMcpProject, CONFIG_FILE)) && !fs.existsSync(path.join(noMcpProject, 'opencode.json'))
  );

  const mcpOnlyProject = createProject(root, 'mcp-only-project');
  const mcpOnlyConfig = path.join(mcpOnlyProject, CONFIG_FILE);
  jsonCommand(
    'mcp-only install',
    env,
    root,
    ['install', '--project', '--path', mcpOnlyProject, '--yes', '--json', '--mcp-only'],
    'install'
  );
  inspectConfig('mcp-only install', mcpOnlyConfig, { dh: true }, check);
  check('mcp-only: wrote no plugin copy or manifest', !fs.existsSync(path.join(mcpOnlyProject, '.opencode')));

  jsonCommand(
    'mcp-only uninstall',
    env,
    root,
    ['uninstall', '--project', '--path', mcpOnlyProject, '--yes', '--json', '--mcp-only'],
    'uninstall'
  );
  inspectConfig('mcp-only uninstall', mcpOnlyConfig, { dh: false }, check);
  check('mcp-only: uninstall left no plugin copy', !fs.existsSync(path.join(mcpOnlyProject, '.opencode')));
}

function runNonTtyCheck(root, env) {
  const project = createProject(root, 'no-scope-project');
  const result = runCli(REPO_ROOT, ['install', '--yes'], project, env);
  check(
    'non-TTY install without a scope exits 2 with a usage hint and no prompt',
    result.status === 2 &&
      result.signal === null &&
      result.stdout.trim() === '' &&
      result.stderr.includes('no scope selected') &&
      result.stderr.includes('--global or --project'),
    `exit ${String(result.status)}: ${result.error?.message ?? result.stderr.trim()}`
  );
}

function isIsolated(root, isolated) {
  const inside = (candidate) => candidate.startsWith(`${root}${path.sep}`);
  return (
    isolated.env.HOME === isolated.home &&
    isolated.env.XDG_CONFIG_HOME === isolated.xdg &&
    isolated.env.OPENCODE_CONFIG_DIR === isolated.globalDir &&
    [isolated.home, isolated.xdg, isolated.globalDir].every(inside)
  );
}

async function run(root) {
  const isolated = createIsolatedEnv(root);
  const realBefore = snapshotRealConfig();
  check(
    'env: HOME, XDG_CONFIG_HOME, and OPENCODE_CONFIG_DIR are isolated under the temp root',
    isIsolated(root, isolated)
  );

  await runProjectLifecycle(root, isolated.env);
  runGlobalLifecycle(root, isolated);
  runFlagMatrix(root, isolated.env);
  runNonTtyCheck(root, isolated.env);

  check(
    'json: every invocation emitted exactly one parsable object on stdout',
    jsonCommands === EXPECTED_JSON_COMMANDS && jsonFailures === 0,
    `${jsonCommands} invocation(s), ${jsonFailures} failure(s)`
  );
  const changed = changedPaths(realBefore);
  check('safety: real HOME and OpenCode config were not modified', changed.length === 0, changed.join(', '));
}

let rootDir;
try {
  rootDir = createRoot();
  if (preflight(REPO_ROOT, check)) await run(rootDir);
} catch (error) {
  check('smoke-install completed without an unexpected error', false, describe(error));
} finally {
  cleanupRoot(rootDir);
}

reportResult(LOG, count(), 'built CLI installs, reports, and uninstalls in isolated scopes');

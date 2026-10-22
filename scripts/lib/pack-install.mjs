/**
 * pack-install.mjs — offline install and runtime checks for smoke-pack.
 *
 * The prefix is seeded because an offline npm install cannot resolve registry
 * metadata: real copies cover the MCP path (server/core/zod), while direct
 * deps whose code is bundled or lazy get version stubs. This keeps the check
 * hermetic without fetching anything; `--offline` makes any accidental
 * registry request fail.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { readJson, tail } from './pack-utils.mjs';

const REQUEST_TIMEOUT_MS = 5_000;
const PACKAGE_NAME = 'dev-harness-skills';
const EXPECTED_TOOLS = [
  'logged_command',
  'plan_create',
  'plan_read',
  'plan_update_status',
  'read_sheet',
  'sheet_schema',
  'update_sheet',
].sort();
/** Packages copied for real: the installed MCP bin must resolve these. */
const REAL_DEPS = new Set(['@modelcontextprotocol/server', '@modelcontextprotocol/core', 'zod']);

function resolvePackageDir(name, fromFile) {
  const requireFrom = createRequire(fromFile);
  let dir = path.dirname(requireFrom.resolve(name));
  for (;;) {
    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest) && readJson(manifest).name === name) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`cannot resolve ${name} from ${fromFile}`);
    dir = parent;
  }
}

/** Temp HOME/cache/config keep npm away from the developer's real files. */
export function isolatedEnv(root) {
  const home = path.join(root, 'home');
  const cache = path.join(root, 'npm-cache');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(cache, { recursive: true });
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    npm_config_cache: cache,
    npm_config_userconfig: path.join(home, '.npmrc'),
    npm_config_update_notifier: 'false',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_loglevel: 'error',
  };
}

export function runNpm(args, env, cwd) {
  return spawnSync('npm', args, { cwd, env, encoding: 'utf8', timeout: 120_000 });
}

/**
 * Seed the clean prefix for an offline install. Real packages cover the MCP
 * path; direct deps whose code is bundled or lazy get version stubs so npm
 * does not ask the registry for them.
 */
export function seedPrefix(repoRoot, prefix, dependencies) {
  const nodeModules = path.join(prefix, 'node_modules');
  fs.mkdirSync(nodeModules, { recursive: true });
  const repoManifest = path.join(repoRoot, 'package.json');
  const serverDir = resolvePackageDir('@modelcontextprotocol/server', repoManifest);
  const copies = [
    ['@modelcontextprotocol/server', serverDir],
    [
      '@modelcontextprotocol/core',
      resolvePackageDir('@modelcontextprotocol/core', path.join(serverDir, 'package.json')),
    ],
    ['zod', resolvePackageDir('zod', repoManifest)],
  ];
  for (const [name, dir] of copies) {
    fs.cpSync(dir, path.join(nodeModules, name), { recursive: true, dereference: true });
  }
  for (const name of Object.keys(dependencies)) {
    if (REAL_DEPS.has(name)) continue;
    // Read the pnpm link directly: some packages (notably @opencode/plugin)
    // do not expose a require-resolvable main for `require.resolve(name)`.
    const installedDir = fs.realpathSync(path.join(repoRoot, 'node_modules', name));
    const { version } = readJson(path.join(installedDir, 'package.json'));
    const stubDir = path.join(nodeModules, name);
    fs.mkdirSync(stubDir, { recursive: true });
    fs.writeFileSync(path.join(stubDir, 'package.json'), JSON.stringify({ name, version }), 'utf8');
  }
}

function checkImport(prefix, env, check) {
  const probe = path.join(prefix, 'check-import.mjs');
  fs.writeFileSync(
    probe,
    [
      `const mod = await import(${JSON.stringify(PACKAGE_NAME)});`,
      'const plugin = mod.default;',
      'console.log(JSON.stringify({ id: plugin?.id, setup: typeof plugin?.setup }));',
      '',
    ].join('\n'),
    'utf8'
  );
  const imported = spawnSync(process.execPath, [probe], { cwd: prefix, env, encoding: 'utf8', timeout: 30_000 });
  let exported = {};
  try {
    exported = JSON.parse(String(imported.stdout ?? '').trim());
  } catch {
    // reported by the checks below
  }
  check('installed package imports by name', imported.status === 0, imported.error?.message ?? tail(imported.stderr));
  check(
    `default export exposes id "${exported.id ?? ''}"`,
    typeof exported.id === 'string' && exported.id.length > 0,
    JSON.stringify(exported)
  );
  check('default export setup is a function', exported.setup === 'function', String(exported.setup));
}

function checkBins(prefix, manifest, env, check) {
  const binDir = path.join(prefix, 'node_modules', '.bin');
  for (const args of [['--version'], ['--help']]) {
    const result = spawnSync(path.join(binDir, 'dev-harness'), args, { env, encoding: 'utf8', timeout: 30_000 });
    const stdout = String(result.stdout ?? '').trim();
    check(
      `node_modules/.bin/dev-harness ${args[0]} exits 0`,
      result.status === 0,
      result.error?.message ?? tail(result.stderr)
    );
    if (args[0] === '--version') {
      check('--version prints the packed version', stdout === manifest.version, stdout);
    }
  }
}

async function checkMcp(prefix, env, check) {
  const workspace = path.join(prefix, 'workspace');
  fs.mkdirSync(workspace, { recursive: true });
  const transport = new StdioClientTransport({
    command: path.join(prefix, 'node_modules', '.bin', 'dev-harness-mcp'),
    args: [],
    cwd: workspace,
    env: { ...getDefaultEnvironment(), DH_WORKSPACE_ROOT: '', HOME: env.HOME },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk) => {
    stderr = (stderr + String(chunk)).slice(-2000);
  });
  const client = new Client({ name: 'smoke-pack', version: '0.0.0' });
  try {
    await client.connect(transport, { timeout: REQUEST_TIMEOUT_MS });
    const { tools } = await client.listTools(undefined, { timeout: REQUEST_TIMEOUT_MS });
    const names = tools.map((tool) => tool.name).sort();
    check('installed MCP bin lists the 7 harness tools', names.join(',') === EXPECTED_TOOLS.join(','), names.join(','));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check('installed MCP bin lists the 7 harness tools', false, `${message}${stderr ? ` — ${tail(stderr)}` : ''}`);
  } finally {
    await client.close().catch(() => undefined);
  }
}

function checkAssets(prefix, source, check) {
  const assets = path.join(prefix, 'node_modules', PACKAGE_NAME, 'dist', 'assets');
  const agents = fs
    .readdirSync(path.join(assets, 'agents'))
    .filter((name) => name.endsWith('.md'))
    .sort();
  const skills = fs
    .readdirSync(path.join(assets, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(assets, 'skills', entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort();
  check('installed dist/assets has 7 agents', agents.length === 7, String(agents.length));
  check('installed dist/assets has 17 skills', skills.length === 17, String(skills.length));
  check('installed dist/assets has skills/index.md', fs.existsSync(path.join(assets, 'skills', 'index.md')));
  check(
    'installed agent/skill inventory matches source',
    agents.join(',') === source.agents.join(',') && skills.join(',') === source.skills.join(','),
    'inventory differs'
  );
}

export async function checkInstalled(prefix, manifest, source, env, check) {
  checkImport(prefix, env, check);
  checkBins(prefix, manifest, env, check);
  await checkMcp(prefix, env, check);
  checkAssets(prefix, source, check);
}

#!/usr/bin/env node
/**
 * smoke-pack.mjs — prove the packed npm tarball is a complete, importable
 * OpenCode plugin and that repository source-mode loading still works.
 *
 * Pipeline (offline, no registry, no publish):
 *   1. `npm pack --ignore-scripts --json` into a temp dir (build already on
 *      disk; `--ignore-scripts` keeps stdout pure JSON).
 *   2. Audit the pack list: entrypoints/declarations/assets, exactly 7 agents
 *      and 17 skills, no src/docs/tests/.env/plans/node_modules.
 *   3. `npm install <tarball> --offline` into a clean temp prefix. The prefix
 *      is seeded for offline resolution: real MCP deps (server/core/zod) are
 *      copied, and bundled/lazy direct deps get version stubs (see
 *      lib/pack-install.mjs). `--legacy-peer-deps` skips peers the bundled
 *      plugin does not need; `--offline` fails on any registry request.
 *   4. Import `dev-harness-skills` by name, assert `{ id, setup }`, run both
 *      CLIs, and perform a minimal MCP handshake listing the 7 tools.
 *   5. Assert the installed `dist/assets` inventory (7 agents / 17 skills).
 *   6. Source mode: repo-root `index.ts` must remain and re-export
 *      `./src/plugin.js`. OpenCode directory discovery resolves `<dir>/index`
 *      (index.ts) and never reads package main/exports, so source/directory
 *      loading stays on source while package imports use `dist/plugin.js`.
 *
 * One line per check; exit 0 on success, 1 on any failure. Temp dirs
 * (including HOME and the npm cache) are removed in `finally`. POSIX-first,
 * matching the repo's symlink-based smoke checks.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditTarball, sourceInventory } from './lib/pack-contract.mjs';
import { checkInstalled, isolatedEnv, runNpm, seedPrefix } from './lib/pack-install.mjs';
import { readJson, tail } from './lib/pack-utils.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG = '[smoke-pack]';

let failures = 0;

function check(label, ok, detail = '') {
  if (ok) console.log(`  ok — ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL — ${label}${detail ? `: ${detail}` : ''}`);
  }
}

function checkTarball(files, source) {
  const { agentCount, skillCount, missingArtifacts, missingAgents, missingSkills, violations } = auditTarball(
    files,
    source
  );
  console.log(`  tarball: ${files.size} packed files`);
  check(
    'required entrypoints, declarations, README, and skills index',
    missingArtifacts.length === 0,
    missingArtifacts.join(',')
  );
  check(
    `exactly ${source.agents.length} agent files`,
    source.agents.length === 7 && agentCount === 7 && missingAgents.length === 0,
    `${missingAgents.length ? `missing: ${missingAgents.join(',')}` : ''}${agentCount !== 7 ? ` found ${agentCount}` : ''}`
  );
  check(
    `exactly ${source.skills.length} skill SKILL.md files`,
    source.skills.length === 17 && skillCount === 17 && missingSkills.length === 0,
    `${missingSkills.length ? `missing: ${missingSkills.join(',')}` : ''}${skillCount !== 17 ? ` found ${skillCount}` : ''}`
  );
  check('no src, docs, tests, .env, plans, node_modules, or .git', violations.length === 0, violations.join(','));
}

function checkSourceMode() {
  const text = fs.existsSync(path.join(REPO_ROOT, 'index.ts'))
    ? fs.readFileSync(path.join(REPO_ROOT, 'index.ts'), 'utf8')
    : '';
  check('source-mode entry index.ts exists', text.length > 0);
  check(
    "source-mode index.ts re-exports './src/plugin.js'",
    text.includes("export { default } from './src/plugin.js'")
  );
}

async function run(root) {
  const env = isolatedEnv(root);
  const manifest = readJson(path.join(REPO_ROOT, 'package.json'));
  const source = sourceInventory(REPO_ROOT);
  const tarballDir = path.join(root, 'tarball');
  fs.mkdirSync(tarballDir, { recursive: true });

  const packed = runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', tarballDir], env, REPO_ROOT);
  if (packed.status !== 0) {
    check('npm pack --ignore-scripts --json exits 0', false, packed.error?.message ?? tail(packed.stderr));
    return;
  }
  let packList;
  try {
    packList = JSON.parse(packed.stdout);
    check('npm pack --json emits valid JSON on stdout', true);
  } catch {
    check('npm pack --json emits valid JSON on stdout', false, tail(packed.stdout));
    return;
  }
  const packedPackage = packList[0];
  check('npm pack reports one tarball', packList.length === 1 && typeof packedPackage?.filename === 'string');
  if (!Array.isArray(packList) || packList.length !== 1 || typeof packedPackage?.filename !== 'string') return;
  checkTarball(new Set((packedPackage.files ?? []).map((file) => file.path)), source);

  const tarball = path.join(tarballDir, packedPackage.filename);
  const stat = fs.statSync(tarball, { throwIfNoEntry: false });
  check('packed tarball exists and is non-empty', stat?.isFile() === true && stat.size > 0);

  const prefix = path.join(root, 'prefix');
  fs.mkdirSync(prefix, { recursive: true });
  seedPrefix(REPO_ROOT, prefix, manifest.dependencies ?? {});
  fs.writeFileSync(
    path.join(prefix, 'package.json'),
    JSON.stringify({ name: 'dh-smoke-pack', version: '0.0.0', private: true }),
    'utf8'
  );
  const installed = runNpm(
    ['install', '--offline', '--ignore-scripts', '--legacy-peer-deps', '--no-save', '--no-audit', '--no-fund', tarball],
    env,
    prefix
  );
  check(
    'npm install <tarball> --offline exits 0',
    installed.status === 0,
    installed.error?.message ?? tail(installed.stderr)
  );
  if (installed.status !== 0) return;

  await checkInstalled(prefix, manifest, source, env, check);
  checkSourceMode();
}

let rootDir;
try {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dhs-smoke-pack-'));
  await run(rootDir);
} catch (error) {
  check(
    'smoke-pack completed without an unexpected error',
    false,
    error instanceof Error ? error.message : String(error)
  );
} finally {
  if (rootDir !== undefined) {
    try {
      fs.rmSync(rootDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup; never mask the check result
    }
  }
}

if (failures > 0) {
  console.error(`${LOG} FAIL — ${failures} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log(`${LOG} OK — tarball installs, imports as a plugin, and ships complete assets`);
}

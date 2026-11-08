/**
 * install-smoke.mjs — isolated runtime helpers for scripts/smoke-install.mjs.
 *
 * The smoke must prove the BUILT CLI works in a throwaway environment, so this
 * module owns three boundaries: the isolated env/temp root, the child process
 * invocation and single-envelope contract, and read-only inspection helpers
 * (JSON/JSONC plus a snapshot of the developer's real config surface). Nothing
 * here writes outside the temp root.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'jsonc-parser';

export const COMMAND_TIMEOUT_MS = 20_000;

/** Create a canonical temp root (realpath avoids symlinked-tmp surprises). */
export function createRoot() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dhs-smoke-install-')));
}

/** Isolated home/XDG/OpenCode dirs plus the child environment, all under `root`. */
export function createIsolatedEnv(root) {
  const home = path.join(root, 'home');
  const xdg = path.join(root, 'xdg');
  const globalDir = path.join(root, 'global-opencode');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(xdg, { recursive: true });
  const env = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: xdg,
    OPENCODE_CONFIG_DIR: globalDir,
    CI: '1',
    NO_COLOR: '1',
  };
  return { env, home, xdg, globalDir };
}

/** A project directory must exist before `--path` will accept it. */
export function createProject(root, name) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Read JSONC with the CLI's trailing-comma policy; return text for preservation checks. */
export function readJsonc(file) {
  const text = fs.readFileSync(file, 'utf8');
  const errors = [];
  const value = parse(text, errors, { allowTrailingComma: true, disallowComments: false });
  return { text, value, ok: errors.length === 0 };
}

export function tail(text, limit = 500) {
  const value = String(text ?? '').trim();
  return value.length > limit ? `...${value.slice(-limit)}` : value;
}

/** Run the built CLI with stdin closed so a non-TTY prompt can never hang. */
export function runCli(repoRoot, args, cwd, env) {
  return spawnSync(process.execPath, [path.join(repoRoot, 'dist', 'cli.js'), ...args], {
    cwd,
    env,
    encoding: 'utf8',
    timeout: COMMAND_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * Parse the exact `--json` contract: exit 0, one stdout line, one JSON object,
 * matching command, `ok:true`. Anything else returns a printable reason.
 */
export function parseSuccessEnvelope(result, command) {
  if (result.error !== undefined) return { ok: false, reason: result.error.message };
  if (result.signal !== null) return { ok: false, reason: `terminated by ${result.signal}` };
  if (result.status !== 0) return { ok: false, reason: `exit ${result.status}: ${tail(result.stderr)}` };

  const lines = result.stdout.trim().split('\n');
  if (lines.length !== 1) return { ok: false, reason: `stdout has ${lines.length} lines, expected one JSON object` };
  let value;
  try {
    value = JSON.parse(lines[0]);
  } catch {
    return { ok: false, reason: `stdout is not JSON: ${tail(result.stdout)}` };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reason: 'stdout JSON is not an object' };
  }
  if (value.command !== command) return { ok: false, reason: `command ${String(value.command)} != ${command}` };
  if (value.ok !== true) return { ok: false, reason: `envelope ok=${String(value.ok)}: ${tail(result.stderr)}` };
  return { ok: true, value };
}

/** Paths that would receive a global install for the developer's real env. */
function realGlobalDir() {
  const explicit = process.env.OPENCODE_CONFIG_DIR?.trim();
  if (explicit !== undefined && explicit !== '') return path.resolve(explicit);
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  if (xdg !== undefined && xdg !== '') return path.join(path.resolve(xdg), 'opencode');
  return path.join(os.homedir(), '.config', 'opencode');
}

function stamp(file) {
  const stats = fs.lstatSync(file, { throwIfNoEntry: false });
  return stats === undefined ? 'absent' : `${stats.ino}:${stats.size}:${stats.mtimeMs}`;
}

/**
 * Snapshot the real global config surface (dir, configs, managed target) so
 * the smoke can prove the isolated env never leaked into the developer's home.
 */
export function snapshotRealConfig() {
  const dir = realGlobalDir();
  const paths = [
    dir,
    path.join(dir, 'opencode.jsonc'),
    path.join(dir, 'opencode.json'),
    path.join(dir, 'plugins'),
    path.join(dir, 'plugins', 'dev-harness-skills'),
  ];
  return new Map(paths.map((candidate) => [candidate, stamp(candidate)]));
}

/** Paths whose stamp changed since the snapshot (empty means untouched). */
export function changedPaths(snapshot) {
  return [...snapshot].filter(([candidate, expected]) => stamp(candidate) !== expected).map(([candidate]) => candidate);
}

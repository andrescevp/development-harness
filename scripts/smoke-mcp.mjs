#!/usr/bin/env node
/**
 * smoke-mcp.mjs — spawn the built MCP stdio bin and exercise the shipped path.
 *
 * The child's cwd is a fresh, canonicalised temp workspace (DH_WORKSPACE_ROOT
 * forced empty), so `process.cwd()` anchoring is exercised end-to-end. Checks:
 *   - tools/list exposes exactly the 7 harness tools (direct + symlink launch);
 *   - plan_create (updateIndex) returns { ok, path }, writes the file, appends
 *     the index row, and leaves no *.tmp residue;
 *   - plan_read returns the same path with phases/sub-tasks;
 *   - plan_update_status round-trips a sub-task status through a disk re-read;
 *   - the entry launched THROUGH a symlink (npm/npx `.bin` shape) handshakes.
 *
 * Check assertions are collected; thrown spawn/payload errors fail fast. Exit 0
 * on success, 1 on failure. The client is always closed and the temp root
 * removed — no orphan child. SIGINT/SIGTERM close the active client (bounded),
 * clean up, and exit 130/143.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STDIO_ENTRY = path.join(REPO_ROOT, 'dist', 'mcp', 'stdio.js');
const LOG = '[smoke-mcp]';
const REQUEST_TIMEOUT_MS = 5_000;
const EXPECTED_TOOLS = [
  'logged_command',
  'plan_create',
  'plan_read',
  'plan_update_status',
  'read_sheet',
  'sheet_schema',
  'update_sheet',
].sort();

const startedAt = Date.now();
let failures = 0;
/** Single temp root (canonical realpath) holding `workspace/` and `bin/`. */
let rootDir;
/** The client whose child must be closed on interruption. */
let activeClient;

function fail(label, detail = '') {
  failures += 1;
  console.error(`${LOG} FAIL — ${label}${detail ? `: ${detail}` : ''}`);
}

/** One compact line per check; failures are collected and reported at the end. */
function check(label, ok, detail = '') {
  if (ok) console.log(`ok — ${label}`);
  else fail(label, detail);
}

/** Best-effort temp-root removal; never masks the original failure. */
function cleanupRoot() {
  if (rootDir === undefined) return;
  try {
    fs.rmSync(rootDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
  rootDir = undefined;
}

/** Bounded shutdown: close the active client, clean up, then exit. */
function handleSignal(signal, code) {
  const client = activeClient;
  const finish = () => {
    cleanupRoot();
    console.error(`${LOG} interrupted by ${signal}`);
    process.exit(code);
  };
  if (client === undefined) {
    finish();
    return;
  }
  const timer = setTimeout(finish, REQUEST_TIMEOUT_MS);
  client
    .close()
    .catch(() => undefined)
    .finally(() => {
      clearTimeout(timer);
      finish();
    });
}

process.once('SIGINT', () => handleSignal('SIGINT', 130));
process.once('SIGTERM', () => handleSignal('SIGTERM', 143));

/** Decode a tool's single text-content payload. */
function payload(toolName, result) {
  const block = result.content?.[0];
  if (block?.type !== 'text') throw new Error(`${toolName}: expected a text content block`);
  if (result.isError) throw new Error(`${toolName} returned isError: ${block.text}`);
  return JSON.parse(block.text);
}

/** Compare a tools/list result against EXPECTED_TOOLS by sorted name. */
function checkToolList(label, tools) {
  const names = tools.map((tool) => tool.name).sort();
  check(label, names.join(',') === EXPECTED_TOOLS.join(','), names.join(',') || 'no tools');
}

/** Assert no `*.tmp` residue in any of the given directories. */
function checkNoTmpResidue(label, dirs) {
  const residue = dirs.flatMap((dir) =>
    fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.tmp')) : []
  );
  check(label, residue.length === 0, residue.join(','));
}

/** True when `child` (already canonical) lives strictly under `parent`. */
function isUnder(parent, child) {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Run `fn` against a connected client. The child's stderr is captured per
 * invocation; thrown errors print this client's tail before propagating.
 */
async function withClient(label, spawn, workspaceRoot, fn) {
  let stderr = '';
  const transport = new StdioClientTransport({
    ...spawn,
    cwd: workspaceRoot,
    env: { ...getDefaultEnvironment(), DH_WORKSPACE_ROOT: '' },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', (chunk) => {
    stderr = (stderr + String(chunk)).slice(-4000);
  });
  const client = new Client({ name: 'smoke-mcp', version: '0.0.0' });
  activeClient = client;
  try {
    await client.connect(transport, { timeout: REQUEST_TIMEOUT_MS });
    await fn(client);
  } catch (err) {
    const tail = stderr.trim();
    console.error(`${LOG} [${label}] ${err instanceof Error ? err.message : String(err)}`);
    if (tail) console.error(`${LOG} [${label}] child stderr tail:\n${tail}`);
    throw err;
  } finally {
    try {
      await client.close();
    } catch (err) {
      fail(`${label}: client.close() failed`, err instanceof Error ? err.message : String(err));
    }
    activeClient = undefined;
  }
}

async function runChecks(root) {
  const workspace = path.join(root, 'workspace');
  const plansDir = path.join(workspace, 'docs', 'plans');
  const symlinkEntry = path.join(root, 'bin', 'dev-harness-mcp');

  fs.mkdirSync(plansDir, { recursive: true });
  fs.mkdirSync(path.dirname(symlinkEntry), { recursive: true });
  fs.writeFileSync(path.join(plansDir, 'index.md'), '# Plans\n', 'utf8');
  fs.symlinkSync(STDIO_ENTRY, symlinkEntry);
  check('stdio artifact is executable', (fs.statSync(STDIO_ENTRY).mode & 0o111) !== 0);

  await withClient('direct', { command: process.execPath, args: [STDIO_ENTRY] }, workspace, async (client) => {
    const { tools } = await client.listTools(undefined, { timeout: REQUEST_TIMEOUT_MS });
    checkToolList('tools/list exposes the expected harness tools', tools);

    const created = payload(
      'plan_create',
      await client.callTool(
        {
          name: 'plan_create',
          arguments: {
            slug: 'smoke',
            title: 'Smoke Plan',
            objective: 'Prove the shipped MCP stdio path',
            phases: [{ title: 'Phase One', subTasks: [{ title: 'First task' }, { title: 'Second task' }] }],
            updateIndex: true,
          },
        },
        { timeout: REQUEST_TIMEOUT_MS }
      )
    );
    const planPath = created?.path;
    check(
      'plan_create returns { ok, path }',
      created?.ok === true && typeof planPath === 'string' && path.isAbsolute(planPath),
      JSON.stringify(created)
    );
    if (typeof planPath !== 'string')
      throw new Error(`plan_create: payload has no string path: ${JSON.stringify(created)}`);

    check(
      'plan file exists under the temp workspace',
      fs.existsSync(planPath) && isUnder(workspace, fs.realpathSync(planPath)),
      planPath
    );
    checkNoTmpResidue('plan_create leaves no *.tmp residue', [path.dirname(planPath), plansDir]);
    const indexText = fs.readFileSync(path.join(plansDir, 'index.md'), 'utf8');
    check('index row appended', indexText.includes('| Smoke Plan | smoke |'));

    const read = payload(
      'plan_read',
      await client.callTool({ name: 'plan_read', arguments: { slug: 'smoke' } }, { timeout: REQUEST_TIMEOUT_MS })
    );
    check('plan_read returns the same path', read.path === planPath, String(read.path));
    const phase = read.plan?.phases?.[0];
    check(
      'plan_read lists phase/sub-tasks',
      phase?.title === 'Phase One' && phase?.subTasks?.length === 2,
      JSON.stringify(phase?.subTasks?.length)
    );

    const updated = payload(
      'plan_update_status',
      await client.callTool(
        {
          name: 'plan_update_status',
          arguments: { slug: 'smoke', target: 'subtask', index: '1.1', status: 'In Progress' },
        },
        { timeout: REQUEST_TIMEOUT_MS }
      )
    );
    const status = updated.plan?.phases?.[0]?.subTasks?.[0]?.status;
    check('plan_update_status round-trips', status === 'In Progress', String(status));
    checkNoTmpResidue('plan_update_status leaves no *.tmp residue', [path.dirname(planPath), plansDir]);

    const persisted = payload(
      'plan_read',
      await client.callTool({ name: 'plan_read', arguments: { slug: 'smoke' } }, { timeout: REQUEST_TIMEOUT_MS })
    );
    const persistedStatus = persisted.plan?.phases?.[0]?.subTasks?.[0]?.status;
    check('plan_update_status persisted to disk', persistedStatus === 'In Progress', String(persistedStatus));
  });

  // npm/npx `.bin` shape: launch the symlink itself (shebang + exec bit).
  if (process.platform === 'win32') {
    console.log('skip — symlink launch variant (POSIX-only .bin shape)');
  } else {
    await withClient('symlink', { command: symlinkEntry, args: [] }, workspace, async (client) => {
      const { tools } = await client.listTools(undefined, { timeout: REQUEST_TIMEOUT_MS });
      checkToolList('symlink-launched entry lists the expected harness tools', tools);
    });
  }
}

const artifact = fs.statSync(STDIO_ENTRY, { throwIfNoEntry: false });
if (!artifact?.isFile() || artifact.size === 0) {
  console.error(`${LOG} FAIL — missing build artifact: ${STDIO_ENTRY} (run pnpm build)`);
  process.exitCode = 1;
} else {
  try {
    rootDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dhs-smoke-mcp-')));
    await runChecks(rootDir);
  } catch (err) {
    fail(`unexpected failure: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    cleanupRoot();
  }

  if (failures > 0) {
    console.error(`${LOG} FAIL — ${failures} check(s) failed (${Date.now() - startedAt} ms)`);
    process.exitCode = 1;
  } else {
    console.log(`ok — all smoke checks passed (${Date.now() - startedAt} ms)`);
  }
}

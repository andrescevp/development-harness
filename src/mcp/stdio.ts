/**
 * stdio.ts — MCP stdio entry (bin): serves the harness tools over stdio.
 *
 * Per connection: the workspace root resolves at connection time (never at
 * module load) and a fresh server instance comes from the shared factory.
 * Stdout is the protocol channel — diagnostics go to stderr ONLY. Importing
 * this module is side-effect free; the entry runs only as the main module.
 */
import fs from 'node:fs';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { isMainEntry as isMainEntryFor } from '../lib/main-entry.js';
import { buildServer } from './server.js';
import { resolveWorkspaceRoot } from './workspace.js';

// Distinct from the plugin's [dev-harness-skills] tag on purpose: this identifies the standalone MCP bin process in stderr triage.
const LOG_PREFIX = '[dev-harness-mcp]';
const FALLBACK_VERSION = '0.0.0';

/** Short harness context surfaced in the MCP initialize result. */
export const HARNESS_INSTRUCTIONS =
  'Harness for plan-driven development. The tools manage phased plans under ' +
  'docs/plans/<slug>/plan.md of the workspace (a phase cannot be Completed while any ' +
  'sub-task is open), read csv/xlsx and update csv sheets by absolute path, and run ' +
  'shell commands whose output is logged to the system temp dir.';

let cachedVersion: string | undefined;

/** Package version for `McpServer({ version })`; read once, '0.0.0' fallback. */
export function resolveVersion(): string {
  cachedVersion ??= readPackageVersion();
  return cachedVersion;
}

function readPackageVersion(): string {
  try {
    // Resolves to the package root in both layouts: src/mcp/ (source) and
    // dist/mcp/ (npx cache) sit two levels below it.
    const raw = fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
    const version = (JSON.parse(raw) as { version?: unknown }).version;
    return typeof version === 'string' ? version : FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

/**
 * Workspace root at connection time. The blank-cwd error passes through
 * unchanged; any other failure (e.g. a deleted cwd → raw ENOENT) gains
 * entry-level context and a `cause`.
 */
export function resolveRoot(): string {
  try {
    return resolveWorkspaceRoot();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('no workspace root available')) throw err;
    throw new Error(`workspace root unavailable: ${message}`, { cause: err });
  }
}

/**
 * True when `entry` (default `process.argv[1]`) is this module on disk.
 * Realpath-based: npm/npx bin symlinks and relative invocations still match.
 */
export function isMainEntry(entry: string | undefined = process.argv[1]): boolean {
  return isMainEntryFor(import.meta.url, entry);
}

/** Run the stdio entry (invoked only when this module is the process main). */
function main(): void {
  const handle = serveStdio(
    () =>
      buildServer({
        workspaceRoot: resolveRoot(),
        version: resolveVersion(),
        instructions: HARNESS_INSTRUCTIONS,
      }),
    {
      onerror: (error) => {
        if (error.cause === undefined) console.error(`${LOG_PREFIX} transport error: ${error.message}`);
        else console.error(`${LOG_PREFIX} transport error: ${error.message}`, error.cause);
      },
    }
  );
  const shutdown = (signal: NodeJS.Signals): void => {
    handle
      .close()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`${LOG_PREFIX} shutdown after ${signal} failed: ${message}`);
        process.exit(1);
      });
  };
  // Once-only handlers: a second signal restores the default force-quit.
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  console.error(`${LOG_PREFIX} serving on stdio (workspace resolves per connection)`);
}

if (isMainEntry()) main();

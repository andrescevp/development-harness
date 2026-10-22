/**
 * uninstall-mcp.ts — ownership checks and config cleanup for `uninstall`.
 *
 * The managed path trusts only the manifest fingerprint; a missing fingerprint
 * (`--no-mcp`) skips config work. Invalid JSONC aborts before any directory is
 * deleted, a differing entry is preserved unless `force`, and persistence goes
 * through the confined atomic config writer. The corrupt-manifest path never
 * deletes an unowned entry: it requires an explicit `--mcp-package` /
 * `--mcp-source` expectation and removes only an exact match.
 */
import type { CommandOptions } from '../args.js';
import { configScopeRoot, readConfigFile, writeConfigFile } from '../config-file.js';
import { OperationalError } from '../errors.js';
import type { InstallManifest } from '../manifest.js';
import { buildSelectedMcpEntry, type McpEntry, removeMcpEntry } from '../mcp-entry.js';
import type { CommandOutput } from '../output.js';
import { assertPathWithin, type InstallScope } from '../scope.js';

type McpAction = 'skipped' | 'missing' | 'removed' | 'mismatch';

/** Planned `dh` cleanup; `text` is present only when the entry would change. */
export interface McpRemoval {
  readonly action: McpAction;
  readonly changed: boolean;
  readonly text?: string;
  readonly warning?: string;
}

function describeError(error: unknown): string {
  return error instanceof Error && error.message.trim() !== '' ? error.message : String(error);
}

/**
 * Explicit MCP expectation from flags; absent means "no unowned config edits".
 */
function expectedFromOptions(options: CommandOptions): McpEntry | undefined {
  if (options.mcpPackage !== undefined || options.mcpSource !== undefined) return buildSelectedMcpEntry(options);
  return undefined;
}

function isMcpEntry(value: unknown): value is McpEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  const timeout = entry.timeout;
  return (
    entry.type === 'local' &&
    Array.isArray(entry.command) &&
    entry.command.every((part) => typeof part === 'string') &&
    typeof entry.protocol === 'string' &&
    typeof timeout === 'object' &&
    timeout !== null &&
    typeof (timeout as Record<string, unknown>).startup === 'number'
  );
}

/** Parse the manifest-stored canonical entry; `undefined` means MCP was skipped. */
function managedEntry(fingerprint: unknown): McpEntry | undefined {
  if (fingerprint === undefined) return undefined;
  if (typeof fingerprint !== 'string') {
    throw new OperationalError('cannot uninstall: the install manifest config.fingerprint is not a JSON string');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fingerprint);
  } catch (err) {
    throw new OperationalError('cannot uninstall: the install manifest config.fingerprint is not valid JSON', {
      cause: err,
    });
  }
  if (!isMcpEntry(parsed)) {
    throw new OperationalError('cannot uninstall: the install manifest config.fingerprint is not a dh MCP entry');
  }
  return parsed;
}

/**
 * Remove the expected entry in memory. Missing is a no-op; invalid JSONC
 * aborts before the plugin directory is touched. A differing entry is kept
 * unless `force`, in which case `removeMcpEntry` deletes it.
 */
function planRemoval(
  configPath: string,
  expected: McpEntry,
  force: boolean,
  target: string,
  output: CommandOutput
): McpRemoval {
  const current = readConfigFile(configPath);
  if (current.status === 'missing') return { action: 'missing', changed: false };

  const removed = removeMcpEntry(current.text, expected, { force });
  if (!removed.ok) {
    throw new OperationalError(
      `cannot remove the dh MCP entry from ${configPath}: ${removed.error.message} at line ` +
        `${removed.error.line}, column ${removed.error.column}; the plugin was kept at ${target}`
    );
  }
  if (removed.warning !== undefined) output.warn(removed.warning);
  return {
    action: removed.action,
    changed: removed.changed,
    ...(removed.changed ? { text: removed.text } : {}),
    ...(removed.warning === undefined ? {} : { warning: removed.warning }),
  };
}

/** Plan cleanup from the manifest fingerprint; no fingerprint means `--no-mcp`. */
export function planManagedMcp(
  scope: InstallScope,
  manifest: InstallManifest,
  options: CommandOptions,
  output: CommandOutput
): McpRemoval {
  const expected = managedEntry(manifest.config.fingerprint);
  if (expected === undefined) return { action: 'skipped', changed: false };
  assertPathWithin(configScopeRoot(scope), manifest.config.path);
  return planRemoval(manifest.config.path, expected, options.force, scope.targetDir, output);
}

/** Corrupt manifests have no ownership proof, so only exact explicit matches go. */
export function planCorruptMcp(
  configPath: string,
  scope: InstallScope,
  options: CommandOptions,
  output: CommandOutput
): McpRemoval {
  const expected = expectedFromOptions(options);
  if (expected === undefined) return { action: 'skipped', changed: false };
  return planRemoval(configPath, expected, false, scope.targetDir, output);
}

/** One-line ASCII description of the planned config cleanup. */
export function mcpStep(mcp: McpRemoval, configPath: string, dryRun: boolean): string {
  switch (mcp.action) {
    case 'skipped':
      return 'skipped (no managed dh entry)';
    case 'missing':
      return `no dh entry in ${configPath}`;
    case 'mismatch':
      return `${configPath} left unchanged (existing dh entry differs)`;
    case 'removed':
      return dryRun ? `would remove mcp.servers.dh from ${configPath}` : `removed mcp.servers.dh from ${configPath}`;
  }
}

/** Persist the planned removal; a failure keeps the plugin for a safe re-run. */
export function persistRemoval(configPath: string, text: string, scope: InstallScope): void {
  try {
    writeConfigFile(configPath, text, { root: configScopeRoot(scope) });
  } catch (err) {
    throw new OperationalError(
      `the dh MCP entry could not be removed from ${configPath}: ${describeError(err)}; ` +
        `the plugin was kept at ${scope.targetDir}; re-run the uninstall to retry`,
      { cause: err }
    );
  }
}

/**
 * install.ts — orchestrate one idempotent install: scope -> classify -> plan
 * config -> materialize/swap -> wire MCP -> report.
 *
 * The config document is read and merged in memory before any plugin write, so
 * an invalid JSONC file aborts with the target untouched. The verified staging
 * directory is committed atomically; config persistence happens after a
 * successful swap because the plugin must never be left half-installed. A
 * config write failure keeps the installed plugin and asks the user to re-run.
 * Nothing is written in `--dry-run` mode, and `--json` emits exactly one
 * envelope on stdout with diagnostics on stderr.
 */

import type { CommandOptions } from '../args.js';
import { resolveCommandScope, type ScopeResolutionDeps } from '../command-scope.js';
import { configScopeRoot, readConfigFile, resolveConfigFile, writeConfigFile } from '../config-file.js';
import { OperationalError } from '../errors.js';
import { atomicSwap } from '../fs-utils.js';
import { assertInstallable, classifyInstall, type InstallDecision } from '../install-state.js';
import { buildSelectedMcpEntry, mcpEntryFingerprint, mergeMcpEntry } from '../mcp-entry.js';
import { type CommandOutput, createOutput } from '../output.js';
import { buildStagedPlugin } from '../plugin-artifact.js';
import { describeDuplicateLoad, findPluginEntries } from '../plugin-entries.js';
import type { InstallScope } from '../scope.js';
import { resolveCliVersion } from '../version.js';
import { runInstallMcpOnly } from './mcp-only.js';

const NPM_PACKAGE_SPEC = 'dev-harness-skills';
const GITHUB_PACKAGE_SPEC = 'github:andrescevp/development-harness';

/** Minimal writer contract shared with tests and process streams. */
interface InstallWriter {
  write(chunk: string): unknown;
}

/** Injectable dependencies; every value defaults to the running process. */
export interface InstallDeps extends ScopeResolutionDeps {
  readonly version?: string;
  readonly packageRoot?: string;
  readonly stdout?: InstallWriter;
  readonly stderr?: InstallWriter;
}

type McpAction = 'skipped' | 'noop' | 'inserted' | 'updated' | 'conflict';

interface McpPlan {
  readonly configPath: string;
  readonly action: McpAction;
  readonly changed: boolean;
  readonly text?: string;
  readonly fingerprint?: string;
  readonly warning?: string;
  /** `opencode plugin add` specifiers already loading this package; never edited. */
  readonly pluginEntries: readonly string[];
}

interface InstallResult {
  readonly scope: InstallScope;
  readonly action: InstallDecision['action'];
  readonly version: string;
  readonly mcp: McpPlan;
  readonly pluginChanged: boolean;
  readonly mcpChanged: boolean;
  readonly dryRun: boolean;
}

function describeError(error: unknown): string {
  return error instanceof Error && error.message.trim() !== '' ? error.message : String(error);
}

/** Package spec that identifies the install channel in the manifest. */
function resolveSource(options: CommandOptions): string {
  if (options.mcpPackage !== undefined) return options.mcpPackage;
  return options.mcpSource === 'github' ? GITHUB_PACKAGE_SPEC : NPM_PACKAGE_SPEC;
}

/**
 * Read and merge `mcp.servers.dh` in memory. Invalid JSONC throws before any
 * plugin write; a differing entry is preserved with a warning unless force.
 * The same document is scanned for `opencode plugin add` entries (read-only),
 * because two loaders would register the plugin twice.
 */
function planMcp(scope: InstallScope, options: CommandOptions): McpPlan {
  const configPath = resolveConfigFile(scope);
  if (options.noMcp) return { configPath, action: 'skipped', changed: false, pluginEntries: [] };

  const current = readConfigFile(configPath);
  const text = current.status === 'found' ? current.text : '';
  const entry = buildSelectedMcpEntry(options);
  const merged = mergeMcpEntry(text, entry, { force: options.force });
  if (!merged.ok) {
    const { message, line, column } = merged.error;
    throw new OperationalError(
      `cannot update the dh MCP entry in ${configPath}: ${message} at line ${line}, column ${column}`
    );
  }

  return {
    configPath,
    action: merged.action,
    changed: merged.changed,
    text: merged.text,
    fingerprint: mcpEntryFingerprint(entry),
    pluginEntries: findPluginEntries(text),
    ...(merged.warning === undefined ? {} : { warning: merged.warning }),
  };
}

function manifestConfig(plan: McpPlan): { path: string; fingerprint?: unknown } {
  return plan.fingerprint === undefined
    ? { path: plan.configPath }
    : { path: plan.configPath, fingerprint: plan.fingerprint };
}

function dryRunMcpLabel(plan: McpPlan): string {
  switch (plan.action) {
    case 'skipped':
      return 'skipped (--no-mcp)';
    case 'conflict':
      return 'would stay unchanged (conflict)';
    case 'noop':
      return 'no changes';
    case 'inserted':
      return 'would insert mcp.servers.dh';
    case 'updated':
      return 'would update mcp.servers.dh';
  }
}

function report(output: CommandOutput, result: InstallResult): void {
  const { scope, action, version, mcp } = result;
  output.step(`scope: ${scope.scope}`);
  if (action === 'noop') {
    output.step(`target: ${scope.targetDir} is already up to date (v${version})`);
  } else if (result.dryRun) {
    output.step(`target: ${scope.targetDir} (${action})`);
  } else {
    output.step(`target: ${scope.targetDir} installed (v${version}, ${action})`);
  }

  if (result.dryRun) {
    output.step(`config: ${mcp.configPath} (${dryRunMcpLabel(mcp)})`);
    output.step('dry run: no changes written');
    return;
  }
  switch (mcp.action) {
    case 'skipped':
      output.step('mcp: skipped (--no-mcp)');
      return;
    case 'conflict':
      output.step(`mcp: ${mcp.configPath} left unchanged (existing dh entry differs)`);
      return;
    case 'noop':
      output.step(`mcp: ${mcp.configPath} already wired`);
      return;
    default:
      output.step(`mcp: wrote mcp.servers.dh to ${mcp.configPath}`);
  }
}

function payload(result: InstallResult): Record<string, unknown> {
  return {
    scope: result.scope.scope,
    target: result.scope.targetDir,
    config: result.mcp.configPath,
    action: result.action,
    changed: result.pluginChanged || result.mcpChanged,
    version: result.version,
    mcp: {
      action: result.mcp.action,
      changed: result.mcpChanged,
      ...(result.mcp.warning === undefined ? {} : { warning: result.mcp.warning }),
    },
    dryRun: result.dryRun,
  };
}

/**
 * Execute an install. Expected failures are typed (`UsageError` for a missing
 * scope, `PromptCancelledError` on cancel, `OperationalError` otherwise) and
 * mapped to exit codes by the CLI entry.
 */
export async function runInstall(options: CommandOptions, deps: InstallDeps = {}): Promise<void> {
  if (options.mcpOnly) {
    await runInstallMcpOnly(options, deps);
    return;
  }

  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const output = createOutput({ command: 'install', json: options.json, stdout, stderr });

  const scope = await resolveCommandScope(options, deps);
  const version = deps.version ?? resolveCliVersion();
  const state = classifyInstall(scope.targetDir, version);
  const decision = assertInstallable(state, { force: options.force });
  if (decision.warning !== undefined) output.warn(decision.warning);

  const mcp = planMcp(scope, options);
  if (mcp.warning !== undefined) output.warn(mcp.warning);
  if (mcp.pluginEntries.length > 0) output.warn(describeDuplicateLoad(mcp.pluginEntries));

  if (options.dryRun) {
    const result: InstallResult = {
      scope,
      action: decision.action,
      version,
      mcp,
      pluginChanged: decision.action !== 'noop',
      mcpChanged: mcp.changed,
      dryRun: true,
    };
    report(output, result);
    if (output.json) output.emitJson(payload(result));
    return;
  }

  let pluginChanged = false;
  if (decision.action !== 'noop') {
    const staged = await buildStagedPlugin({
      targetDir: scope.targetDir,
      version,
      source: resolveSource(options),
      scope: scope.scope,
      config: manifestConfig(mcp),
      ...(deps.packageRoot === undefined ? {} : { packageRoot: deps.packageRoot }),
    });
    await atomicSwap(staged.stagingDir, scope.targetDir);
    pluginChanged = true;
  }

  let mcpChanged = false;
  if (mcp.changed) {
    if (mcp.text === undefined) throw new OperationalError('internal error: merged config text is missing');
    try {
      mcpChanged = writeConfigFile(mcp.configPath, mcp.text, { root: configScopeRoot(scope) }).changed;
    } catch (err) {
      throw new OperationalError(
        `plugin is installed at ${scope.targetDir}, but the dh MCP entry could not be written to ${mcp.configPath}: ` +
          `${describeError(err)}; re-run the install to retry the config wiring`,
        { cause: err }
      );
    }
  }

  const result: InstallResult = {
    scope,
    action: decision.action,
    version,
    mcp,
    pluginChanged,
    mcpChanged,
    dryRun: false,
  };
  report(output, result);
  if (output.json) output.emitJson(payload(result));
}

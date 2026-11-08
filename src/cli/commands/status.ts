/**
 * status.ts — read-only install reporting: scope -> classify target -> read
 * config -> classify the dh entry -> human or JSON output.
 *
 * Nothing here creates directories, files, manifests, backups, or locks. A
 * managed install (including one with a corrupt manifest) exits 0 so drift is
 * inspectable; absent/unmanaged targets and an invalid or unreadable config
 * exit 1. The JSON envelope is emitted for every outcome so scripts can parse
 * absence and drift, and `--json` never prompts. `version` in the envelope is
 * the running CLI version; `plugin.version` is the installed manifest version.
 */
import type { CommandOptions } from '../args.js';
import { resolveCommandScope, type ScopeResolutionDeps } from '../command-scope.js';
import { readConfigFile, resolveConfigFile } from '../config-file.js';
import { EXIT_FAILURE, EXIT_SUCCESS } from '../errors.js';
import { classifyInstall, describeInstallState, type InstallState } from '../install-state.js';
import {
  buildSelectedMcpEntry,
  describeMcpEntryState,
  type McpEntry,
  type McpEntryState,
  readMcpEntry,
} from '../mcp-entry.js';
import { type CommandOutput, createOutput } from '../output.js';
import { describeDuplicateLoad, findPluginEntries } from '../plugin-entries.js';
import type { InstallScope } from '../scope.js';
import { resolveCliVersion } from '../version.js';

/** Minimal writer contract shared with tests and process streams. */
interface StatusWriter {
  write(chunk: string): unknown;
}

/** Injectable dependencies; every value defaults to the running process. */
export interface StatusDeps extends ScopeResolutionDeps {
  readonly version?: string;
  readonly stdout?: StatusWriter;
  readonly stderr?: StatusWriter;
}

type StatusExitCode = typeof EXIT_SUCCESS | typeof EXIT_FAILURE;

/** Config read failure that is reported instead of thrown; never includes contents. */
type StatusMcpState = McpEntryState | { readonly status: 'unreadable'; readonly reason: string };

interface StatusIssue {
  /** Stable ASCII summary safe for JSON and stderr. */
  readonly message: string;
  /** True when the issue is actionable drift worth a stderr warning. */
  readonly diagnostic: boolean;
}

interface ConfigSnapshot {
  readonly text: string;
  readonly error?: string;
}

function describeError(error: unknown): string {
  return error instanceof Error && error.message.trim() !== '' ? error.message : String(error);
}

/** Read the config without parsing it; a missing file is an empty document. */
function readConfig(configPath: string): ConfigSnapshot {
  try {
    const result = readConfigFile(configPath);
    return { text: result.status === 'found' ? result.text : '' };
  } catch (err) {
    return { text: '', error: describeError(err) };
  }
}

function classifyMcp(config: ConfigSnapshot, expected: McpEntry): StatusMcpState {
  if (config.error !== undefined) return { status: 'unreadable', reason: config.error };
  return readMcpEntry(config.text, expected);
}

/** A valid manifest, corrupt manifest, or the target occupying the install path. */
function isInstalled(state: InstallState): boolean {
  switch (state.status) {
    case 'managed-current':
    case 'managed-older':
    case 'managed-newer':
    case 'corrupt':
      return true;
    case 'absent':
    case 'unmanaged':
      return false;
  }
}

function pluginIssues(state: InstallState): StatusIssue[] {
  switch (state.status) {
    case 'absent':
      return [{ message: 'not installed', diagnostic: false }];
    case 'unmanaged':
      return [{ message: `target is unmanaged: ${state.reason}`, diagnostic: false }];
    case 'corrupt':
      return [{ message: `install manifest is corrupt: ${state.reason}`, diagnostic: true }];
    case 'managed-current':
    case 'managed-older':
    case 'managed-newer': {
      const issues: StatusIssue[] = [];
      if (state.status === 'managed-older') {
        issues.push({
          message: `installed version ${state.manifest.version} is older than CLI version ${state.cliVersion}`,
          diagnostic: true,
        });
      }
      if (state.status === 'managed-newer') {
        issues.push({
          message: `installed version ${state.manifest.version} is newer than CLI version ${state.cliVersion}`,
          diagnostic: true,
        });
      }
      if (state.missingFiles.length > 0) {
        issues.push({ message: `${state.missingFiles.length} managed file(s) missing`, diagnostic: true });
      }
      if (state.extraFiles.length > 0) {
        issues.push({
          message: `${state.extraFiles.length} file(s) not managed by the installer`,
          diagnostic: true,
        });
      }
      return issues;
    }
  }
}

function mcpIssues(state: InstallState, mcp: StatusMcpState): StatusIssue[] {
  switch (mcp.status) {
    case 'invalid':
      return [
        {
          message: `config is not valid JSONC: ${mcp.error.message} at line ${mcp.error.line}, column ${mcp.error.column}`,
          diagnostic: true,
        },
      ];
    case 'unreadable':
      return [{ message: `config is unreadable: ${mcp.reason}`, diagnostic: true }];
    case 'missing':
      return isInstalled(state) ? [{ message: 'dh MCP entry is missing', diagnostic: true }] : [];
    case 'different':
      return isInstalled(state) ? [{ message: 'dh MCP entry differs from the expected entry', diagnostic: true }] : [];
    case 'matching':
      return [];
  }
}

/**
 * Report config `plugins` entries that also load this package. They are always
 * inspectable, but only a managed copy makes them a duplicate-load diagnostic.
 */
function duplicateIssues(state: InstallState, pluginEntries: readonly string[]): StatusIssue[] {
  if (pluginEntries.length === 0) return [];
  return [{ message: describeDuplicateLoad(pluginEntries), diagnostic: isInstalled(state) }];
}

function resolveExitCode(state: InstallState, mcp: StatusMcpState): StatusExitCode {
  // An unreadable/invalid config makes the report incomplete: scripts must not
  // treat it as a healthy install.
  if (mcp.status === 'invalid' || mcp.status === 'unreadable') return EXIT_FAILURE;
  return isInstalled(state) ? EXIT_SUCCESS : EXIT_FAILURE;
}

function describeMcp(state: StatusMcpState): string {
  return state.status === 'unreadable' ? `dh MCP entry: unreadable (${state.reason})` : describeMcpEntryState(state);
}

function reportHuman(
  output: CommandOutput,
  scope: InstallScope,
  state: InstallState,
  configPath: string,
  mcp: StatusMcpState,
  issues: readonly StatusIssue[]
): void {
  output.step(`scope: ${scope.scope}`);
  output.step(`target: ${scope.targetDir}`);
  output.step(`plugin: ${describeInstallState(state)}`);
  output.step(`config: ${configPath}`);
  output.step(describeMcp(mcp));
  for (const issue of issues) {
    if (issue.diagnostic) output.warn(issue.message);
  }
}

function pluginPayload(state: InstallState): Record<string, unknown> {
  switch (state.status) {
    case 'absent':
    case 'unmanaged':
    case 'corrupt':
      return { status: state.status, reason: state.reason };
    case 'managed-current':
    case 'managed-older':
    case 'managed-newer':
      return {
        status: state.status,
        version: state.manifest.version,
        missingFiles: [...state.missingFiles],
        extraFiles: [...state.extraFiles],
      };
  }
}

function payload(
  scope: InstallScope,
  state: InstallState,
  cliVersion: string,
  configPath: string,
  mcp: StatusMcpState,
  pluginEntries: readonly string[],
  issues: readonly StatusIssue[]
): Record<string, unknown> {
  return {
    scope: scope.scope,
    target: scope.targetDir,
    installed: isInstalled(state),
    version: cliVersion,
    state: state.status,
    plugin: pluginPayload(state),
    config: configPath,
    mcp: { status: mcp.status, matching: mcp.status === 'matching' },
    duplicateLoad: isInstalled(state) && pluginEntries.length > 0,
    pluginEntries: [...pluginEntries],
    issues: issues.map((issue) => issue.message),
  };
}

/**
 * Report the install state without writing anything. Expected failures are
 * typed (`UsageError` for a missing scope, `PromptCancelledError` on cancel)
 * and mapped to exit codes by the CLI entry; drift and absence are results,
 * not thrown errors, so `--json` always emits one envelope.
 */
export async function runStatus(options: CommandOptions, deps: StatusDeps = {}): Promise<StatusExitCode> {
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const output = createOutput({ command: 'status', json: options.json, stdout, stderr });

  const scope = await resolveCommandScope(options, deps);
  const version = deps.version ?? resolveCliVersion();
  const state = classifyInstall(scope.targetDir, version);
  const configPath = resolveConfigFile(scope);
  const config = readConfig(configPath);
  const mcp = classifyMcp(config, buildSelectedMcpEntry(options));
  const pluginEntries = config.error === undefined ? findPluginEntries(config.text) : [];
  const issues = [...pluginIssues(state), ...mcpIssues(state, mcp), ...duplicateIssues(state, pluginEntries)];
  const exitCode = resolveExitCode(state, mcp);

  reportHuman(output, scope, state, configPath, mcp, issues);
  if (output.json) {
    output.emitJson(payload(scope, state, version, configPath, mcp, pluginEntries, issues), {
      ok: exitCode === EXIT_SUCCESS,
    });
  }
  return exitCode;
}

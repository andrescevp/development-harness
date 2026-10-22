/**
 * mcp-only.ts — config-only install/uninstall for `opencode plugin add` users.
 *
 * These paths wire or remove `mcp.servers.dh` without classifying, staging,
 * replacing, or deleting the plugin directory and without writing a manifest.
 * Both resolve the scope exactly like the full commands, read JSONC before
 * writing, plan everything in `--dry-run`, keep the `--force` conflict rules,
 * and emit one JSON envelope. Config writes go through the confined atomic
 * writer, so an existing file is backed up before its first change.
 */
import type { CommandOptions } from '../args.js';
import { resolveCommandScope, type ScopeResolutionDeps } from '../command-scope.js';
import { configScopeRoot, readConfigFile, resolveConfigFile, writeConfigFile } from '../config-file.js';
import { OperationalError } from '../errors.js';
import { buildSelectedMcpEntry, mergeMcpEntry, removeMcpEntry } from '../mcp-entry.js';
import { type CommandOutput, createOutput } from '../output.js';
import type { InstallScope } from '../scope.js';

/** Minimal writer contract shared with tests and process streams. */
interface McpOnlyWriter {
  write(chunk: string): unknown;
}

/** Injectable dependencies; every value defaults to the running process. */
export interface McpOnlyDeps extends ScopeResolutionDeps {
  readonly stdout?: McpOnlyWriter;
  readonly stderr?: McpOnlyWriter;
}

type InstallAction = 'inserted' | 'updated' | 'noop' | 'conflict';
type RemoveAction = 'removed' | 'missing' | 'mismatch';

interface ConfigPlan<Action extends string> {
  readonly configPath: string;
  readonly action: Action;
  readonly changed: boolean;
  readonly text?: string;
  readonly warning?: string;
}

type InstallPlan = ConfigPlan<InstallAction>;
type RemovePlan = ConfigPlan<RemoveAction>;

function describeError(error: unknown): string {
  return error instanceof Error && error.message.trim() !== '' ? error.message : String(error);
}

/** Read the selected config; a missing file is an empty document. */
function currentText(configPath: string): string {
  const current = readConfigFile(configPath);
  return current.status === 'found' ? current.text : '';
}

/** Merge `mcp.servers.dh` in memory; invalid JSONC aborts before any write. */
function planInstall(scope: InstallScope, options: CommandOptions): InstallPlan {
  const configPath = resolveConfigFile(scope);
  const merged = mergeMcpEntry(currentText(configPath), buildSelectedMcpEntry(options), { force: options.force });
  if (!merged.ok) {
    throw new OperationalError(
      `cannot update the dh MCP entry in ${configPath}: ${merged.error.message} at line ${merged.error.line}, ` +
        `column ${merged.error.column}`
    );
  }
  return {
    configPath,
    action: merged.action,
    changed: merged.changed,
    text: merged.text,
    ...(merged.warning === undefined ? {} : { warning: merged.warning }),
  };
}

/** Plan removal of the expected entry; a missing config is a no-op. */
function planRemove(scope: InstallScope, options: CommandOptions): RemovePlan {
  const configPath = resolveConfigFile(scope);
  const current = readConfigFile(configPath);
  if (current.status === 'missing') return { configPath, action: 'missing', changed: false };

  const removed = removeMcpEntry(current.text, buildSelectedMcpEntry(options), { force: options.force });
  if (!removed.ok) {
    throw new OperationalError(
      `cannot remove the dh MCP entry from ${configPath}: ${removed.error.message} at line ${removed.error.line}, ` +
        `column ${removed.error.column}`
    );
  }
  return {
    configPath,
    action: removed.action,
    changed: removed.changed,
    text: removed.text,
    warning: removed.warning,
  };
}

/** Persist planned text inside the scope root; failures are actionable and retryable. */
function persist(configPath: string, text: string, scope: InstallScope, action: string): boolean {
  try {
    return writeConfigFile(configPath, text, { root: configScopeRoot(scope) }).changed;
  } catch (err) {
    throw new OperationalError(
      `the dh MCP entry could not be ${action} ${configPath}: ${describeError(err)}; re-run the command to retry`,
      { cause: err }
    );
  }
}

function installStep(plan: InstallPlan, dryRun: boolean): string {
  switch (plan.action) {
    case 'inserted':
      return dryRun
        ? `would insert mcp.servers.dh in ${plan.configPath}`
        : `wrote mcp.servers.dh to ${plan.configPath}`;
    case 'updated':
      return dryRun
        ? `would update mcp.servers.dh in ${plan.configPath}`
        : `wrote mcp.servers.dh to ${plan.configPath}`;
    case 'noop':
      return `${plan.configPath} already wired`;
    case 'conflict':
      return `${plan.configPath} left unchanged (existing dh entry differs)`;
  }
}

function removeStep(plan: RemovePlan, dryRun: boolean): string {
  switch (plan.action) {
    case 'missing':
      return `no dh entry in ${plan.configPath}`;
    case 'mismatch':
      return `${plan.configPath} left unchanged (existing dh entry differs)`;
    case 'removed':
      return dryRun
        ? `would remove mcp.servers.dh from ${plan.configPath}`
        : `removed mcp.servers.dh from ${plan.configPath}`;
  }
}

function sharedPayload(
  scope: InstallScope,
  plan: InstallPlan | RemovePlan,
  changed: boolean,
  dryRun: boolean,
  warning: string | undefined
): Record<string, unknown> {
  return {
    scope: scope.scope,
    target: scope.targetDir,
    config: plan.configPath,
    action: 'mcp-only',
    changed,
    mcp: {
      action: plan.action,
      changed,
      ...(warning === undefined ? {} : { warning }),
    },
    dryRun,
  };
}

function reportInstall(output: CommandOutput, scope: InstallScope, plan: InstallPlan, dryRun: boolean): void {
  output.step(`scope: ${scope.scope}`);
  output.step(`config: ${plan.configPath} (mcp-only)`);
  output.step(`mcp: ${installStep(plan, dryRun)}`);
  output.step('plugin: untouched (--mcp-only)');
  if (dryRun) output.step('dry run: no changes written');
}

function reportRemove(output: CommandOutput, scope: InstallScope, plan: RemovePlan, dryRun: boolean): void {
  output.step(`scope: ${scope.scope}`);
  output.step(`config: ${plan.configPath} (mcp-only)`);
  output.step(`mcp: ${removeStep(plan, dryRun)}`);
  output.step('plugin: untouched (--mcp-only)');
  if (dryRun) output.step('dry run: no changes written');
}

/**
 * Warn about a planned conflict, then persist a changed plan unless this is a
 * dry run. Returns whether the config changed (planned or actual).
 */
function applyPlan(
  output: CommandOutput,
  scope: InstallScope,
  plan: ConfigPlan<string>,
  dryRun: boolean,
  persistAction: string,
  missingText: string
): boolean {
  if (plan.warning !== undefined) output.warn(plan.warning);
  if (dryRun || !plan.changed) return plan.changed;
  if (plan.text === undefined) throw new OperationalError(`internal error: ${missingText}`);
  return persist(plan.configPath, plan.text, scope, persistAction);
}

/**
 * Execute `install --mcp-only`. Expected failures are typed (`UsageError` for a
 * missing scope, `PromptCancelledError` on cancel, `OperationalError` otherwise)
 * and mapped to exit codes by the CLI entry.
 */
export async function runInstallMcpOnly(options: CommandOptions, deps: McpOnlyDeps = {}): Promise<void> {
  const output = createOutput({
    command: 'install',
    json: options.json,
    stdout: deps.stdout ?? process.stdout,
    stderr: deps.stderr ?? process.stderr,
  });

  const scope = await resolveCommandScope(options, deps);
  const plan = planInstall(scope, options);
  const changed = applyPlan(output, scope, plan, options.dryRun, 'written to', 'merged config text is missing');

  reportInstall(output, scope, plan, options.dryRun);
  if (output.json) output.emitJson(sharedPayload(scope, plan, changed, options.dryRun, plan.warning));
}

/**
 * Execute `uninstall --mcp-only`. The plugin directory and manifest are never
 * inspected, so an installer-managed copy survives this command untouched.
 */
export async function runUninstallMcpOnly(options: CommandOptions, deps: McpOnlyDeps = {}): Promise<void> {
  const output = createOutput({
    command: 'uninstall',
    json: options.json,
    stdout: deps.stdout ?? process.stdout,
    stderr: deps.stderr ?? process.stderr,
  });

  const scope = await resolveCommandScope(options, deps);
  const plan = planRemove(scope, options);
  const changed = applyPlan(output, scope, plan, options.dryRun, 'removed from', 'pruned config text is missing');

  reportRemove(output, scope, plan, options.dryRun);
  if (output.json) output.emitJson(sharedPayload(scope, plan, changed, options.dryRun, plan.warning));
}

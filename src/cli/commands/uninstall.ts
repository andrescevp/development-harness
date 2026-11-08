/**
 * uninstall.ts — ownership-safe uninstall: scope -> classify -> plan config
 * removal -> persist config -> remove the plugin directory -> report.
 *
 * Only a valid install manifest proves ownership. Absent targets are a no-op;
 * unmanaged/symlinked targets are refused even with `--force` because they
 * were never installer-owned. A corrupt manifest may be force-removed, but its
 * config entry is touched only when an explicit `--mcp-package`/`--mcp-source`
 * entry exactly matches. For managed installs the manifest fingerprint is the
 * source of truth: a differing entry is preserved with a warning unless
 * `--force`, and a missing fingerprint (`--no-mcp`) skips config work.
 *
 * Config cleanup always runs before the directory is deleted, so a config
 * write failure keeps the plugin and a re-run can finish the job. Nothing is
 * written in `--dry-run` mode; `--json` emits exactly one envelope.
 */
import type { CommandOptions } from '../args.js';
import { resolveCommandScope, type ScopeResolutionDeps } from '../command-scope.js';
import { resolveConfigFile } from '../config-file.js';
import { OperationalError } from '../errors.js';
import { removePath } from '../fs-utils.js';
import { classifyInstall, type InstallState } from '../install-state.js';
import { type CommandOutput, createOutput } from '../output.js';
import type { InstallScope } from '../scope.js';
import { resolveCliVersion } from '../version.js';
import { runUninstallMcpOnly } from './mcp-only.js';
import { type McpRemoval, mcpStep, persistRemoval, planCorruptMcp, planManagedMcp } from './uninstall-mcp.js';

/** Minimal writer contract shared with tests and process streams. */
interface UninstallWriter {
  write(chunk: string): unknown;
}

/** Injectable dependencies; every value defaults to the running process. */
export interface UninstallDeps extends ScopeResolutionDeps {
  readonly version?: string;
  readonly stdout?: UninstallWriter;
  readonly stderr?: UninstallWriter;
}

type UninstallAction = 'removed' | 'nothing' | 'refused' | 'dry-run';

interface UninstallResult {
  readonly scope: InstallScope;
  readonly action: Exclude<UninstallAction, 'refused'>;
  readonly configPath: string;
  readonly mcp: McpRemoval;
  readonly changed: boolean;
  readonly dryRun: boolean;
}

function describeError(error: unknown): string {
  return error instanceof Error && error.message.trim() !== '' ? error.message : String(error);
}

function report(output: CommandOutput, result: UninstallResult): void {
  output.step(`scope: ${result.scope.scope}`);
  if (result.action === 'nothing') {
    output.step(`target: ${result.scope.targetDir} (nothing to do: not installed)`);
  } else if (result.dryRun) {
    output.step(`target: would remove ${result.scope.targetDir}`);
  } else {
    output.step(`target: removed ${result.scope.targetDir}`);
  }
  output.step(`mcp: ${mcpStep(result.mcp, result.configPath, result.dryRun)}`);
  if (result.dryRun) output.step('dry run: no changes written');
}

function payload(result: UninstallResult): Record<string, unknown> {
  return {
    scope: result.scope.scope,
    target: result.scope.targetDir,
    action: result.action,
    changed: result.changed,
    config: result.configPath,
    mcp: {
      action: result.mcp.action,
      changed: result.mcp.changed,
      ...(result.mcp.warning === undefined ? {} : { warning: result.mcp.warning }),
    },
    dryRun: result.dryRun,
  };
}

function emit(output: CommandOutput, result: UninstallResult): void {
  report(output, result);
  if (output.json) output.emitJson(payload(result));
}

/**
 * Refuse an uninstall that cannot be proven safe. In JSON mode the refusal is
 * still reported as the command's single envelope; the thrown error drives the
 * exit code and the stderr diagnostic.
 */
function refuse(output: CommandOutput, options: CommandOptions, scope: InstallScope, message: string): never {
  if (output.json) {
    output.emitJson(
      {
        scope: scope.scope,
        target: scope.targetDir,
        action: 'refused',
        changed: false,
        config: resolveConfigFile(scope),
        mcp: { action: 'skipped', changed: false },
        dryRun: options.dryRun,
      },
      { ok: false }
    );
  }
  throw new OperationalError(message);
}

async function removeTarget(scope: InstallScope): Promise<void> {
  try {
    await removePath(scope.targetDir);
  } catch (err) {
    throw new OperationalError(
      `the plugin directory could not be removed: ${scope.targetDir}: ${describeError(err)}; ` +
        're-run the uninstall to retry',
      { cause: err }
    );
  }
}

/** Shared completion path: config first, then the plugin directory. */
async function complete(
  output: CommandOutput,
  scope: InstallScope,
  configPath: string,
  mcp: McpRemoval,
  dryRun: boolean
): Promise<void> {
  if (!dryRun) {
    if (mcp.text !== undefined) persistRemoval(configPath, mcp.text, scope);
    await removeTarget(scope);
  }
  emit(output, {
    scope,
    action: dryRun ? 'dry-run' : 'removed',
    configPath,
    mcp,
    changed: true,
    dryRun,
  });
}

/**
 * Remove installer-owned artifacts. Expected failures are typed (`UsageError`
 * for a missing scope, `PromptCancelledError` on cancel, `OperationalError`
 * otherwise) and mapped to exit codes by the CLI entry.
 */
export async function runUninstall(options: CommandOptions, deps: UninstallDeps = {}): Promise<void> {
  if (options.mcpOnly) {
    await runUninstallMcpOnly(options, deps);
    return;
  }

  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const output = createOutput({ command: 'uninstall', json: options.json, stdout, stderr });

  const scope = await resolveCommandScope(options, deps);
  const version = deps.version ?? resolveCliVersion();
  const state: InstallState = classifyInstall(scope.targetDir, version);

  switch (state.status) {
    case 'absent':
      emit(output, {
        scope,
        action: 'nothing',
        configPath: resolveConfigFile(scope),
        mcp: { action: 'skipped', changed: false },
        changed: false,
        dryRun: options.dryRun,
      });
      return;
    case 'unmanaged':
      return refuse(
        output,
        options,
        scope,
        `refusing to uninstall ${state.target}: ${state.reason}; remove it manually if it is not an ` +
          'installer-managed installation (--force does not apply to unowned targets)'
      );
    case 'corrupt': {
      if (!options.force) {
        refuse(
          output,
          options,
          scope,
          `refusing to uninstall ${state.target}: the install manifest is corrupt (${state.reason}); ` +
            're-run with --force to remove it'
        );
      }
      const configPath = resolveConfigFile(scope);
      await complete(output, scope, configPath, planCorruptMcp(configPath, scope, options, output), options.dryRun);
      return;
    }
    case 'managed-current':
    case 'managed-older':
    case 'managed-newer':
      await complete(
        output,
        scope,
        state.manifest.config.path,
        planManagedMcp(scope, state.manifest, options, output),
        options.dryRun
      );
  }
}

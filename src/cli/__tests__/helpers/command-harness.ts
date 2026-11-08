/**
 * command-harness.ts — shared install/uninstall invocations for command tests.
 *
 * Keeps the JSON-mode and reset boilerplate in one place so tests stay focused
 * on behavior. Every helper delegates to the harness temp dirs; nothing here
 * touches the real HOME or the network.
 */
import { expect } from 'vitest';
import type { CommandOptions } from '../../args.js';
import { runInstall } from '../../commands/install.js';
import { runUninstall, type UninstallDeps } from '../../commands/uninstall.js';
import { globalConfig, globalTarget, type InstallHarness } from './install-harness.js';

export const install = (h: InstallHarness, options: Partial<CommandOptions> = {}) =>
  runInstall(h.options(options), h.deps());

export const uninstall = (
  h: InstallHarness,
  options: Partial<CommandOptions> = {},
  deps: Partial<UninstallDeps> = {}
) => runUninstall(h.options(options), h.deps(deps));

export function reset(h: InstallHarness): void {
  h.stdout.text = '';
  h.stderr.text = '';
}

/** Run uninstall in JSON mode and parse its single stdout envelope. */
export async function uninstallJson(
  h: InstallHarness,
  options: Partial<CommandOptions> = {}
): Promise<Record<string, unknown>> {
  reset(h);
  await uninstall(h, { ...options, json: true });
  return JSON.parse(h.stdout.text) as Record<string, unknown>;
}

/** JSON-mode mcp-only removal asserting the successful removal shape. */
export async function mcpOnlyRemoval(
  h: InstallHarness,
  options: Partial<CommandOptions> = {}
): Promise<Record<string, unknown>> {
  const body = await uninstallJson(h, { ...options, mcpOnly: true });
  expect(body).toMatchObject({ action: 'mcp-only', mcp: { action: 'removed', changed: true } });
  return body;
}

/** Expected global uninstall envelope; keeps JSON contract assertions uniform. */
export function globalUninstallEnvelope(
  h: InstallHarness,
  action: string,
  mcpAction: string,
  changed: boolean,
  dryRun: boolean
): Record<string, unknown> {
  return {
    ok: true,
    command: 'uninstall',
    scope: 'global',
    target: globalTarget(h),
    action,
    changed,
    config: globalConfig(h),
    mcp: { action: mcpAction, changed },
    dryRun,
  };
}

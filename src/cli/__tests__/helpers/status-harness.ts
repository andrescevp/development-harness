/**
 * status-harness.ts — shared helpers for status-command tests (4.2).
 *
 * Thin wrappers around the install fixture keep status cases focused on
 * reporting. `snapshot` records relative paths with mtimes and file contents so
 * the read-only guarantee can be asserted byte-for-byte.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { CommandOptions } from '../../args.js';
import { runInstall } from '../../commands/install.js';
import { runStatus, type StatusDeps } from '../../commands/status.js';
import { MANIFEST_FILE_NAME } from '../../manifest.js';
import type { InstallHarness } from './install-harness.js';

type Json = Record<string, unknown>;

const parse = (text: string): Json => JSON.parse(text) as Json;

export const install = (h: InstallHarness, options: Partial<CommandOptions> = {}) =>
  runInstall(h.options(options), h.deps());

export const status = (h: InstallHarness, options: Partial<CommandOptions> = {}, deps: Partial<StatusDeps> = {}) =>
  runStatus(h.options(options), h.deps(deps));

export interface StatusJsonResult {
  readonly code: Awaited<ReturnType<typeof runStatus>>;
  readonly body: Json;
}

/** Run status in JSON mode and parse the single stdout envelope. */
export async function statusJson(
  h: InstallHarness,
  options: Partial<CommandOptions> = {},
  deps: Partial<StatusDeps> = {}
): Promise<StatusJsonResult> {
  const code = await status(h, { ...options, json: true }, deps);
  return { code, body: parse(h.stdout.text) };
}

export const manifestFile = (target: string): string => path.join(target, MANIFEST_FILE_NAME);

export function reset(h: InstallHarness): void {
  h.stdout.text = '';
  h.stderr.text = '';
}

/** Recursive path -> mtime + content snapshot used to prove status is read-only. */
export function snapshot(directory: string, prefix = ''): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    const full = path.join(directory, entry.name);
    const stats = fs.lstatSync(full);
    entries[relative] = entry.isDirectory()
      ? `dir:${stats.mtimeMs}`
      : `file:${stats.mtimeMs}:${fs.readFileSync(full).toString('base64')}`;
    if (entry.isDirectory()) Object.assign(entries, snapshot(full, relative));
  }
  return entries;
}

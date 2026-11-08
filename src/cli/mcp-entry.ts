/**
 * mcp-entry.ts — canonical `dh` MCP entry ownership rules.
 *
 * `buildMcpEntry` produces the source-parameterized entry (npm by default).
 * Read/merge/remove work on plain config text through the JSONC helpers:
 * matching is deep equality independent of key order, a differing entry is
 * never overwritten or removed unless `force` is set, and removal prunes only
 * the containers it emptied. Functions are pure; callers own file selection,
 * backups, and writes.
 */
import { OperationalError } from './errors.js';
import {
  deepEqualJson,
  getAtPath,
  type JsoncParseResult,
  MCP_ENTRY_PATH,
  pruneEmptyObjects,
  removeAtPath,
  setAtPath,
} from './jsonc.js';
import { MCP_CONFIG_KEY } from './scope.js';

/** Package channel used by the `dh` MCP command. */
type McpSource = 'npm' | 'github';

/** Package specs injected into `npx --package=<spec>`. */
const MCP_PACKAGE_SPECS: Readonly<Record<McpSource, string>> = {
  npm: 'dev-harness-skills',
  github: 'github:andrescevp/development-harness',
};
/** Executable exposed by this package's `bin` map. */
const MCP_BIN_NAME = 'dev-harness-mcp';
/** Protocol version requested from OpenCode. */
const MCP_PROTOCOL_VERSION = '2026-07-28';
/** Cold `npx` startup allowance, in milliseconds. */
const MCP_STARTUP_TIMEOUT_MS = 300_000;

/** Canonical `mcp.servers.dh` value. */
export interface McpEntry {
  readonly type: 'local';
  readonly command: readonly string[];
  readonly protocol: typeof MCP_PROTOCOL_VERSION;
  readonly timeout: { readonly startup: typeof MCP_STARTUP_TIMEOUT_MS };
}

/** Inputs for {@link buildMcpEntry}; set `source` or `packageSpec`, never both. */
export interface BuildMcpEntryOptions {
  readonly source?: McpSource;
  readonly packageSpec?: string;
}

/** Parse-error shape shared with the JSONC helpers. */
export type McpEntryParseError = Extract<JsoncParseResult, { readonly ok: false }>['error'];

/** Current state of `mcp.servers.dh` relative to an expected canonical entry. */
export type McpEntryState =
  | { readonly status: 'missing' }
  | { readonly status: 'matching'; readonly entry: unknown }
  | { readonly status: 'different'; readonly entry: unknown }
  | { readonly status: 'invalid'; readonly error: McpEntryParseError };

/** Shared force semantics for merge and remove. */
export interface McpMutationOptions {
  readonly force?: boolean;
}

type MergeMcpAction = 'inserted' | 'noop' | 'conflict' | 'updated';

/** Typed merge outcome; `warning` is safe to print on stderr. */
export type MergeMcpEntryResult =
  | {
      readonly ok: true;
      readonly text: string;
      readonly changed: boolean;
      readonly action: MergeMcpAction;
      readonly warning?: string;
    }
  | { readonly ok: false; readonly error: McpEntryParseError };

type RemoveMcpAction = 'removed' | 'missing' | 'mismatch';

/** Typed remove outcome; `warning` is safe to print on stderr. */
export type RemoveMcpEntryResult =
  | {
      readonly ok: true;
      readonly text: string;
      readonly changed: boolean;
      readonly action: RemoveMcpAction;
      readonly warning?: string;
    }
  | { readonly ok: false; readonly error: McpEntryParseError };

/** Parents pruned after removal; `pruneEmptyObjects` orders them deepest-first. */
const PRUNE_PATHS: readonly (readonly string[])[] = [MCP_ENTRY_PATH.slice(0, -1), MCP_ENTRY_PATH.slice(0, -2)];
const CONFLICT_WARNING = `${MCP_CONFIG_KEY} already exists with a different value; left unchanged (use --force to replace it)`;
const MISMATCH_WARNING = `${MCP_CONFIG_KEY} does not match the managed entry; left unchanged (use --force to remove it)`;

function resolvePackageSpec(options: BuildMcpEntryOptions): string {
  const { source, packageSpec } = options;
  if (source !== undefined && packageSpec !== undefined) {
    throw new OperationalError('cannot build the dh MCP entry: pass either source or packageSpec, not both');
  }
  if (packageSpec !== undefined) {
    const spec = packageSpec.trim();
    if (spec === '') throw new OperationalError('cannot build the dh MCP entry: packageSpec must not be blank');
    return spec;
  }
  if (source !== undefined && source !== 'npm' && source !== 'github') {
    throw new OperationalError(`cannot build the dh MCP entry: unknown source ${JSON.stringify(source)}`);
  }
  return MCP_PACKAGE_SPECS[source ?? 'npm'];
}

/** Build the canonical entry; defaults to the npm package spec. */
export function buildMcpEntry(options: BuildMcpEntryOptions = {}): McpEntry {
  const spec = resolvePackageSpec(options);
  return {
    type: 'local',
    command: ['npx', '-y', `--package=${spec}`, MCP_BIN_NAME],
    protocol: MCP_PROTOCOL_VERSION,
    timeout: { startup: MCP_STARTUP_TIMEOUT_MS },
  };
}

/** CLI channel flags; `--mcp-package` wins over `--mcp-source` (already exclusive in args). */
export interface McpChannelSelection {
  readonly mcpPackage?: string;
  readonly mcpSource?: 'npm' | 'github';
}

/** Build the entry for the selected channel; npm is the default. */
export function buildSelectedMcpEntry(selection: McpChannelSelection = {}): McpEntry {
  return selection.mcpPackage === undefined
    ? buildMcpEntry({ source: selection.mcpSource ?? 'npm' })
    : buildMcpEntry({ packageSpec: selection.mcpPackage });
}

/**
 * Classify `mcp.servers.dh` against `expected` (npm by default). Comparison is
 * deep equality, so key order and formatting never matter, while an added
 * environment or a changed timeout/command is `different`.
 */
export function readMcpEntry(text: string, expected: McpEntry = buildMcpEntry()): McpEntryState {
  const result = getAtPath(text, MCP_ENTRY_PATH);
  if (!result.ok) return { status: 'invalid', error: result.error };
  if (result.value === undefined) return { status: 'missing' };
  return deepEqualJson(result.value, expected)
    ? { status: 'matching', entry: result.value }
    : { status: 'different', entry: result.value };
}

/**
 * Insert or replace `mcp.servers.dh`. A missing entry is inserted, an equal
 * entry is a byte-identical no-op, and a different entry is preserved with a
 * `conflict` result unless `force` is set. Edits go through `setAtPath`, so
 * comments, indentation, EOL, and trailing commas survive; nothing is pruned.
 * A structurally unusable document (for example `mcp` is a string) throws
 * `OperationalError` instead of guessing.
 */
export function mergeMcpEntry(text: string, entry: McpEntry, options: McpMutationOptions = {}): MergeMcpEntryResult {
  const state = readMcpEntry(text, entry);
  if (state.status === 'invalid') return { ok: false, error: state.error };
  if (state.status === 'matching') return { ok: true, text, changed: false, action: 'noop' };
  if (state.status === 'different' && options.force !== true) {
    return { ok: true, text, changed: false, action: 'conflict', warning: CONFLICT_WARNING };
  }

  const edited = setAtPath(text, MCP_ENTRY_PATH, entry);
  if (!edited.ok) return { ok: false, error: edited.error };
  return {
    ok: true,
    text: edited.text,
    changed: edited.changed,
    action: state.status === 'missing' ? 'inserted' : 'updated',
  };
}

/**
 * Remove `mcp.servers.dh` only when it deep-equals `expectedEntry` (or `force`
 * is set), then prune `mcp.servers` and `mcp` only if this removal emptied
 * them. Missing and mismatched entries leave the text byte-identical.
 */
export function removeMcpEntry(
  text: string,
  expectedEntry: McpEntry,
  options: McpMutationOptions = {}
): RemoveMcpEntryResult {
  const state = readMcpEntry(text, expectedEntry);
  if (state.status === 'invalid') return { ok: false, error: state.error };
  if (state.status === 'missing') return { ok: true, text, changed: false, action: 'missing' };
  if (state.status === 'different' && options.force !== true) {
    return { ok: true, text, changed: false, action: 'mismatch', warning: MISMATCH_WARNING };
  }

  const removed = removeAtPath(text, MCP_ENTRY_PATH);
  if (!removed.ok) return { ok: false, error: removed.error };
  const pruned = pruneEmptyObjects(removed.text, PRUNE_PATHS);
  if (!pruned.ok) return { ok: false, error: pruned.error };
  return { ok: true, text: pruned.text, changed: pruned.text !== text, action: 'removed' };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object' && value !== null) {
    const source = value as Record<string, unknown>;
    const ordered: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) ordered[key] = canonicalize(source[key]);
    return ordered;
  }
  return value;
}

/**
 * Stable canonical JSON of an entry (recursively sorted keys, compact) for
 * manifest storage. Deep-equal entries always fingerprint identically.
 */
export function mcpEntryFingerprint(entry: unknown): string {
  const serialized = JSON.stringify(canonicalize(entry));
  if (serialized === undefined) {
    throw new OperationalError('cannot fingerprint the dh MCP entry: value is not JSON-serializable');
  }
  return serialized;
}

/** One-line ASCII status for human output; never includes the entry contents. */
export function describeMcpEntryState(state: McpEntryState): string {
  switch (state.status) {
    case 'missing':
      return 'dh MCP entry: missing';
    case 'matching':
      return 'dh MCP entry: matching';
    case 'different':
      return 'dh MCP entry: different';
    case 'invalid':
      return `dh MCP entry: invalid JSONC (${state.error.message} at line ${state.error.line}, column ${state.error.column})`;
  }
}

/**
 * mcp-entry.test.ts — canonical dh MCP entry rules (sub-task 3.3).
 *
 * Pure text tests: build the source-parameterized entry, classify the current
 * `mcp.servers.dh` value, merge with conflict/force semantics, remove with an
 * exact-match guard and empty-container pruning, and fingerprint the entry for
 * the manifest. No filesystem, HOME, env, or network access.
 */
import { describe, expect, it } from 'vitest';
import { OperationalError } from '../errors.js';
import { deepEqualJson, getAtPath, MCP_ENTRY_PATH, parseJsonc } from '../jsonc.js';
import {
  buildMcpEntry,
  describeMcpEntryState,
  type McpEntry,
  type McpEntryParseError,
  type MergeMcpEntryResult,
  mcpEntryFingerprint,
  mergeMcpEntry,
  type RemoveMcpEntryResult,
  readMcpEntry,
  removeMcpEntry,
} from '../mcp-entry.js';
import { MCP_CONFIG_KEY } from '../scope.js';

const NPM_ENTRY: McpEntry = {
  type: 'local',
  command: ['npx', '-y', '--package=dev-harness-skills', 'dev-harness-mcp'],
  protocol: '2026-07-28',
  timeout: { startup: 300000 },
};

const GITHUB_ENTRY: McpEntry = {
  ...NPM_ENTRY,
  command: ['npx', '-y', '--package=github:andrescevp/development-harness', 'dev-harness-mcp'],
};

// Key order differs from NPM_ENTRY on purpose: matching must ignore it.
const MATCHING_TEXT = [
  '{',
  '  // user comment',
  '  "mcp": {',
  '    "servers": {',
  '      "dh": {',
  '        "timeout": { "startup": 300000 },',
  '        "protocol": "2026-07-28",',
  '        "command": ["npx", "-y", "--package=dev-harness-skills", "dev-harness-mcp"],',
  '        "type": "local",',
  '      },',
  '    },',
  '  },',
  '}',
  '',
].join('\n');

const CUSTOM_TIMEOUT_TEXT = MATCHING_TEXT.replace('300000', '60000');
const CUSTOM_COMMAND_TEXT = MATCHING_TEXT.replace('"npx", "-y",', '"bunx",');
const CUSTOM_ENV_TEXT = MATCHING_TEXT.replace(
  '        "type": "local",',
  '        "environment": { "DEBUG": "1" },\n        "type": "local",'
);
const THEME_ONLY = '{\n  // keep me\n  "theme": "dark",\n}\n';
const INVALID_TEXT = '{\n  "mcp": ,\n}\n';
const WITH_SIBLING = MATCHING_TEXT.replace('      },\n', '      },\n      "other": { "type": "remote" },\n');
const WITH_MCP_SIBLING = `{\n  "mcp": {\n    "servers": {\n      "dh": ${JSON.stringify(NPM_ENTRY)},\n    },\n    "other": { "x": 1 },\n  },\n}\n`;

function renderConfig(entry: unknown): string {
  return `${JSON.stringify({ mcp: { servers: { dh: entry } } }, null, 2)}\n`;
}

function parsed(text: string): unknown {
  const result = parseJsonc(text);
  if (!result.ok) throw new Error(`invalid fixture: ${result.error.message}`);
  return result.value;
}

function at(text: string, path: readonly (string | number)[]): unknown {
  const result = getAtPath(text, path);
  if (!result.ok) throw new Error(`invalid fixture: ${result.error.message}`);
  return result.value;
}

function merged(result: MergeMcpEntryResult) {
  if (!result.ok) throw new Error(`unexpected merge failure: ${result.error.message}`);
  return result;
}

function removed(result: RemoveMcpEntryResult) {
  if (!result.ok) throw new Error(`unexpected remove failure: ${result.error.message}`);
  return result;
}

function failed(result: MergeMcpEntryResult | RemoveMcpEntryResult): McpEntryParseError {
  if (result.ok) throw new Error('expected a parse failure');
  return result.error;
}

describe('buildMcpEntry', () => {
  it('builds the canonical npm and GitHub entries', () => {
    expect(buildMcpEntry()).toStrictEqual(NPM_ENTRY);
    expect(buildMcpEntry({ source: 'npm' })).toStrictEqual(NPM_ENTRY);
    expect(buildMcpEntry({ source: 'github' })).toStrictEqual(GITHUB_ENTRY);
  });

  it('accepts an explicit non-blank package spec and trims it', () => {
    const entry = buildMcpEntry({ packageSpec: '  dev-harness-skills@1.2.3  ' });
    expect(entry.command).toStrictEqual(['npx', '-y', '--package=dev-harness-skills@1.2.3', 'dev-harness-mcp']);
  });

  it('rejects source and packageSpec together, blank specs, and unknown sources', () => {
    expect(() => buildMcpEntry({ source: 'npm', packageSpec: 'dev-harness-skills' })).toThrow(OperationalError);
    expect(() => buildMcpEntry({ packageSpec: '' })).toThrow(OperationalError);
    expect(() => buildMcpEntry({ packageSpec: '   ' })).toThrow(OperationalError);
    expect(() => buildMcpEntry({ source: 'local' as never })).toThrow(OperationalError);
  });
});

describe('readMcpEntry', () => {
  it('reports missing for empty documents and absent paths', () => {
    expect(readMcpEntry('')).toStrictEqual({ status: 'missing' });
    expect(readMcpEntry('{\n  // empty\n}\n')).toStrictEqual({ status: 'missing' });
    expect(readMcpEntry('{"mcp":{"servers":{}}}')).toStrictEqual({ status: 'missing' });
  });

  it('matches the canonical entry regardless of key order', () => {
    expect(readMcpEntry(renderConfig(NPM_ENTRY))).toStrictEqual({ status: 'matching', entry: NPM_ENTRY });
    expect(readMcpEntry(MATCHING_TEXT)).toStrictEqual({ status: 'matching', entry: NPM_ENTRY });
  });

  it('treats a customized timeout, command, or environment as different', () => {
    for (const text of [CUSTOM_TIMEOUT_TEXT, CUSTOM_COMMAND_TEXT, CUSTOM_ENV_TEXT]) {
      const state = readMcpEntry(text);
      expect(state.status).toBe('different');
      if (state.status !== 'different') throw new Error('expected a different entry');
      expect(deepEqualJson(state.entry, NPM_ENTRY)).toBe(false);
    }
  });

  it('compares against the selected source entry', () => {
    const githubText = renderConfig(GITHUB_ENTRY);
    expect(readMcpEntry(githubText)).toStrictEqual({ status: 'different', entry: GITHUB_ENTRY });
    expect(readMcpEntry(githubText, GITHUB_ENTRY)).toStrictEqual({ status: 'matching', entry: GITHUB_ENTRY });
  });

  it('treats a null entry as different and reports parse failures', () => {
    expect(readMcpEntry('{"mcp":{"servers":{"dh":null}}}')).toStrictEqual({ status: 'different', entry: null });
    expect(readMcpEntry(INVALID_TEXT)).toMatchObject({ status: 'invalid', error: { message: 'ValueExpected' } });
  });
});

describe('mergeMcpEntry', () => {
  it('inserts the entry into an empty document', () => {
    const result = merged(mergeMcpEntry('', NPM_ENTRY));
    expect(result.action).toBe('inserted');
    expect(result.changed).toBe(true);
    expect(at(result.text, MCP_ENTRY_PATH)).toStrictEqual(NPM_ENTRY);
  });

  it('inserts without losing comments or unrelated keys', () => {
    const result = merged(mergeMcpEntry(THEME_ONLY, NPM_ENTRY));
    expect(result.action).toBe('inserted');
    expect(result.text).toContain('// keep me');
    expect(at(result.text, ['theme'])).toBe('dark');
    expect(at(result.text, MCP_ENTRY_PATH)).toStrictEqual(NPM_ENTRY);
  });

  it('does not prune unrelated empty containers when inserting', () => {
    const input = '{"mcp":{"servers":{},"keep":{}}}';
    expect(at(merged(mergeMcpEntry(input, NPM_ENTRY)).text, ['mcp', 'keep'])).toStrictEqual({});
  });

  it('is a byte-identical no-op for a matching entry', () => {
    expect(merged(mergeMcpEntry(MATCHING_TEXT, NPM_ENTRY))).toStrictEqual({
      ok: true,
      text: MATCHING_TEXT,
      changed: false,
      action: 'noop',
    });
  });

  it('preserves a different entry with a warning unless forced', () => {
    const result = merged(mergeMcpEntry(CUSTOM_TIMEOUT_TEXT, NPM_ENTRY));
    expect(result.text).toBe(CUSTOM_TIMEOUT_TEXT);
    expect(result.changed).toBe(false);
    expect(result.action).toBe('conflict');
    expect(result.warning).toContain(MCP_CONFIG_KEY);
    expect(result.warning).toContain('--force');
  });

  it('replaces a different entry when forced, keeping comments', () => {
    const result = merged(mergeMcpEntry(CUSTOM_ENV_TEXT, NPM_ENTRY, { force: true }));
    expect(result.action).toBe('updated');
    expect(result.changed).toBe(true);
    expect(result.text).toContain('// user comment');
    expect(at(result.text, MCP_ENTRY_PATH)).toStrictEqual(NPM_ENTRY);
  });

  it('returns a typed failure and does not edit invalid JSONC', () => {
    expect(failed(mergeMcpEntry(INVALID_TEXT, NPM_ENTRY)).message).toBe('ValueExpected');
  });
});

describe('removeMcpEntry', () => {
  it('removes a matching entry and prunes emptied containers', () => {
    const result = removed(removeMcpEntry(renderConfig(NPM_ENTRY), NPM_ENTRY));
    expect(result.action).toBe('removed');
    expect(result.changed).toBe(true);
    expect(parsed(result.text)).toStrictEqual({});
  });

  it('keeps comments and unrelated servers', () => {
    const result = removed(removeMcpEntry(WITH_SIBLING, NPM_ENTRY));
    expect(result.action).toBe('removed');
    expect(result.text).toContain('// user comment');
    expect(at(result.text, ['mcp', 'servers', 'other'])).toStrictEqual({ type: 'remote' });
    expect(at(result.text, MCP_ENTRY_PATH)).toBeUndefined();
  });

  it('prunes only containers emptied by this removal', () => {
    const result = removed(removeMcpEntry(WITH_MCP_SIBLING, NPM_ENTRY));
    expect(parsed(result.text)).toStrictEqual({ mcp: { other: { x: 1 } } });
  });

  it('reports missing without changing the text', () => {
    const themeOnly = '{\n  "theme": "dark",\n}\n';
    expect(removed(removeMcpEntry(themeOnly, NPM_ENTRY))).toStrictEqual({
      ok: true,
      text: themeOnly,
      changed: false,
      action: 'missing',
    });
  });

  it('leaves a different entry untouched with a warning unless forced', () => {
    const result = removed(removeMcpEntry(CUSTOM_TIMEOUT_TEXT, NPM_ENTRY));
    expect(result.text).toBe(CUSTOM_TIMEOUT_TEXT);
    expect(result.changed).toBe(false);
    expect(result.action).toBe('mismatch');
    expect(result.warning).toContain(MCP_CONFIG_KEY);
    expect(result.warning).toContain('--force');
  });

  it('refuses an entry from another source without force', () => {
    expect(removed(removeMcpEntry(renderConfig(GITHUB_ENTRY), NPM_ENTRY)).action).toBe('mismatch');
  });

  it('removes a mismatched entry when forced', () => {
    const result = removed(removeMcpEntry(CUSTOM_TIMEOUT_TEXT, NPM_ENTRY, { force: true }));
    expect(result.action).toBe('removed');
    expect(parsed(result.text)).toStrictEqual({});
    expect(result.text).toContain('// user comment');
  });

  it('returns a typed failure for invalid JSONC', () => {
    expect(failed(removeMcpEntry(INVALID_TEXT, NPM_ENTRY)).message).toBe('ValueExpected');
  });
});

describe('mcpEntryFingerprint', () => {
  it('serializes the npm entry as stable, sorted JSON', () => {
    expect(mcpEntryFingerprint(NPM_ENTRY)).toBe(
      '{"command":["npx","-y","--package=dev-harness-skills","dev-harness-mcp"],"protocol":"2026-07-28","timeout":{"startup":300000},"type":"local"}'
    );
  });

  it('is deterministic across key order and round-trips through JSON', () => {
    const reordered = { b: 1, a: { d: 2, c: 3 } };
    expect(mcpEntryFingerprint(reordered)).toBe(mcpEntryFingerprint({ a: { c: 3, d: 2 }, b: 1 }));
    expect(mcpEntryFingerprint(NPM_ENTRY)).toBe(mcpEntryFingerprint(JSON.parse(mcpEntryFingerprint(NPM_ENTRY))));
  });

  it('distinguishes values and array order, and rejects non-JSON input', () => {
    expect(mcpEntryFingerprint({ a: 1 })).not.toBe(mcpEntryFingerprint({ a: '1' }));
    expect(mcpEntryFingerprint({ a: [1, 2] })).not.toBe(mcpEntryFingerprint({ a: [2, 1] }));
    expect(() => mcpEntryFingerprint(undefined)).toThrow(OperationalError);
  });
});

describe('describeMcpEntryState', () => {
  it('returns short ASCII lines for every state', () => {
    const lines = [
      describeMcpEntryState({ status: 'missing' }),
      describeMcpEntryState({ status: 'matching', entry: NPM_ENTRY }),
      describeMcpEntryState({ status: 'different', entry: { type: 'local' } }),
      describeMcpEntryState({
        status: 'invalid',
        error: { message: 'ValueExpected', offset: 8, line: 2, column: 8 },
      }),
    ];
    expect(lines).toStrictEqual([
      'dh MCP entry: missing',
      'dh MCP entry: matching',
      'dh MCP entry: different',
      'dh MCP entry: invalid JSONC (ValueExpected at line 2, column 8)',
    ]);
    for (const line of lines) expect(line).toMatch(/^[\x20-\x7E]+$/);
  });
});

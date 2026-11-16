/**
 * toon-hooks.test.ts — native tool-hook compression and restore cache
 * (Sub-Task 2.1).
 *
 * The `execute.after` hook replaces eligible tool text with TOON only when the
 * payload is valid JSON of at least 256 characters and TOON is strictly
 * shorter, then remembers the original JSON in a bounded exact-match cache.
 * Covered here: string and block-array result shapes, the no-op cases (short,
 * non-JSON, longer TOON, ineligible tool), the 100-entry cache bound, the env
 * override, and malformed results that must stay inert.
 */
import { decode } from '@toon-format/toon';
import { beforeEach, describe, expect, it } from 'vitest';
import { TOON_MAX_CACHE, TOON_MIN_CHARS, tryEncodeToon } from '../lib/toon.js';
import {
  cacheConvertedOutput,
  clearToonCache,
  compressToolResult,
  getCachedJson,
  getEligibleTools,
  type ToolContentBlockLike,
  type ToolResultLike,
} from '../tools/toon-hooks.js';

/** Uniform rows: the tabular shape TOON compresses best. */
const SHEET_ROWS = Array.from({ length: 6 }, (_, i) => ({
  row: i + 1,
  column: 'status',
  value: `row-${i + 1}-value`,
  note: `note-${i + 1}`,
}));

const SHEET_JSON = JSON.stringify(SHEET_ROWS);

/**
 * Deep, non-uniform nesting: the indented TOON form is longer than JSON, so
 * the codec refuses to convert it.
 */
function nestedPayload(padding: number): unknown {
  let value: unknown = 'z'.repeat(padding);
  for (let depth = 0; depth < 8; depth += 1) value = { [`level${depth}`]: value };
  return value;
}

beforeEach(() => {
  clearToonCache();
});

describe('compressToolResult (string content)', () => {
  it('replaces eligible JSON with shorter TOON, caches the original, and stops being JSON', () => {
    expect(SHEET_JSON.length).toBeGreaterThanOrEqual(TOON_MIN_CHARS);
    const result: ToolResultLike = { content: SHEET_JSON };

    expect(compressToolResult(result)).toBe(true);

    expect(result.content).not.toBe(SHEET_JSON);
    const toon = result.content as string;
    // The reference behavior: the payload becomes TOON, not JSON.
    expect(() => JSON.parse(toon)).toThrow();
    expect(decode(toon)).toEqual(SHEET_ROWS);
    expect(getCachedJson(toon)).toBe(SHEET_JSON);
  });

  it('trims only for the checks and replaces the whole payload without surrounding whitespace', () => {
    const padded = `\n  ${SHEET_JSON}  \n`;
    const result: ToolResultLike = { content: padded };

    expect(compressToolResult(result)).toBe(true);

    const toon = result.content as string;
    expect(toon).toBe(toon.trim());
    expect(getCachedJson(toon)).toBe(SHEET_JSON);
    expect(decode(toon)).toEqual(SHEET_ROWS);
  });

  it('leaves JSON below the 256-character threshold untouched', () => {
    const shortJson = JSON.stringify({ tiny: 'x' });
    expect(shortJson.length).toBeLessThan(TOON_MIN_CHARS);
    const result: ToolResultLike = { content: shortJson };

    expect(compressToolResult(result)).toBe(false);
    expect(result.content).toBe(shortJson);
    expect(getCachedJson(shortJson)).toBeUndefined();
  });

  it('leaves non-JSON text untouched', () => {
    const log = 'build log line: nothing to convert here\n'.repeat(20);
    expect(log.length).toBeGreaterThanOrEqual(TOON_MIN_CHARS);
    const result: ToolResultLike = { content: log };

    expect(compressToolResult(result)).toBe(false);
    expect(result.content).toBe(log);
  });

  it('leaves JSON untouched when the TOON form is not shorter', () => {
    const payload = nestedPayload(200);
    const json = JSON.stringify(payload);
    expect(json.length).toBeGreaterThanOrEqual(TOON_MIN_CHARS);
    expect(tryEncodeToon(payload, json)).toBeUndefined();
    const result: ToolResultLike = { content: json };

    expect(compressToolResult(result)).toBe(false);
    expect(result.content).toBe(json);
  });

  it('compresses a string output only when content carries no text payload', () => {
    const result: ToolResultLike = { output: SHEET_JSON };

    expect(compressToolResult(result)).toBe(true);

    const toon = result.output as string;
    expect(toon).not.toBe(SHEET_JSON);
    expect(decode(toon)).toEqual(SHEET_ROWS);
    expect(getCachedJson(toon)).toBe(SHEET_JSON);
  });
});

describe('compressToolResult (content blocks)', () => {
  it('replaces the first valid text block and leaves file blocks untouched', () => {
    const fileBlock = {
      type: 'file',
      uri: 'file:///tmp/report.csv',
      mime: 'text/csv',
      name: 'report.csv',
    };
    const content: ToolContentBlockLike[] = [
      fileBlock,
      { type: 'text', text: 'plain diagnostics, not JSON' },
      { type: 'text', text: SHEET_JSON },
    ];
    const result: ToolResultLike = { content };

    expect(compressToolResult(result)).toBe(true);

    expect(content[0]).toEqual(fileBlock);
    expect(content[1]?.text).toBe('plain diagnostics, not JSON');
    const toon = content[2]?.text as string;
    expect(toon).not.toBe(SHEET_JSON);
    expect(decode(toon)).toEqual(SHEET_ROWS);
    expect(getCachedJson(toon)).toBe(SHEET_JSON);
  });

  it('leaves a block array without any valid JSON text untouched', () => {
    const imageBlock = { type: 'file', uri: 'file:///tmp/a.png', mime: 'image/png' };
    const content: ToolContentBlockLike[] = [{ type: 'text', text: 'status: ok' }, imageBlock];
    const result: ToolResultLike = { content };
    const before = JSON.parse(JSON.stringify(result));

    expect(compressToolResult(result)).toBe(false);
    expect(result).toEqual(before);
  });
});

describe('tool eligibility', () => {
  it('defaults to bash and parses the env override (trim, lowercase, drop empties)', () => {
    const original = process.env.OPENCODE_TOON_PLUGIN_TOOLS;
    delete process.env.OPENCODE_TOON_PLUGIN_TOOLS;
    try {
      expect(getEligibleTools()).toEqual(new Set(['bash']));
    } finally {
      if (original !== undefined) process.env.OPENCODE_TOON_PLUGIN_TOOLS = original;
    }

    expect(getEligibleTools({})).toEqual(new Set(['bash']));
    expect(getEligibleTools({ OPENCODE_TOON_PLUGIN_TOOLS: '' })).toEqual(new Set(['bash']));
    expect(getEligibleTools({ OPENCODE_TOON_PLUGIN_TOOLS: ' Bash , SHELL,,webfetch ' })).toEqual(
      new Set(['bash', 'shell', 'webfetch'])
    );
  });

  it('leaves output untouched for a tool outside the eligible set (hook guard)', () => {
    const eligible = getEligibleTools({});
    expect(eligible.has('bash')).toBe(true);
    expect(eligible.has('shell')).toBe(false);

    const result: ToolResultLike = { content: SHEET_JSON };
    // Mirrors the inline guard registered in src/plugin.ts.
    if (eligible.has('shell')) compressToolResult(result);
    expect(result.content).toBe(SHEET_JSON);
  });
});

describe('restore cache', () => {
  const toonFor = (i: number) => `rows[${i}\t]{id}:\n  ${i}`;
  const jsonFor = (i: number) => JSON.stringify({ id: i });

  it(`keeps ${TOON_MAX_CACHE} entries and evicts the oldest on the next insert`, () => {
    for (let i = 0; i < TOON_MAX_CACHE; i += 1) cacheConvertedOutput(toonFor(i), jsonFor(i));
    for (let i = 0; i < TOON_MAX_CACHE; i += 1) expect(getCachedJson(toonFor(i))).toBe(jsonFor(i));

    const newest = TOON_MAX_CACHE;
    cacheConvertedOutput(toonFor(newest), jsonFor(newest));

    expect(getCachedJson(toonFor(0))).toBeUndefined();
    expect(getCachedJson(toonFor(1))).toBe(jsonFor(1));
    expect(getCachedJson(toonFor(newest))).toBe(jsonFor(newest));
  });

  it('refreshes recency on a cache hit before choosing the eviction victim', () => {
    for (let i = 0; i < TOON_MAX_CACHE; i += 1) cacheConvertedOutput(toonFor(i), jsonFor(i));

    // A hit on the oldest inserted entry must make it the most recently used.
    expect(getCachedJson(toonFor(0))).toBe(jsonFor(0));

    const newest = TOON_MAX_CACHE;
    cacheConvertedOutput(toonFor(newest), jsonFor(newest));

    // FIFO would evict 0; LRU evicts 1, the least recently used entry now.
    expect(getCachedJson(toonFor(1))).toBeUndefined();
    expect(getCachedJson(toonFor(0))).toBe(jsonFor(0));
    expect(getCachedJson(toonFor(newest))).toBe(jsonFor(newest));
  });

  it('keys entries by the trimmed TOON text', () => {
    cacheConvertedOutput('\nrows[2\t]{id}:\n  1\n  2\n', '{"rows":[1,2]}');

    expect(getCachedJson('rows[2\t]{id}:\n  1\n  2')).toBe('{"rows":[1,2]}');
    expect(getCachedJson('  rows[2\t]{id}:\n  1\n  2  ')).toBe('{"rows":[1,2]}');
    expect(getCachedJson('rows[2\t]{id}:\n  1')).toBeUndefined();
  });

  it('clearToonCache drops every entry', () => {
    cacheConvertedOutput(toonFor(0), jsonFor(0));

    clearToonCache();

    expect(getCachedJson(toonFor(0))).toBeUndefined();
  });
});

describe('compressToolResult robustness', () => {
  it('stays inert on malformed result shapes and never throws', () => {
    const shapes: unknown[] = [
      undefined,
      null,
      {},
      { content: undefined },
      { content: 42 },
      { content: [] },
      { content: [null] },
      { content: [{}] },
      { content: [{ type: 'text' }] },
      { content: [{ type: 'text', text: 42 }] },
      { content: [{ type: 'file', uri: 'file:///x', mime: 'text/plain' }] },
      { output: 42 },
      { output: undefined },
    ];

    for (const shape of shapes) {
      expect(() => compressToolResult(shape as ToolResultLike)).not.toThrow();
      expect(compressToolResult(shape as ToolResultLike)).toBe(false);
    }
  });
});

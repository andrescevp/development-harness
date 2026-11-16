/**
 * mcp-toon.test.ts — automatic TOON output from MCP `textResult`.
 *
 * Unit: `textResult` encodes eligible payloads, keeps JSON below the 256-char
 * threshold, and never converts error results. Integration: a real connected
 * client/server pair returns TOON for a large tabular payload and JSON for a
 * small one — both decode to the same expected value.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { decodeToon, looksLikeJson, TOON_MIN_CHARS } from '../lib/toon.js';
import { guarded, textResult } from '../mcp/tool-results.js';
import type { SheetResult } from '../tools/sheet-tools.js';
import type { McpTestHarness } from './helpers/mcp.js';
import { closeHarness, connectHarness, parseToolText, textOf } from './helpers/mcp.js';

/** Uniform rows encode into a short TOON table (the intended use case). */
function uniformPayload(rowCount: number): { ok: boolean; rows: Record<string, unknown>[] } {
  return {
    ok: true,
    rows: Array.from({ length: rowCount }, (_, index) => ({
      id: index + 1,
      name: `user-${index + 1}`,
      role: 'engineer',
      active: true,
    })),
  };
}

/** Build a CSV long enough to force the ≥256-char TOON path. */
function writeLargeCsv(root: string, rowCount = 40): { file: string; expected: SheetResult } {
  const file = path.join(root, 'large.csv');
  const rows = Array.from({ length: rowCount }, (_, index) => ({
    id: index + 1,
    name: `row-${index + 1}`,
    qty: (index + 1) * 10,
  }));
  const csv = ['id,name,qty', ...rows.map((row) => `${row.id},${row.name},${row.qty}`), ''].join('\n');
  fs.writeFileSync(file, csv, 'utf8');
  return { file, expected: { ok: true, columns: ['id', 'name', 'qty'], rowCount, rows } };
}

afterEach(closeHarness);

describe('textResult (unit)', () => {
  it('returns TOON for a large uniform payload and decodes back to it', () => {
    const payload = uniformPayload(12);
    const result = textResult(payload);
    const text = textOf(result);

    expect(JSON.stringify(payload).length).toBeGreaterThanOrEqual(TOON_MIN_CHARS);
    expect(looksLikeJson(text)).toBe(false);
    expect(() => JSON.parse(text)).toThrow();
    expect(decodeToon(text)).toEqual(payload);
  });

  it('returns exact JSON below the 256-char threshold', () => {
    const payload = { ok: true, rows: [{ id: 1 }] };
    const text = textOf(textResult(payload));

    expect(JSON.stringify(payload).length).toBeLessThan(TOON_MIN_CHARS);
    expect(text).toBe(JSON.stringify(payload));
  });

  it('keeps error results as raw plain text with isError', () => {
    const result = guarded(() => {
      throw new Error('plan write failed');
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('plan write failed');
  });
});

describe('parseToolText', () => {
  it('parses JSON payloads', () => {
    expect(parseToolText<{ ok: boolean }>('{"ok":true}')).toEqual({ ok: true });
  });

  it('decodes TOON payloads when JSON parsing fails', () => {
    const payload = uniformPayload(12);
    const toon = textOf(textResult(payload));
    expect(parseToolText<typeof payload>(toon)).toEqual(payload);
  });

  it('throws a clear error naming neither format for unparseable text', () => {
    expect(() => parseToolText('not a payload at all')).toThrow(/neither JSON nor TOON/);
  });
});

describe('MCP automatic TOON (integration)', () => {
  it('returns TOON for a large read_sheet payload that decodes to the expected rows', async () => {
    let expected: SheetResult | undefined;
    const h: McpTestHarness = await connectHarness({
      setup: (root) => {
        expected = writeLargeCsv(root).expected;
      },
    });

    const res = await h.callTool('read_sheet', { path: path.join(h.workspaceRoot, 'large.csv') });
    const text = textOf(res);

    expect(res.isError).toBeFalsy();
    expect(looksLikeJson(text)).toBe(false);
    expect(() => JSON.parse(text)).toThrow();
    expect(decodeToon(text)).toEqual(expected);
  });

  it('keeps a small read_sheet payload as JSON', async () => {
    const h = await connectHarness({
      setup: (root) => {
        fs.writeFileSync(path.join(root, 'small.csv'), 'id,name,qty\n1,alpha,10\n', 'utf8');
      },
    });

    const res = await h.callTool('read_sheet', { path: path.join(h.workspaceRoot, 'small.csv') });
    const text = textOf(res);

    expect(res.isError).toBeFalsy();
    expect(looksLikeJson(text)).toBe(true);
    expect(JSON.parse(text)).toEqual({
      ok: true,
      columns: ['id', 'name', 'qty'],
      rowCount: 1,
      rows: [{ id: 1, name: 'alpha', qty: 10 }],
    });
  });

  it('keeps plan errors as raw text even though plan payloads are large', async () => {
    const h = await connectHarness();
    const res = await h.callTool('plan_read', { slug: 'missing' });

    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/^plan file not readable: /);
  });
});

/**
 * sheet-logged.test.ts — MCP parity suite for the sheet + command adapters
 * (read_sheet / update_sheet / sheet_schema / logged_command).
 *
 * Legacy parity: sheet helper failures stay NORMAL results (`ok: false`
 * payloads, never `isError`) — the helpers convert every failure themselves;
 * logged_command reports non-zero exits in the payload. Only unexpected
 * helper throws become `isError` (pinned in adapter-guard.test.ts).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { closeHarness, connectHarness, textOf } from '../../__tests__/helpers/mcp.js';
import type { LoggedCommandResult } from '../../tools/logged-command.js';
import type { SheetResult } from '../../tools/sheet-tools.js';

const CSV = `id,name,qty
1,alpha,10
2,beta,20
3,gamma,30
`;

/** Temp logs created by logged_command calls, drained after each test. */
const logPaths: string[] = [];

afterEach(async () => {
  await closeHarness();
  for (const logPath of logPaths.splice(0)) fs.rmSync(logPath, { force: true });
});

function writeCsv(root: string, name = 'data.csv'): string {
  const file = path.join(root, name);
  fs.writeFileSync(file, CSV, 'utf8');
  return file;
}

describe('read_sheet', () => {
  it('reads a csv with deep-equal legacy payload', async () => {
    const h = await connectHarness();
    const payload = await h.callToolJson<SheetResult>('read_sheet', { path: writeCsv(h.workspaceRoot) });
    expect(payload).toEqual({
      ok: true,
      columns: ['id', 'name', 'qty'],
      rowCount: 3,
      rows: [
        { id: 1, name: 'alpha', qty: 10 },
        { id: 2, name: 'beta', qty: 20 },
        { id: 3, name: 'gamma', qty: 30 },
      ],
    });
  });

  it('honors the limit parameter', async () => {
    const h = await connectHarness();
    const payload = await h.callToolJson<SheetResult>('read_sheet', {
      path: writeCsv(h.workspaceRoot),
      limit: 2,
    });
    expect(payload.ok).toBe(true);
    expect(payload.rowCount).toBe(2);
    expect(payload.rows.map((row) => row.id)).toEqual([1, 2]);
  });

  it('supports a custom SELECT query against read_csv_auto(?)', async () => {
    const h = await connectHarness();
    const payload = await h.callToolJson<SheetResult>('read_sheet', {
      path: writeCsv(h.workspaceRoot),
      query: 'SELECT name FROM read_csv_auto(?) WHERE qty > 15',
    });
    expect(payload.ok).toBe(true);
    expect(payload.columns).toEqual(['name']);
    expect(payload.rows).toEqual([{ name: 'beta' }, { name: 'gamma' }]);
  });

  it('returns an ok:false payload (not isError) for a missing csv', async () => {
    const h = await connectHarness();
    const res = await h.callTool('read_sheet', { path: path.join(h.workspaceRoot, 'missing.csv') });
    expect(res.isError).toBeFalsy();
    const payload = JSON.parse(textOf(res)) as SheetResult;
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain('duckdb error:');
    expect(payload.columns).toEqual([]);
    expect(payload.rowCount).toBe(0);
    expect(payload.rows).toEqual([]);
  });

  it('rejects non-read queries inside the payload', async () => {
    const h = await connectHarness();
    const payload = await h.callToolJson<SheetResult>('read_sheet', {
      path: writeCsv(h.workspaceRoot),
      query: 'DROP TABLE t',
    });
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe('duckdb error: read queries must be SELECT/WITH/DESCRIBE/SHOW');
  });
});

describe('update_sheet', () => {
  it('applies an UPDATE, rewrites the csv, and returns the updated rows', async () => {
    const h = await connectHarness();
    const csv = writeCsv(h.workspaceRoot);
    const payload = await h.callToolJson<SheetResult>('update_sheet', {
      path: csv,
      query: "UPDATE t SET qty = 99 WHERE name = 'alpha'",
    });
    expect(payload.ok).toBe(true);
    expect(payload.rows).toEqual([
      { id: 1, name: 'alpha', qty: 99 },
      { id: 2, name: 'beta', qty: 20 },
      { id: 3, name: 'gamma', qty: 30 },
    ]);
    expect(fs.readFileSync(csv, 'utf8')).toContain('99');
    const reread = await h.callToolJson<SheetResult>('read_sheet', { path: csv });
    expect(reread.rows.find((row) => row.name === 'alpha')?.qty).toBe(99);
  });

  it('rejects non-write queries inside the payload', async () => {
    const h = await connectHarness();
    const payload = await h.callToolJson<SheetResult>('update_sheet', {
      path: writeCsv(h.workspaceRoot),
      query: 'SELECT * FROM t',
    });
    expect(payload).toEqual({
      ok: false,
      columns: [],
      rowCount: 0,
      rows: [],
      error: 'update queries must be UPDATE/INSERT/DELETE',
    });
  });

  it('returns an ok:false payload for a missing csv', async () => {
    const h = await connectHarness();
    const payload = await h.callToolJson<SheetResult>('update_sheet', {
      path: path.join(h.workspaceRoot, 'missing.csv'),
      query: "UPDATE t SET qty = 1 WHERE name = 'alpha'",
    });
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain('duckdb error:');
  });
});

describe('sheet_schema', () => {
  it('describes columns as name:type pairs', async () => {
    const h = await connectHarness();
    const payload = await h.callToolJson<SheetResult>('sheet_schema', { path: writeCsv(h.workspaceRoot) });
    expect(payload.ok).toBe(true);
    const joined = payload.columns.join(',');
    expect(joined).toContain('id:BIGINT');
    expect(joined).toContain('name:VARCHAR');
    expect(joined).toContain('qty:BIGINT');
    expect(payload.columns.every((col) => /^[^:]+:.+$/.test(col))).toBe(true);
  });

  it('returns an ok:false payload for a missing csv', async () => {
    const h = await connectHarness();
    const payload = await h.callToolJson<SheetResult>('sheet_schema', {
      path: path.join(h.workspaceRoot, 'missing.csv'),
    });
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain('duckdb error:');
  });
});

describe('logged_command', () => {
  it('captures a successful command in a real temp log', async () => {
    const h = await connectHarness();
    const payload = await h.callToolJson<LoggedCommandResult>('logged_command', {
      command: 'node -e "console.log(\'x\')"',
    });
    expect(Object.keys(payload).sort()).toEqual(['exitCode', 'head', 'logPath', 'ok', 'tail', 'truncated']);
    expect(payload.ok).toBe(true);
    expect(payload.exitCode).toBe(0);
    expect(payload.head).toContain('x');
    expect(payload.truncated).toBe(false);
    expect(path.dirname(payload.logPath)).toBe(os.tmpdir());
    expect(fs.existsSync(payload.logPath)).toBe(true);
    logPaths.push(payload.logPath);
  });

  it('reports a failing command in the payload (never isError)', async () => {
    const h = await connectHarness();
    // Shell-level `exit`: a child's non-zero exit is masked by the wrapper's trailing echo.
    // Plan suggested `node -e "process.exit(3)"` — that reports exit 0 (same masking).
    const res = await h.callTool('logged_command', { command: 'echo boom && exit 3' });
    expect(res.isError).toBeFalsy();
    const payload = JSON.parse(textOf(res)) as LoggedCommandResult;
    expect(payload.ok).toBe(false);
    expect(payload.exitCode).toBe(3);
    expect(payload.logPath).toBeTruthy();
    expect(fs.existsSync(payload.logPath)).toBe(true);
    expect(payload).toHaveProperty('head');
    expect(payload).toHaveProperty('tail');
    expect(payload).toHaveProperty('truncated');
    logPaths.push(payload.logPath);
  });
});

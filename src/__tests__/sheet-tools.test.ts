/**
 * sheet-tools.test.ts — DuckDB-backed csv sheet tools (dh_read_sheet /
 * dh_update_sheet / dh_sheet_schema): read, round-trip update, schema.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readSheet, sheetSchema, updateSheet } from '../tools/sheet-tools.js';

const CSV = `name,age,city
alice,30,tokyo
bob,25,berlin
carol,41,paris
`;

function tempCsv(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dhs-sheet-'));
  const file = path.join(dir, 'people.csv');
  fs.writeFileSync(file, content);
  return file;
}

describe('readSheet', () => {
  it('reads a csv with header inference', async () => {
    const file = tempCsv(CSV);
    const res = await readSheet(file);
    expect(res.ok).toBe(true);
    expect(res.columns).toEqual(['name', 'age', 'city']);
    expect(res.rowCount).toBe(3);
    expect(res.rows[0]).toMatchObject({ name: 'alice', age: 30 });
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });

  it('supports custom SELECT + LIMIT', async () => {
    const file = tempCsv(CSV);
    const res = await readSheet(file, 'SELECT name FROM read_csv_auto(?) WHERE age > 26', 5);
    expect(res.ok).toBe(true);
    expect(res.rows.length).toBe(2);
    expect(Object.keys(res.rows[0] as object)).toEqual(['name']);
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });

  it('rejects non-read queries', async () => {
    const file = tempCsv(CSV);
    const res = await readSheet(file, 'DELETE FROM t');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/SELECT/);
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });
});

describe('updateSheet', () => {
  it('round-trips an UPDATE back to the csv file', async () => {
    const file = tempCsv(CSV);
    const res = await updateSheet(file, `UPDATE t SET city = 'madrid' WHERE name = 'alice'`);
    expect(res.ok).toBe(true);
    const reread = await readSheet(file);
    expect(reread.rows.find((r) => r.name === 'alice')?.city).toBe('madrid');
    // other rows untouched
    expect(reread.rows.find((r) => r.name === 'bob')?.city).toBe('berlin');
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });

  it('rejects non-write queries', async () => {
    const file = tempCsv(CSV);
    const res = await updateSheet(file, 'SELECT * FROM t');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/UPDATE/);
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });
});

describe('sheetSchema', () => {
  it('describes columns with inferred types', async () => {
    const file = tempCsv(CSV);
    const res = await sheetSchema(file);
    expect(res.ok).toBe(true);
    expect(res.columns.join(',')).toContain('name:');
    expect(res.columns.join(',')).toContain('age:');
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });
});

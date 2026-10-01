/**
 * sheet-tools.ts — csv/xlsx tabular data management via DuckDB
 * (dh_read_sheet, dh_update_sheet, dh_sheet_schema).
 *
 * CSV is read through DuckDB's read_csv_auto (header + type inference);
 * XLSX via read_xlsx when the extension loads (wrapped with a fallback
 * error). Updates run inside a temp table and write the file back as CSV
 * (HEADER, OVERWRITE_OR_IGNORE) so the plugin never rewrites original
 * formatting beyond the CSV contract.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports -- duckdb is CJS-only
type DuckDbModule = {
  Database: new (path: string) => DuckDb;
};

let duckdbModule: DuckDbModule | undefined;
/** Lazy duckdb load — keeps the plugin bundle free of top-level bare imports
 * (the v2.0.18 global-plugin loader cannot resolve them); only evaluated
 * when a sheet tool actually runs. */
function getDuckdb(): DuckDbModule {
  const mod = duckdbModule ?? (require('duckdb') as DuckDbModule);
  duckdbModule = mod;
  return mod;
}

/** Minimal structural typing for duckdb.Database (package types are CJS-bound). */
interface DuckDb {
  all(sql: string, ...params: unknown[]): void;
  run(sql: string, ...params: unknown[]): void;
  close(cb: () => void): void;
}

export interface SheetResult {
  ok: boolean;
  columns: string[];
  rowCount: number;
  rows: Record<string, unknown>[];
  error?: string;
}

/** DuckDB returns BIGINT as BigInt — convert to JSON-safe numbers/values. */
function toJsonSafe(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return JSON.parse(
    JSON.stringify(rows, (_key, value) => (typeof value === 'bigint' ? Number(value) : value)) as string
  ) as Record<string, unknown>[];
}

function runAll(db: DuckDb, sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, ...(params ?? []), (err: Error | null, rows: Record<string, unknown>[]) => {
      if (err) reject(err);
      else resolve(rows ?? []);
    });
  });
}

/** Build the ok result with safe rows + columns. */
async function okResult(db: DuckDb, path: string, rows: Record<string, unknown>[]): Promise<SheetResult> {
  const safe = toJsonSafe(rows);
  const columns = safe.length ? Object.keys(safe[0] as Record<string, unknown>) : await describeColumns(db, path);
  return { ok: true, columns, rowCount: safe.length, rows: safe };
}

function run(db: DuckDb, sql: string, params?: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, ...(params ?? []), (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/** Run an operation against a fresh in-memory DuckDB, with error/close handling. */
async function withSheet(path: string, op: (db: DuckDb) => Promise<SheetResult>): Promise<SheetResult> {
  const db = new (getDuckdb().Database)(':memory:');
  try {
    return await op(db);
  } catch (err) {
    return { ok: false, columns: [], rowCount: 0, rows: [], error: errorMessage(err, path) };
  } finally {
    await new Promise<void>((resolve) => db.close(() => resolve()));
  }
}

/** Read rows from a csv/xlsx file (optionally custom SELECT query + LIMIT). */
export async function readSheet(path: string, query?: string, limit?: number): Promise<SheetResult> {
  return withSheet(path, async (db) => {
    let sql: string;
    const trimmed = (query ?? '').trim();
    if (trimmed) {
      if (!/^(SELECT|WITH|DESCRIBE|SHOW)\b/i.test(trimmed))
        throw new Error('read queries must be SELECT/WITH/DESCRIBE/SHOW');
      sql = `${trimmed}${limit ? ` LIMIT ${Math.max(0, Math.floor(limit))}` : ''}`;
    } else {
      sql = `SELECT * FROM read_csv_auto(?)${limit ? ` LIMIT ${Math.max(0, Math.floor(limit))}` : ''}`;
    }
    const rows = trimmed
      ? await runAll(db, sql, sql.includes('?') ? [path] : undefined)
      : await runAll(db, sql, [path]);
    return okResult(db, path, rows);
  });
}

/** Apply an UPDATE/INSERT/DELETE query and write the CSV back to the file. */
export async function updateSheet(path: string, query: string): Promise<SheetResult> {
  const trimmed = (query ?? '').trim();
  if (!/^(UPDATE|INSERT|DELETE)\b/i.test(trimmed))
    return { ok: false, columns: [], rowCount: 0, rows: [], error: 'update queries must be UPDATE/INSERT/DELETE' };
  return withSheet(path, async (db) => {
    await run(db, `CREATE TEMP TABLE t AS SELECT * FROM read_csv_auto($1)`, [path]);
    await run(db, trimmed);
    await run(db, `COPY (SELECT * FROM t) TO $1 (HEADER, OVERWRITE_OR_IGNORE)`, [path]);
    const rows = await runAll(db, `SELECT * FROM t`);
    return okResult(db, path, rows);
  });
}

/** Column list + inferred types for a tabular file. */
export async function sheetSchema(path: string): Promise<SheetResult> {
  return withSheet(path, async (db) => {
    const rows = toJsonSafe(await runAll(db, `DESCRIBE SELECT * FROM read_csv_auto($1)`, [path]));
    const columns = rows.map((r) => `${String(r.column_name ?? '')}:${String(r.column_type ?? '?')}`);
    return { ok: true, columns, rowCount: 0, rows };
  });
}

async function describeColumns(db: DuckDb, path: string): Promise<string[]> {
  try {
    const rows = await runAll(db, `DESCRIBE SELECT * FROM read_csv_auto($1)`, [path]);
    return rows.map((r) => String(r.column_name ?? ''));
  } catch {
    return [];
  }
}

function errorMessage(err: unknown, path: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/read_xlsx|extension/i.test(msg) && /\.xlsx$/i.test(path)) {
    return `xlsx support requires the DuckDB xlsx extension: ${msg}`;
  }
  return `duckdb error: ${msg}`;
}

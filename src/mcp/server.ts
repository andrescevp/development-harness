/**
 * server.ts — MCP server factory for the harness tools.
 *
 * Serves the 7 plan/sheet/command capabilities of the `dh` tool namespace
 * during the transition from plugin tools to MCP: the opencode plugin still
 * registers them at this commit; this module is their MCP home. Handlers are
 * thin adapters over the pure helpers in `src/tools/*`; the workspace root is
 * injected by the caller (the stdio entry resolves it per connection).
 *
 * When served over stdio, stdout is the MCP protocol channel — never log here.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { runLoggedCommand } from '../tools/logged-command.js';
import {
  appendPlanIndexRow,
  buildPlanTemplate,
  PHASE_STATUSES,
  parsePlan,
  readPlanFile,
  STATUS_TARGETS,
  setStatus,
} from '../tools/plan-lifecycle.js';
import { assertNoSymlinks, planIndexFile, resolvePlanPath } from '../tools/plan-paths.js';
import { readSheet, sheetSchema, updateSheet } from '../tools/sheet-tools.js';

export interface BuildServerOptions {
  /** Absolute workspace root; plan paths anchor under `<root>/docs/plans`. */
  workspaceRoot: string;
  /** Server version advertised in the MCP `initialize` handshake. */
  version: string;
}

const SERVER_NAME = 'dev-harness-skills';

/** Serialize a tool payload into the MCP text-content result contract. */
function textResult(payload: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

/** MCP error-result contract (parity error messages survive verbatim). */
function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** Map a thrown value onto the MCP error-result contract. */
function toErrorResult(err: unknown): CallToolResult {
  return errorResult(err instanceof Error ? err.message : String(err));
}

/**
 * Run a synchronous tool body, mapping thrown helper errors to `isError`.
 * Synchronous on purpose: read-modify-write bodies keep no `await` between
 * their `readFileSync` and `writeFileSync`. The SDK also maps handler throws
 * to this shape; the guard keeps the parity contract explicit and
 * SDK-independent.
 */
function guarded(body: () => CallToolResult): CallToolResult {
  try {
    return body();
  } catch (err) {
    return toErrorResult(err);
  }
}

/**
 * Async-safe variant of `guarded` for handlers delegating to async helpers.
 * The SDK also maps handler throws to the same `{ content, isError }` shape;
 * the guard keeps the parity contract explicit and SDK-independent.
 */
async function guardedAsync(body: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await body();
  } catch (err) {
    return toErrorResult(err);
  }
}

/** Fresh server instance per connection — never share one across transports. */
export function buildServer({ workspaceRoot, version }: BuildServerOptions): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version });

  server.registerTool(
    'plan_read',
    {
      description:
        'Parse a phased plan (docs/plans/<slug>/plan.md) into structured JSON: meta, phases[] with status, subTasks[] with phase/status/relatedRequirements. Input: slug (or path relative to docs/plans). Errors clearly when missing or unparseable.',
      inputSchema: z.object({
        slug: z.string().describe('Plan slug (docs/plans/<slug>/plan.md)').optional(),
        path: z.string().describe('Explicit path relative to docs/plans (overrides slug)').optional(),
      }),
    },
    async ({ slug, path: relPath }) =>
      guarded(() => {
        const file = resolvePlanPath(workspaceRoot, slug, relPath);
        const contents = readPlanFile(file);
        return textResult({ ok: true, path: file, plan: parsePlan(contents) });
      })
  );

  server.registerTool(
    'plan_update_status',
    {
      description:
        'Update a phase or sub-task status marker in a phased plan and return the re-parsed plan. target=phase→index "N"; target=subtask→index "N.M". status ∈ Pending | In Progress | Completed. A phase cannot be Completed while any of its sub-tasks is not Completed.',
      inputSchema: z.object({
        slug: z.string().optional(),
        path: z.string().describe('Explicit path relative to docs/plans (overrides slug)').optional(),
        target: z.enum(STATUS_TARGETS),
        index: z.string().describe('Phase "N" or sub-task "N.M"'),
        status: z.enum(PHASE_STATUSES),
      }),
    },
    async ({ slug, path: relPath, target, index, status }) =>
      guarded(() => {
        const file = resolvePlanPath(workspaceRoot, slug, relPath);
        const contents = readPlanFile(file);
        const result = setStatus(contents, target, index, status);
        // No-op edits must not touch the file (mtime stays stable).
        if (result.contents !== contents) fs.writeFileSync(file, result.contents, 'utf8');
        return textResult({ ok: true, path: file, plan: result.plan });
      })
  );

  server.registerTool(
    'plan_create',
    {
      description:
        'Scaffold a new phased plan (docs/plans/<slug>/plan.md) from a title, objective, and phases with sub-task titles; all statuses start Pending. Optionally append the index.md row.',
      inputSchema: z.object({
        slug: z.string(),
        title: z.string(),
        objective: z.string(),
        phases: z.array(
          z.object({
            title: z.string(),
            subTasks: z.array(z.object({ title: z.string() })),
          })
        ),
        updateIndex: z.boolean().describe('Append a row to docs/plans/index.md').optional(),
      }),
    },
    async ({ slug, title, objective, phases, updateIndex }) =>
      guarded(() => {
        const file = resolvePlanPath(workspaceRoot, slug);
        // Fail before any write when the index chain is compromised — a
        // symlinked index must never strand an already-created plan file.
        if (updateIndex) assertNoSymlinks(workspaceRoot, planIndexFile(workspaceRoot));
        const template = buildPlanTemplate({ slug, title, objective, phases });
        // Parse before writing anything: an invalid scaffold must not leave a
        // broken plan behind (retries would then hit `plan already exists`).
        const plan = parsePlan(template);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        try {
          // Exclusive create ('wx') replaces an existsSync pre-check (no TOCTOU gap).
          fs.writeFileSync(file, template, { flag: 'wx' });
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`plan already exists: ${file}`);
          throw err;
        }
        if (updateIndex) appendPlanIndexRow(workspaceRoot, slug, title);
        return textResult({ ok: true, path: file, plan });
      })
  );

  server.registerTool(
    'read_sheet',
    {
      description:
        'Read tabular data (csv/xlsx) with DuckDB: returns columns, rows (JSON) and row count. csv read via read_csv_auto; xlsx via read_xlsx when the extension loads. Optional query (SELECT/WITH/DESCRIBE/SHOW) and limit. Use to retrieve data from generated sheets/documents.',
      inputSchema: z.object({
        path: z.string().describe('Absolute path to the csv/xlsx file'),
        query: z.string().describe('Optional SQL (SELECT/WITH/DESCRIBE/SHOW) — can use read_csv_auto(?)').optional(),
        limit: z.number().describe('Max rows to return').optional(),
      }),
    },
    async ({ path: sheetPath, query, limit }) =>
      guardedAsync(async () => {
        const result = await readSheet(sheetPath, query, limit);
        return textResult(result);
      })
  );

  server.registerTool(
    'update_sheet',
    {
      description:
        "Apply an UPDATE/INSERT/DELETE query to a csv file via DuckDB and write the result back as CSV (HEADER, OVERWRITE_OR_IGNORE). Reads the file into a temp table named t — reference it in the query (e.g. UPDATE t SET col='x' WHERE id=1). Returns the updated rows + row count.",
      inputSchema: z.object({
        path: z.string().describe('Absolute path to the csv file'),
        query: z.string().describe('UPDATE/INSERT/DELETE SQL against temp table t'),
      }),
    },
    async ({ path: sheetPath, query }) =>
      guardedAsync(async () => {
        const result = await updateSheet(sheetPath, query);
        return textResult(result);
      })
  );

  server.registerTool(
    'sheet_schema',
    {
      description: 'Describe a csv/xlsx file with DuckDB: returns column names + inferred types (column:type).',
      inputSchema: z.object({
        path: z.string(),
      }),
    },
    async ({ path: sheetPath }) =>
      guardedAsync(async () => {
        const result = await sheetSchema(sheetPath);
        return textResult(result);
      })
  );

  server.registerTool(
    'logged_command',
    {
      description:
        "Run a command under the logged-execution strategy: output is written to a log file in the SYSTEM TEMP directory, then the first 20 and last 30 lines are returned with a TRUNCATED marker plus the log path for full exploration. Intended for the executor agent; command runs locally with the plugin server's permissions.",
      inputSchema: z.object({
        command: z.string().describe('The shell command to run (POSIX shell on linux/macOS; PowerShell on Windows)'),
        logName: z
          .string()
          .describe('Optional base name for the log file (always placed in the OS temp dir)')
          .optional(),
        timeoutMs: z.number().describe('Kill after this many milliseconds (default 120000)').optional(),
      }),
    },
    async ({ command, logName, timeoutMs }) =>
      guardedAsync(async () => {
        const result = await runLoggedCommand({ command, logName, timeoutMs });
        return textResult(result);
      })
  );

  return server;
}

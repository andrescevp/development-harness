/**
 * server.ts — MCP server factory for the harness tools.
 *
 * Serves the 12 plan/sheet/command capabilities of the `dh` tool namespace.
 * The opencode plugin registers agents and skills only; these tools live here
 * and are served over stdio by `src/mcp/stdio.ts`. Handlers are thin adapters
 * over the pure helpers in `src/tools/*`; the workspace root is injected by
 * the caller (the stdio entry resolves it per connection).
 *
 * When served over stdio, stdout is the MCP protocol channel — never log here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { writeFileAtomic, writeFileExclusiveAtomic } from '../lib/atomic-write.js';
import { runLoggedCommand } from '../tools/logged-command.js';
import { appendSkipChecks, createFastPlan, readFastPlan, updateFastStatus } from '../tools/plan-fast.js';
import { syncFastPlan } from '../tools/plan-fast-sync.js';
import { appendPlanIndexRow, assertPlanIndexWritable, readPlanFile } from '../tools/plan-io.js';
import { buildPlanTemplate, PHASE_STATUSES, parsePlan, STATUS_TARGETS, setStatus } from '../tools/plan-lifecycle.js';
import { resolvePlanPath } from '../tools/plan-paths.js';
import { readSheet, sheetSchema, updateSheet } from '../tools/sheet-tools.js';
import { guarded, guardedAsync, textResult } from './tool-results.js';

export interface BuildServerOptions {
  /** Absolute workspace root; plan paths anchor under `<root>/docs/plans`. */
  workspaceRoot: string;
  /** Server version advertised in the MCP `initialize` handshake. */
  version: string;
  /** Optional harness instructions surfaced in the MCP initialize result. */
  instructions?: string;
}

const SERVER_NAME = 'dev-harness-skills';

/** Fresh server instance per connection — never share one across transports. */
export function buildServer({ workspaceRoot, version, instructions }: BuildServerOptions): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version }, { instructions });

  server.registerTool(
    'plan_read',
    {
      description:
        'Parse a phased plan (docs/plans/<slug>/plan.md) into structured JSON: meta, phases[] with status, subTasks[] with phase/status/relatedRequirements/delegatedTo. Input: slug (or path relative to docs/plans). Errors clearly when missing or unparseable.',
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
        if (result.contents !== contents) writeFileAtomic(file, result.contents);
        return textResult({ ok: true, path: file, plan: result.plan });
      })
  );

  server.registerTool(
    'plan_create',
    {
      description:
        'Scaffold a new phased plan (docs/plans/<slug>/plan.md) from a title, objective, and phases with sub-task titles + the responsible agent per sub-task; all statuses start Pending. Optionally append the index.md row.',
      inputSchema: z.object({
        slug: z.string(),
        title: z.string(),
        objective: z.string(),
        phases: z.array(
          z.object({
            title: z.string(),
            subTasks: z.array(
              z.object({
                title: z.string(),
                delegatedTo: z
                  .string()
                  .min(1)
                  .describe('Agent ID responsible for executing this sub-task (must exist in ## Agent Selection)'),
              })
            ),
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
        // Intentional double walk with appendPlanIndexRow's own check:
        // pre-flight here, defense-in-depth there.
        if (updateIndex) assertPlanIndexWritable(workspaceRoot);
        const template = buildPlanTemplate({ slug, title, objective, phases });
        // Parse before writing anything: an invalid scaffold must not leave a
        // broken plan behind (retries would then hit `plan already exists`).
        const plan = parsePlan(template);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        try {
          writeFileExclusiveAtomic(file, template);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`plan already exists: ${file}`);
          throw err;
        }
        if (updateIndex) appendPlanIndexRow(workspaceRoot, slug, title);
        return textResult({ ok: true, path: file, plan });
      })
  );

  server.registerTool(
    'plan_fast_create',
    {
      description:
        'Create docs/plans/<slug>/plan_fast.md from plan.md and seed plan_fast_skip_checks.md with the six standard rows when missing. replace=true recreates only an all-Pending mirror and never overwrites the ledger. Input: slug, optional replace.',
      inputSchema: z.object({
        slug: z.string().describe('Plan slug (docs/plans/<slug>)'),
        replace: z.boolean().describe('Recreate an existing all-Pending fast mirror').optional(),
      }),
    },
    async ({ slug, replace }) => guarded(() => textResult(createFastPlan(workspaceRoot, slug, replace ?? false)))
  );

  server.registerTool(
    'plan_fast_read',
    {
      description:
        'Read/parse plan_fast.md and return the fast plan, source plan path, recomputed source_sha256, the stale flag, and the skipped-check ledger path. Input: slug.',
      inputSchema: z.object({
        slug: z.string().describe('Plan slug (docs/plans/<slug>)'),
      }),
    },
    async ({ slug }) => guarded(() => textResult(readFastPlan(workspaceRoot, slug)))
  );

  server.registerTool(
    'plan_fast_update_status',
    {
      description:
        'Update a phase or sub-task status in BOTH plan_fast.md and plan.md, restoring the fast file if the plan mirror write fails. target=phase→index "N"; target=subtask→"N.M". status ∈ Pending | In Progress | Completed.',
      inputSchema: z.object({
        slug: z.string().describe('Plan slug (docs/plans/<slug>)'),
        target: z.enum(STATUS_TARGETS),
        index: z.string().describe('Phase "N" or sub-task "N.M"'),
        status: z.enum(PHASE_STATUSES),
      }),
    },
    async ({ slug, target, index, status }) =>
      guarded(() => textResult(updateFastStatus(workspaceRoot, slug, target, index, status)))
  );

  server.registerTool(
    'plan_fast_sync',
    {
      description:
        'Compare plan_fast.md with plan.md (structure, statuses, completed phases). Dry-run by default; apply=true mirrors fast→plan only at pre-execution. phase=plan-end is an equality gate: any difference returns requiresConfirmation and never writes.',
      inputSchema: z.object({
        slug: z.string().describe('Plan slug (docs/plans/<slug>)'),
        apply: z.boolean().describe('Apply fast→plan differences and phase closes').optional(),
        phase: z
          .enum(['pre-execution', 'plan-end'])
          .describe('Reconciliation phase (default pre-execution)')
          .optional(),
      }),
    },
    async ({ slug, apply, phase }) =>
      guarded(() => textResult(syncFastPlan(workspaceRoot, slug, apply ?? false, phase ?? 'pre-execution')))
  );

  server.registerTool(
    'plan_fast_skip_check',
    {
      description:
        'Append one or more skipped-check rows to plan_fast_skip_checks.md (append-only), seeding the six standard rows first when the ledger is missing. Input: slug, checks[], scope, reason, disposition.',
      inputSchema: z.object({
        slug: z.string().describe('Plan slug (docs/plans/<slug>)'),
        checks: z.array(z.string()).min(1).describe('Check names to record (one row each)'),
        scope: z.string().describe('Plan, End gates, or Sub-Task N.M'),
        reason: z.string().describe('Why the check was skipped/deferred'),
        disposition: z.string().describe('deferred to end-of-plan | end-of-plan | run: PASS/FAIL | not applicable'),
      }),
    },
    async ({ slug, checks, scope, reason, disposition }) =>
      guarded(() => textResult(appendSkipChecks(workspaceRoot, slug, checks, scope, reason, disposition)))
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
        "Run a command under the logged-execution strategy: output is written to a log file in the SYSTEM TEMP directory, then the first 20 and last 30 lines are returned with a TRUNCATED marker plus the log path for full exploration. Intended for the dh-execute-cli skill; command runs locally with the MCP server's permissions.",
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

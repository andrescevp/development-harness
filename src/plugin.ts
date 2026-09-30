/**
 * dev-harness-skills — OpenCode V2 plugin.
 *
 * Registers the bundled dev harness (7 agents, 15 skills) via
 * synchronous domain transforms. Assets are loaded BEFORE the transforms run
 * (transforms are synchronous; external data must be pre-loaded), resolved
 * from the bundle location (`import.meta.dirname` → dist/assets), NOT from
 * the process CWD.
 *
 * Semantics verified against @opencode/plugin@2.0.18 typings + host source:
 *   - `ctx.agent.transform(editor)`: `editor.update(id, (agent) => void)`
 *     UPSERTS — the host creates plugin-scope agents that do not exist yet
 *     (the built-in agent plugin registers `plan`/`explore`/... the same way)
 *     and mutates existing ones. Frontmatter `tools`/`permission` fold into
 *     the V2 `permissions` ruleset, `model` splits into {id, providerID},
 *     `prompt`/body becomes `system`.
 *   - `ctx.skill.transform(editor)`: `editor.add(skill)` needs the full
 *     Skill.Info shape { id, name, description, path, content }.
 *
 * No command transforms, no prompt registration.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Agent, Skill } from '@opencode/plugin';
import { Plugin } from '@opencode/plugin';
import { loadHarnessAssets } from './lib/assets.js';
import type { AgentRecord, SkillRecord } from './lib/records.js';
import { runLoggedCommand } from './tools/logged-command.js';
import type { PhaseStatus } from './tools/plan-lifecycle.js';
import { buildPlanTemplate, parsePlan, resolvePlanPath, setStatus } from './tools/plan-lifecycle.js';
import { readSheet, sheetSchema, updateSheet } from './tools/sheet-tools.js';

const PLUGIN_ID = 'dev-harness-skills';
const LOG_PREFIX = '[dev-harness-skills]';

function logSummary(agents: AgentRecord[], skills: SkillRecord[], skipped: number): void {
  console.log(
    `${LOG_PREFIX} registered ${agents.length} agents, ${skills.length} skills${skipped ? ` (${skipped} invalid assets skipped)` : ''}`
  );
}

/** Register the bundled agents (upsert via the mutator editor). */
export default Plugin.define({
  id: PLUGIN_ID,
  async setup(ctx: Plugin.Context): Promise<void> {
    // 1. Load ALL assets BEFORE any transform (async setup body, sync reads).
    const { agents, skills, errors } = loadHarnessAssets();
    if (errors.length > 0) {
      console.warn(`${LOG_PREFIX} ${errors.length} asset(s) skipped:`);
      for (const e of errors) console.warn(`  - ${e.file}: ${e.reason}`);
    }

    // 2. Synchronous transforms — registration order: agents, then skills.
    await ctx.agent.transform((editor) => {
      for (const record of agents) {
        editor.update(record.name, (agent) => {
          agent.description = record.description;
          agent.mode = record.mode;
          agent.hidden = false;
          agent.system = record.body;
          agent.permissions = record.permissions;
          if (record.modelId !== undefined) {
            agent.model = {
              id: record.modelId,
              providerID: record.providerId ?? record.modelId,
              ...(record.variant !== undefined ? { variant: record.variant } : {}),
            } as Agent.Info['model'];
          }
        });
      }
    });

    await ctx.skill.transform((editor) => {
      for (const record of skills) {
        editor.add({
          id: record.name,
          name: record.name,
          description: record.description,
          path: record.path,
          content: record.content,
        } as Skill.Info);
      }
    });

    // 3. Plan-lifecycle tools — harness namespace, codemode, workspace-anchored.
    const workspaceRoot = ctx.location?.directory ?? '';
    await registerPlanTools(ctx, workspaceRoot);

    logSummary(agents, skills, errors.length);
  },
});

/** Registration for the plan-lifecycle toolset (namespace `dh`). */
async function registerPlanTools(ctx: Plugin.Context, workspaceRoot: string): Promise<void> {
  await ctx.tool.transform((editor) => {
    editor.namespace({
      name: 'dh',
      description: 'Plan lifecycle tools for phased plans under docs/plans (phases + sub-tasks with statuses)',
    });
    editor.add({
      name: 'plan_read',
      description:
        'Parse a phased plan (docs/plans/<slug>/plan.md) into structured JSON: meta, phases[] with status, subTasks[] with phase/status/relatedRequirements. Input: slug (or path relative to docs/plans). Errors clearly when missing or unparseable.',
      input: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plan slug (docs/plans/<slug>/plan.md)' },
          path: { type: 'string', description: 'Explicit path relative to docs/plans (overrides slug)' },
        },
      },
      options: { namespace: 'dh', codemode: true },
      execute: async (input: unknown) => {
        const { slug, path: relPath } = input as { slug?: string; path?: string };
        const file = resolvePlanPath(workspaceRoot, slug, relPath);
        const contents = readPlanFile(file);
        return { content: JSON.stringify({ ok: true, path: file, plan: parsePlan(contents) }) };
      },
    });

    editor.add({
      name: 'plan_update_status',
      description:
        'Update a phase or sub-task status marker in a phased plan and return the re-parsed plan. target=phase→index "N"; target=subtask→index "N.M". status ∈ Pending | In Progress | Completed. A phase cannot be Completed while any of its sub-tasks is not Completed.',
      input: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          path: { type: 'string', description: 'Explicit path relative to docs/plans (overrides slug)' },
          target: { type: 'string', enum: ['phase', 'subtask'] },
          index: { type: 'string', description: 'Phase "N" or sub-task "N.M"' },
          status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed'] },
        },
        required: ['target', 'index', 'status'],
      },
      options: { namespace: 'dh', codemode: true },
      execute: async (input: unknown) => {
        const {
          slug,
          path: relPath,
          target,
          index,
          status,
        } = input as { slug?: string; path?: string; target: 'phase' | 'subtask'; index: string; status: PhaseStatus };
        const file = resolvePlanPath(workspaceRoot, slug, relPath);
        const contents = readPlanFile(file);
        const result = setStatus(contents, target, index, status);
        fs.writeFileSync(file, result.contents, 'utf8');
        return { content: JSON.stringify({ ok: true, path: file, plan: result.plan }) };
      },
    });

    editor.add({
      name: 'plan_create',
      description:
        'Scaffold a new phased plan (docs/plans/<slug>/plan.md) from a title, objective, and phases with sub-task titles; all statuses start Pending. Optionally append the index.md row.',
      input: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          title: { type: 'string' },
          objective: { type: 'string' },
          phases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                subTasks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' } } } },
              },
            },
          },
          updateIndex: { type: 'boolean', description: 'Append a row to docs/plans/index.md' },
        },
        required: ['slug', 'title', 'objective', 'phases'],
      },
      options: { namespace: 'dh', codemode: true },
      execute: async (input: unknown) => {
        const { slug, title, objective, phases, updateIndex } = input as {
          slug: string;
          title: string;
          objective: string;
          phases: { title: string; subTasks: { title: string }[] }[];
          updateIndex?: boolean;
        };
        const file = resolvePlanPath(workspaceRoot, slug);
        if (fs.existsSync(file)) throw new Error(`plan already exists: ${file}`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, buildPlanTemplate({ slug, title, objective, phases }), 'utf8');
        if (updateIndex && workspaceRoot) {
          const indexFile = path.join(workspaceRoot, 'docs', 'plans', 'index.md');
          if (fs.existsSync(indexFile)) {
            const today = new Date().toISOString().slice(0, 10);
            const desc = title.replace(/\|/g, '\\|');
            const row = `| ${title.replace(/\|/g, '\\|')} | ${slug} | ${desc} | ${today} | ${today} | Pending | Yes |`;
            fs.appendFileSync(indexFile, `${row}\n`, 'utf8');
          }
        }
        const contents = readPlanFile(file);
        return { content: JSON.stringify({ ok: true, path: file, plan: parsePlan(contents) }) };
      },
    });

    editor.add({
      name: 'read_sheet',
      description:
        'Read tabular data (csv/xlsx) with DuckDB: returns columns, rows (JSON) and row count. csv read via read_csv_auto; xlsx via read_xlsx when the extension loads. Optional query (SELECT/WITH/DESCRIBE/SHOW) and limit. Use to retrieve data from generated sheets/documents.',
      input: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the csv/xlsx file' },
          query: { type: 'string', description: 'Optional SQL (SELECT/WITH/DESCRIBE/SHOW) — can use read_csv_auto(?)' },
          limit: { type: 'number', description: 'Max rows to return' },
        },
        required: ['path'],
      },
      options: { namespace: 'dh', codemode: true },
      execute: async (input: unknown) => {
        const { path: sheetPath, query, limit } = input as { path: string; query?: string; limit?: number };
        const result = await readSheet(sheetPath, query, limit);
        return { content: JSON.stringify(result) };
      },
    });

    editor.add({
      name: 'update_sheet',
      description:
        "Apply an UPDATE/INSERT/DELETE query to a csv file via DuckDB and write the result back as CSV (HEADER, OVERWRITE_OR_IGNORE). Reads the file into a temp table named t — reference it in the query (e.g. UPDATE t SET col='x' WHERE id=1). Returns the updated rows + row count.",
      input: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the csv file' },
          query: { type: 'string', description: 'UPDATE/INSERT/DELETE SQL against temp table t' },
        },
        required: ['path', 'query'],
      },
      options: { namespace: 'dh', codemode: true },
      execute: async (input: unknown) => {
        const { path: sheetPath, query } = input as { path: string; query: string };
        const result = await updateSheet(sheetPath, query);
        return { content: JSON.stringify(result) };
      },
    });

    editor.add({
      name: 'sheet_schema',
      description: 'Describe a csv/xlsx file with DuckDB: returns column names + inferred types (column:type).',
      input: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
      options: { namespace: 'dh', codemode: true },
      execute: async (input: unknown) => {
        const { path: sheetPath } = input as { path: string };
        const result = await sheetSchema(sheetPath);
        return { content: JSON.stringify(result) };
      },
    });

    editor.add({
      name: 'logged_command',
      description:
        "Run a command under the logged-execution strategy: output is written to a log file in the SYSTEM TEMP directory, then the first 20 and last 30 lines are returned with a TRUNCATED marker plus the log path for full exploration. Intended for the executor agent; command runs locally with the plugin server's permissions.",
      input: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to run (POSIX shell on linux/macOS; PowerShell on Windows)',
          },
          logName: {
            type: 'string',
            description: 'Optional base name for the log file (always placed in the OS temp dir)',
          },
          timeoutMs: { type: 'number', description: 'Kill after this many milliseconds (default 120000)' },
        },
        required: ['command'],
      },
      options: { namespace: 'dh', codemode: true },
      execute: async (input: unknown) => {
        const { command, logName, timeoutMs } = input as { command: string; logName?: string; timeoutMs?: number };
        const result = await runLoggedCommand({ command, logName, timeoutMs });
        return { content: JSON.stringify(result) };
      },
    });
  });
}

/** Read a plan file with a descriptive error when missing/unreadable. */
function readPlanFile(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    throw new Error(`plan file not readable: ${file}`);
  }
}

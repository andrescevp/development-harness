/**
 * plan-tools.test.ts — MCP parity suite for the plan-lifecycle adapters
 * (plan_read / plan_update_status / plan_create).
 *
 * Covers happy-path payload parity, the error matrix (isError + exact message
 * prefixes), index-row integrity, no-op write behavior, and the accepted
 * schema tightenings — all through the connected in-memory client. Path ACL
 * rejections live in plan-tools-acl.test.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { schemaOf, textOf } from '../../__tests__/helpers/mcp.js';
import type { PlanPayload } from '../../__tests__/helpers/plan-fixtures.js';
import {
  closePlanHarness,
  connectPlanHarness,
  FIXTURE_CONTENTS,
  MARKERLESS_PLAN,
  PLAN_SLUG,
  plansFile,
  plansIndexFile,
  seedPlan,
} from '../../__tests__/helpers/plan-fixtures.js';
import { parsePlan, setStatus } from '../../tools/plan-lifecycle.js';
import { INITIAL_PHASE_STATUS } from '../../tools/plan-template.js';

afterEach(closePlanHarness);

describe('plan_read', () => {
  it('returns the parsed plan payload for a slug', async () => {
    const h = await connectPlanHarness();
    const payload = await h.callToolJson<PlanPayload>('plan_read', { slug: PLAN_SLUG });
    expect(payload).toEqual({
      ok: true,
      path: plansFile(h.workspaceRoot, PLAN_SLUG),
      plan: parsePlan(FIXTURE_CONTENTS),
    });
  });

  it('accepts an explicit path relative to docs/plans', async () => {
    const h = await connectPlanHarness();
    const payload = await h.callToolJson<PlanPayload>('plan_read', { path: `${PLAN_SLUG}/plan.md` });
    expect(payload.ok).toBe(true);
    expect(payload.path).toBe(plansFile(h.workspaceRoot, PLAN_SLUG));
  });

  it('reports unreadable plan files', async () => {
    const h = await connectPlanHarness();
    const res = await h.callTool('plan_read', { slug: 'nope' });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe(`plan file not readable: ${plansFile(h.workspaceRoot, 'nope')}`);
  });
});

describe('plan_update_status', () => {
  it('flips a sub-task, writes the file back, and returns the re-parsed plan', async () => {
    const h = await connectPlanHarness();
    const payload = await h.callToolJson<PlanPayload>('plan_update_status', {
      slug: PLAN_SLUG,
      target: 'subtask',
      index: '1.2',
      status: 'Completed',
    });
    const expected = setStatus(FIXTURE_CONTENTS, 'subtask', '1.2', 'Completed');
    expect(payload).toEqual({ ok: true, path: plansFile(h.workspaceRoot, PLAN_SLUG), plan: expected.plan });
    expect(fs.readFileSync(plansFile(h.workspaceRoot, PLAN_SLUG), 'utf8')).toBe(expected.contents);
  });

  it('keeps CRLF endings stable across a status edit', async () => {
    const crlf = FIXTURE_CONTENTS.replace(/\n/g, '\r\n');
    const h = await connectPlanHarness((root) => seedPlan(root, PLAN_SLUG, crlf));
    const payload = await h.callToolJson<PlanPayload>('plan_update_status', {
      slug: PLAN_SLUG,
      target: 'subtask',
      index: '1.2',
      status: 'Completed',
    });
    expect(payload.plan).toEqual(setStatus(crlf, 'subtask', '1.2', 'Completed').plan);
    const written = fs.readFileSync(plansFile(h.workspaceRoot, PLAN_SLUG), 'utf8');
    expect(written.replace(/\r\n/g, '')).not.toContain('\n');
    expect(written).toContain('- **Status:** Completed\r\n');
  });

  it('does not rewrite the file when the status is unchanged (no-op)', async () => {
    const h = await connectPlanHarness();
    const file = plansFile(h.workspaceRoot, PLAN_SLUG);
    const mtimeBefore = fs.statSync(file).mtimeMs;
    const payload = await h.callToolJson<PlanPayload>('plan_update_status', {
      slug: PLAN_SLUG,
      target: 'subtask',
      index: '1.1', // already Completed in the fixture
      status: 'Completed',
    });
    expect(payload.ok).toBe(true);
    expect(fs.statSync(file).mtimeMs).toBe(mtimeBefore);
  });

  it('refuses to complete a phase with open sub-tasks', async () => {
    const h = await connectPlanHarness();
    const res = await h.callTool('plan_update_status', {
      slug: PLAN_SLUG,
      target: 'phase',
      index: '1',
      status: 'Completed',
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe('phase 1 cannot complete: sub-task 1.2 is In Progress');
  });

  it('reports a missing ref', async () => {
    const h = await connectPlanHarness();
    const res = await h.callTool('plan_update_status', {
      slug: PLAN_SLUG,
      target: 'phase',
      index: '9',
      status: 'Pending',
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe("phase ref '9' not found");
  });

  it('reports a section without a status marker', async () => {
    const h = await connectPlanHarness((root) => seedPlan(root, 'markerless', MARKERLESS_PLAN));
    const res = await h.callTool('plan_update_status', {
      slug: 'markerless',
      target: 'subtask',
      index: '1.1',
      status: 'Completed',
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe("subtask '1.1' has no status marker");
  });
});

describe('plan_create', () => {
  it('scaffolds a plan readable by plan_read (roundtrip)', async () => {
    const h = await connectPlanHarness();
    const created = await h.callToolJson<PlanPayload>('plan_create', {
      slug: 'new-plan',
      title: 'New Plan',
      objective: 'Demo roundtrip',
      phases: [{ title: 'Phase One', subTasks: [{ title: 'First task' }] }],
    });
    expect(created.ok).toBe(true);
    expect(created.path).toBe(plansFile(h.workspaceRoot, 'new-plan'));
    expect(created.plan.title).toBe('New Plan');
    // Scaffolded statuses come from the single-sourced initial-status constant.
    expect(created.plan.phases[0]?.status).toBe(INITIAL_PHASE_STATUS);
    expect(created.plan.phases[0]?.subTasks[0]?.status).toBe(INITIAL_PHASE_STATUS);
    const read = await h.callToolJson<PlanPayload>('plan_read', { slug: 'new-plan' });
    expect(read.plan).toEqual(created.plan);
  });

  it('appends the index row byte-identically when updateIndex is true', async () => {
    const h = await connectPlanHarness((root) => {
      seedPlan(root);
      fs.writeFileSync(plansIndexFile(root), '# Plans\n', 'utf8');
    });
    const created = await h.callToolJson<PlanPayload>('plan_create', {
      slug: 'indexed',
      title: 'Indexed | Plan',
      objective: 'Index row',
      phases: [{ title: 'P', subTasks: [{ title: 'T' }] }],
      updateIndex: true,
    });
    expect(created.ok).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    const index = fs.readFileSync(plansIndexFile(h.workspaceRoot), 'utf8');
    expect(index).toBe(
      `# Plans\n| Indexed \\| Plan | indexed | Indexed \\| Plan | ${today} | ${today} | Pending | Yes |\n`
    );
  });

  it('rejects a structure-invalid scaffold before writing anything', async () => {
    const h = await connectPlanHarness();
    const file = plansFile(h.workspaceRoot, 'empty-phases');
    const res = await h.callTool('plan_create', {
      slug: 'empty-phases',
      title: 'Empty',
      objective: 'o',
      phases: [],
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe('not a phased plan: no `### Phase N:` headers found');
    // Nothing was created — no plan file, not even its parent dir.
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(path.dirname(file))).toBe(false);
    expect(fs.existsSync(plansFile(h.workspaceRoot, PLAN_SLUG))).toBe(true);
  });

  it('refuses an existing slug', async () => {
    const h = await connectPlanHarness();
    const res = await h.callTool('plan_create', {
      slug: PLAN_SLUG,
      title: 'X',
      objective: 'o',
      phases: [{ title: 'P', subTasks: [] }],
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe(`plan already exists: ${plansFile(h.workspaceRoot, PLAN_SLUG)}`);
  });

  it('skips the index silently when no index.md exists', async () => {
    const h = await connectPlanHarness();
    const created = await h.callToolJson<PlanPayload>('plan_create', {
      slug: 'no-index',
      title: 'No Index',
      objective: 'o',
      phases: [{ title: 'P', subTasks: [] }],
      updateIndex: true,
    });
    expect(created.ok).toBe(true);
    expect(fs.existsSync(plansIndexFile(h.workspaceRoot))).toBe(false);
  });
});

describe('input schema tightenings (accepted deviations)', () => {
  it('pins required/enum on plan_update_status (SDK input-flavor schema)', async () => {
    const h = await connectPlanHarness();
    const { tools } = await h.listTools();
    const schema = schemaOf(tools, 'plan_update_status');
    expect(schema.required).toEqual(['target', 'index', 'status']);
    expect(schema.properties?.target?.enum).toEqual(['phase', 'subtask']);
    expect(schema.properties?.status?.enum).toEqual(['Pending', 'In Progress', 'Completed']);
    // zod's `additionalProperties: false` is NOT surfaced: the SDK lists the
    // schema in its `io: 'input'` flavor (see the tolerated-extras test).
    expect(schema.additionalProperties).toBeUndefined();
  });

  it('tolerates extra arguments (input-flavor schema, no additionalProperties)', async () => {
    const h = await connectPlanHarness();
    const res = await h.callTool('plan_read', { slug: PLAN_SLUG, extra: 1 });
    expect(res.isError).toBeFalsy();
  });

  it('pins nested-required on plan_create phases (zod tightening)', async () => {
    const h = await connectPlanHarness();
    const { tools } = await h.listTools();
    const phases = schemaOf(tools, 'plan_create').properties?.phases;
    expect(phases?.items?.required).toEqual(['title', 'subTasks']);
    expect(phases?.items?.properties?.subTasks?.items?.required).toEqual(['title']);
  });

  it('rejects an unknown status enum value before the handler (SDK deviation)', async () => {
    const h = await connectPlanHarness();
    const res = await h.callTool('plan_update_status', {
      slug: PLAN_SLUG,
      target: 'subtask',
      index: '1.2',
      status: 'Done',
    });
    expect(res.isError).toBe(true);
    // Pinned SDK form (accepted deviation from the legacy "invalid status" text).
    expect(textOf(res)).toBe(
      'Input validation error: Invalid arguments for tool plan_update_status: status: Invalid option: expected one of "Pending"|"In Progress"|"Completed"'
    );
  });
});

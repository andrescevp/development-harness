/**
 * plan-tools-create.test.ts — `plan_create` scaffold parity, input hardening
 * (single-line titles, worktree scope, round-trip) and accepted schema
 * deviations. Read/update behavior lives in plan-tools.test.ts; path ACL
 * rejections in plan-tools-acl.test.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { schemaOf, textOf } from '../../__tests__/helpers/mcp.js';
import type { PlanPayload } from '../../__tests__/helpers/plan-fixtures.js';
import {
  closePlanHarness,
  connectPlanHarness,
  PLAN_SLUG,
  plansFile,
  plansIndexFile,
  seedPlan,
} from '../../__tests__/helpers/plan-fixtures.js';
import { INITIAL_PHASE_STATUS } from '../../tools/plan-template.js';

afterEach(closePlanHarness);

describe('plan_create', () => {
  it('scaffolds a plan readable by plan_read (roundtrip)', async () => {
    const h = await connectPlanHarness();
    const created = await h.callToolJson<PlanPayload>('plan_create', {
      slug: 'new-plan',
      title: 'New Plan',
      objective: 'Demo roundtrip',
      phases: [{ title: 'Phase One', subTasks: [{ title: 'First task', delegatedTo: 'dh-software-engineer' }] }],
    });
    expect(created.ok).toBe(true);
    expect(created.path).toBe(plansFile(h.workspaceRoot, 'new-plan'));
    expect(created.plan.title).toBe('New Plan');
    // Scaffolded statuses come from the single-sourced initial-status constant.
    expect(created.plan.phases[0]?.status).toBe(INITIAL_PHASE_STATUS);
    expect(created.plan.phases[0]?.subTasks[0]?.status).toBe(INITIAL_PHASE_STATUS);
    expect(created.plan.phases[0]?.subTasks[0]?.delegatedTo).toBe('dh-software-engineer');
    const read = await h.callToolJson<PlanPayload>('plan_read', { slug: 'new-plan' });
    expect(read.plan).toEqual(created.plan);
  });

  it('scaffolds parallel metadata when provided', async () => {
    const h = await connectPlanHarness();
    const created = await h.callToolJson<PlanPayload>('plan_create', {
      slug: 'parallel-new',
      title: 'Parallel New',
      objective: 'Demo parallel metadata',
      phases: [
        {
          title: 'Backend',
          parallelizable: true,
          dependsOn: [],
          subTasks: [
            {
              title: 'API',
              delegatedTo: 'dh-software-engineer',
              parallelizable: true,
              dependsOn: [],
              filesScope: ['services/api/**'],
              isolation: 'shared',
            },
          ],
        },
      ],
    });
    expect(created.plan.phases[0]?.parallelizable).toBe(true);
    expect(created.plan.phases[0]?.subTasks[0]?.parallelizable).toBe(true);
    expect(created.plan.phases[0]?.subTasks[0]?.filesScope).toEqual(['services/api/**']);
    const text = fs.readFileSync(created.path, 'utf8');
    expect(text).toContain('- **Parallelizable:** yes');
    expect(text).toContain('- **Files/Scope:** services/api/**');
    expect(text).toContain('- **Isolation:** shared');
  });

  it('quotes YAML-sensitive titles so they round-trip', async () => {
    const h = await connectPlanHarness();
    const created = await h.callToolJson<PlanPayload>('plan_create', {
      slug: 'quoted-title',
      title: 'Deploy: API "v2" #1',
      objective: 'o',
      phases: [{ title: 'P: one', subTasks: [{ title: 'T: two', delegatedTo: 'dh-software-engineer' }] }],
    });
    expect(created.plan.title).toBe('Deploy: API "v2" #1');
    expect(created.plan.phases[0]?.title).toBe('P: one');
    expect(created.plan.phases[0]?.subTasks[0]?.title).toBe('T: two');
  });

  it('rejects an empty sub-task title before writing anything', async () => {
    const h = await connectPlanHarness();
    const file = plansFile(h.workspaceRoot, 'empty-title');
    const res = await h.callTool('plan_create', {
      slug: 'empty-title',
      title: 'Empty title',
      objective: 'o',
      phases: [{ title: 'P', subTasks: [{ title: '   ', delegatedTo: 'dh-software-engineer' }] }],
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/title/);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('rejects newline injection in titles, agents and scopes', async () => {
    const h = await connectPlanHarness();
    const file = plansFile(h.workspaceRoot, 'injected');
    const res = await h.callTool('plan_create', {
      slug: 'injected',
      title: 'Injected',
      objective: 'o',
      phases: [
        {
          title: 'P',
          subTasks: [
            {
              title: 'T',
              delegatedTo: 'dh-software-engineer\n- **Status:** In Progress',
            },
          ],
        },
      ],
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/single line/);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('rejects worktree isolation without a Files/Scope before writing', async () => {
    const h = await connectPlanHarness();
    const file = plansFile(h.workspaceRoot, 'worktree-no-scope');
    const res = await h.callTool('plan_create', {
      slug: 'worktree-no-scope',
      title: 'Worktree',
      objective: 'o',
      phases: [
        {
          title: 'P',
          subTasks: [{ title: 'T', delegatedTo: 'dh-software-engineer', isolation: 'worktree' }],
        },
      ],
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/Files\/Scope/);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('round-trips non-empty dependencies and worktree metadata through plan_read', async () => {
    const h = await connectPlanHarness();
    const created = await h.callToolJson<PlanPayload>('plan_create', {
      slug: 'worktree-meta',
      title: 'Worktree metadata',
      objective: 'o',
      phases: [
        {
          title: 'P',
          subTasks: [
            { title: 'First', delegatedTo: 'dh-software-engineer' },
            {
              title: 'Second',
              delegatedTo: 'dh-software-engineer',
              dependsOn: ['1.1'],
              filesScope: ['src/**/*.{ts,tsx}'],
              isolation: 'worktree',
            },
          ],
        },
      ],
    });
    expect(created.ok).toBe(true);
    const read = await h.callToolJson<PlanPayload>('plan_read', { slug: 'worktree-meta' });
    const sub = read.plan.phases[0]?.subTasks[1];
    expect(sub?.dependsOn).toEqual(['1.1']);
    expect(sub?.filesScope).toEqual(['src/**/*.{ts,tsx}']);
    expect(sub?.isolation).toBe('worktree');
  });

  it('rejects a sub-task without delegatedTo before writing anything', async () => {
    const h = await connectPlanHarness();
    const file = plansFile(h.workspaceRoot, 'missing-delegation');
    const res = await h.callTool('plan_create', {
      slug: 'missing-delegation',
      title: 'Missing delegation',
      objective: 'Must fail',
      phases: [{ title: 'P', subTasks: [{ title: 'T' }] }],
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/delegatedTo/);
    expect(fs.existsSync(file)).toBe(false);
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
      phases: [{ title: 'P', subTasks: [{ title: 'T', delegatedTo: 'dh-documentor' }] }],
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
    expect(phases?.items?.properties?.subTasks?.items?.required).toEqual(['title', 'delegatedTo']);
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

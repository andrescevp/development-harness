/**
 * plan-fast-sync.test.ts — sync/apply semantics and path ACL rejections for
 * the fast-plan tool family. Create/read/status/ledger live in
 * plan-fast-tools.test.ts.
 */
import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { McpTestHarness } from '../../__tests__/helpers/mcp.js';
import { textOf } from '../../__tests__/helpers/mcp.js';
import { closePlanHarness, connectPlanHarness, PLAN_SLUG, plansFile } from '../../__tests__/helpers/plan-fixtures.js';
import { setStatus } from '../../tools/plan-lifecycle.js';
import type { SyncPayload } from './helpers/plan-fast-fixtures.js';
import { createFast, diskPlan, fastFile } from './helpers/plan-fast-fixtures.js';

afterEach(closePlanHarness);

async function advanceFastOnly(root: string): Promise<void> {
  const file = fastFile(root);
  fs.writeFileSync(file, setStatus(fs.readFileSync(file, 'utf8'), 'subtask', '1.2', 'Completed').contents);
}

async function applyAndExpectOk(
  h: McpTestHarness
): Promise<{ plan: ReturnType<typeof diskPlan>; fast: ReturnType<typeof diskPlan> }> {
  const applied = await h.callToolJson<SyncPayload>('plan_fast_sync', { slug: PLAN_SLUG, apply: true });
  expect(applied).toMatchObject({ ok: true, applied: true, stale: false });
  expect(applied.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
  return { plan: diskPlan(plansFile(h.workspaceRoot, PLAN_SLUG)), fast: diskPlan(fastFile(h.workspaceRoot)) };
}

async function expectPlanEndBlocked(h: McpTestHarness): Promise<SyncPayload> {
  const fastPath = fastFile(h.workspaceRoot);
  const planPath = plansFile(h.workspaceRoot, PLAN_SLUG);
  const fastBefore = fs.readFileSync(fastPath, 'utf8');
  const planBefore = fs.readFileSync(planPath, 'utf8');
  const blocked = await h.callToolJson<SyncPayload>('plan_fast_sync', {
    slug: PLAN_SLUG,
    phase: 'plan-end',
    apply: true,
  });
  expect(blocked).toMatchObject({ ok: false, requiresConfirmation: true });
  expect(fs.readFileSync(fastPath, 'utf8')).toBe(fastBefore);
  expect(fs.readFileSync(planPath, 'utf8')).toBe(planBefore);
  return blocked;
}

describe('plan_fast_sync', () => {
  it('reports fast-ahead differences and applies them fast→plan', async () => {
    const h = await connectPlanHarness();
    await createFast(h);
    await advanceFastOnly(h.workspaceRoot);

    const dry = await h.callToolJson<SyncPayload>('plan_fast_sync', { slug: PLAN_SLUG });
    expect(dry.ok).toBe(true);
    expect(dry.aligned).toBe(false);
    expect(dry.stale).toBe(false);
    expect(dry.differences.find((d) => d.ref === '1.2' && d.action === 'mirror-fast-to-plan')).toMatchObject({
      kind: 'subtask',
      planStatus: 'In Progress',
      fastStatus: 'Completed',
      severity: 'P2',
    });

    const { plan, fast } = await applyAndExpectOk(h);
    expect(plan.phases[0]?.subTasks[1]?.status).toBe('Completed');
    expect(plan.phases[0]?.status).toBe('Completed');
    expect(fast.phases[0]?.status).toBe('Completed');
    expect((await h.callToolJson<SyncPayload>('plan_fast_sync', { slug: PLAN_SLUG })).aligned).toBe(true);
  });

  it('escalates fast-ahead to P1 and blocks apply at plan end', async () => {
    const h = await connectPlanHarness();
    await createFast(h);
    await advanceFastOnly(h.workspaceRoot);
    const planPath = plansFile(h.workspaceRoot, PLAN_SLUG);
    const end = await h.callToolJson<SyncPayload>('plan_fast_sync', { slug: PLAN_SLUG, phase: 'plan-end' });
    expect(end.differences.find((d) => d.ref === '1.2')?.severity).toBe('P1');
    await expectPlanEndBlocked(h);
    expect(diskPlan(planPath).phases[0]?.subTasks[1]?.status).toBe('In Progress');
  });

  it('blocks phase closes at plan end (equality gate)', async () => {
    const h = await connectPlanHarness();
    await createFast(h);
    await h.callToolJson('plan_fast_update_status', {
      slug: PLAN_SLUG,
      target: 'subtask',
      index: '1.2',
      status: 'Completed',
    });
    const fastPath = fastFile(h.workspaceRoot);
    const dry = await h.callToolJson<SyncPayload>('plan_fast_sync', { slug: PLAN_SLUG, phase: 'plan-end' });
    expect(dry.differences.some((d) => d.action === 'close-phase')).toBe(true);
    await expectPlanEndBlocked(h);
    expect(diskPlan(fastPath).phases[0]?.status).toBe('In Progress');
  });

  it('applies sub-task mirrors before a phase completion', async () => {
    const h = await connectPlanHarness();
    await createFast(h);
    const fastPath = fastFile(h.workspaceRoot);
    let fastText = setStatus(fs.readFileSync(fastPath, 'utf8'), 'subtask', '1.2', 'Completed').contents;
    fastText = setStatus(fastText, 'phase', '1', 'Completed').contents;
    fs.writeFileSync(fastPath, fastText);
    const { plan } = await applyAndExpectOk(h);
    expect(plan.phases[0]?.subTasks[1]?.status).toBe('Completed');
    expect(plan.phases[0]?.status).toBe('Completed');
  });

  it('requires confirmation for plan-ahead', async () => {
    const h = await connectPlanHarness();
    await createFast(h);
    await h.callToolJson('plan_update_status', {
      slug: PLAN_SLUG,
      target: 'subtask',
      index: '1.2',
      status: 'Completed',
    });
    const planAhead = await h.callToolJson<SyncPayload>('plan_fast_sync', { slug: PLAN_SLUG });
    expect(planAhead.differences.find((d) => d.ref === '1.2' && d.action === 'plan-ahead')?.severity).toBe('P1');
    const blocked = await h.callToolJson<SyncPayload>('plan_fast_sync', { slug: PLAN_SLUG, apply: true });
    expect(blocked).toMatchObject({ ok: false, requiresConfirmation: true });
    expect(diskPlan(fastFile(h.workspaceRoot)).phases[0]?.subTasks[1]?.status).toBe('In Progress');
  });

  it('requires confirmation for structure mismatches', async () => {
    const h = await connectPlanHarness();
    await createFast(h);
    const planPath = plansFile(h.workspaceRoot, PLAN_SLUG);
    fs.writeFileSync(
      planPath,
      fs.readFileSync(planPath, 'utf8').replace('### Phase 1: Foundation', '### Phase 1: Renamed')
    );
    const structural = await h.callToolJson<SyncPayload>('plan_fast_sync', { slug: PLAN_SLUG });
    expect(structural.differences.some((d) => d.kind === 'structure' && d.severity === 'P0')).toBe(true);
    const blocked = await h.callToolJson<SyncPayload>('plan_fast_sync', { slug: PLAN_SLUG, apply: true });
    expect(blocked).toMatchObject({ ok: false, requiresConfirmation: true });
  });
});

describe('path ACL rejections', () => {
  it('rejects traversal slugs on every fast tool', async () => {
    const h = await connectPlanHarness();
    const calls: [string, Record<string, unknown>][] = [
      ['plan_fast_create', { slug: '../evil' }],
      ['plan_fast_read', { slug: '../evil' }],
      ['plan_fast_update_status', { slug: '../evil', target: 'subtask', index: '1.1', status: 'Pending' }],
      ['plan_fast_sync', { slug: '../evil' }],
      [
        'plan_fast_skip_check',
        { slug: '../evil', checks: ['dh-review'], scope: 'Plan', reason: 'x', disposition: 'end-of-plan' },
      ],
    ];
    for (const [name, args] of calls) {
      const res = await h.callTool(name, args);
      expect(res.isError).toBe(true);
      expect(textOf(res)).toBe('invalid slug: ../evil');
    }
  });

  it('rejects slugs containing separators', async () => {
    const h = await connectPlanHarness();
    const res = await h.callTool('plan_fast_skip_check', {
      slug: 'a/b',
      checks: ['dh-review'],
      scope: 'Plan',
      reason: 'x',
      disposition: 'end-of-plan',
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe('invalid slug: a/b');
  });
});

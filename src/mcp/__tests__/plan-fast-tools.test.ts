/**
 * plan-fast-tools.test.ts — MCP parity suite for the fast-plan tool family
 * (plan_fast_create/read/update_status/skip_check).
 *
 * Covers the create/read round-trip + seeded ledger, source-hash staleness,
 * dual-plan status writes and rollback gates, and append-only ledger rows.
 * Sync semantics live in plan-fast-sync.test.ts.
 */
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { McpTestHarness } from '../../__tests__/helpers/mcp.js';
import { textOf } from '../../__tests__/helpers/mcp.js';
import {
  closePlanHarness,
  connectPlanHarness,
  FIXTURE_CONTENTS,
  PLAN_SLUG,
  plansFile,
} from '../../__tests__/helpers/plan-fixtures.js';
import type { FastCreatePayload, FastReadPayload, FastStatusPayload } from './helpers/plan-fast-fixtures.js';
import { createFast, diskPlan, fastFile, ledgerFile } from './helpers/plan-fast-fixtures.js';

afterEach(async () => {
  vi.restoreAllMocks();
  await closePlanHarness();
});

function mockPlanWriteFailure(fastPath: string, planPath: string, failRestore: boolean): void {
  const realRename = fs.renameSync.bind(fs);
  let fastRenames = 0;
  vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
    if (String(to) === planPath) throw new Error('plan write failed');
    if (String(to) === fastPath) {
      fastRenames += 1;
      if (failRestore && fastRenames === 2) throw new Error('restore failed');
    }
    realRename(from, to);
  });
}

async function updateToCompletedAndExpectFailure(h: McpTestHarness): Promise<void> {
  const res = await h.callTool('plan_fast_update_status', {
    slug: PLAN_SLUG,
    target: 'subtask',
    index: '1.2',
    status: 'Completed',
  });
  expect(res.isError).toBe(true);
  expect(textOf(res)).toBe('plan write failed');
}

describe('plan_fast_create / plan_fast_read', () => {
  it('creates the mirror + seeded ledger and reads it back', async () => {
    const h = await connectPlanHarness();
    const created = await createFast(h);
    expect(created.ok).toBe(true);
    expect(created.path).toBe(fastFile(h.workspaceRoot));
    expect(created.skipChecksPath).toBe(ledgerFile(h.workspaceRoot));
    expect(created.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(created.plan.title).toBe('Example Phased Plan — Fast Execution');
    expect(created.plan.phases).toHaveLength(2);
    expect(created.plan.phases.flatMap((p) => p.subTasks)).toHaveLength(3);

    const fastText = fs.readFileSync(created.path, 'utf8');
    expect(fastText).toContain('## Phases');
    expect(fastText).toContain('## Final Verification');
    expect(fastText).toContain('System-Wide Test');
    expect(fastText).not.toContain('\n## Objective\n');
    expect(fastText).not.toContain('\n## Scope\n');
    expect(created.plan.meta.source_plan).toBe('plan.md');
    expect(created.plan.meta.status).toBe('In Progress');

    const ledger = fs.readFileSync(created.skipChecksPath, 'utf8');
    expect(ledger).toContain('| Timestamp | Check | Scope | Reason | Disposition |');
    for (const check of [
      'dh-review',
      'dh-simplify',
      'dh-code-review',
      'dh-domain-check',
      'dh-preflight',
      'dh-artifact-check',
    ]) {
      expect(ledger).toContain(`| ${check} | Plan |`);
    }
    expect(ledger).toContain('conditional at plan end');

    const read = await h.callToolJson<FastReadPayload>('plan_fast_read', { slug: PLAN_SLUG });
    expect(read).toMatchObject({
      ok: true,
      path: created.path,
      sourcePlanPath: plansFile(h.workspaceRoot, PLAN_SLUG),
      sourceSha256: created.sourceSha256,
      stale: false,
      skipChecksPath: created.skipChecksPath,
    });
    expect(read.plan.phases.map((p) => p.title)).toEqual(['Foundation', 'Execution']);
  });

  it('refuses an existing mirror and replaces only when everything is Pending', async () => {
    const h = await connectPlanHarness();
    await createFast(h);
    const again = await h.callTool('plan_fast_create', { slug: PLAN_SLUG });
    expect(again.isError).toBe(true);
    expect(textOf(again)).toBe(`plan_fast already exists: ${fastFile(h.workspaceRoot)}`);

    const inProgress = await h.callTool('plan_fast_create', { slug: PLAN_SLUG, replace: true });
    expect(inProgress.isError).toBe(true);
    expect(textOf(inProgress)).toBe('cannot replace a plan_fast with execution progress');

    await h.callToolJson('plan_create', {
      slug: 'pending-fast',
      title: 'Pending Plan',
      objective: 'All pending',
      phases: [{ title: 'P', subTasks: [{ title: 'T' }] }],
    });
    await createFast(h, 'pending-fast');
    const replaced = await h.callToolJson<FastCreatePayload>('plan_fast_create', {
      slug: 'pending-fast',
      replace: true,
    });
    expect(replaced.ok).toBe(true);
  });

  it('reports missing mirrors and plans with exact errors', async () => {
    const h = await connectPlanHarness();
    const missing = await h.callTool('plan_fast_read', { slug: 'nope' });
    expect(missing.isError).toBe(true);
    expect(textOf(missing)).toBe(`plan_fast not found: ${fastFile(h.workspaceRoot, 'nope')} (run plan_fast_create)`);

    const noPlan = await h.callTool('plan_fast_create', { slug: 'no-plan' });
    expect(noPlan.isError).toBe(true);
    expect(textOf(noPlan)).toContain('plan file not readable:');
  });
});

describe('source hash staleness', () => {
  it('ignores status-only edits and detects body edits', async () => {
    const h = await connectPlanHarness();
    await createFast(h);
    await h.callToolJson('plan_update_status', {
      slug: PLAN_SLUG,
      target: 'subtask',
      index: '1.2',
      status: 'Completed',
    });
    const afterStatus = await h.callToolJson<FastReadPayload>('plan_fast_read', { slug: PLAN_SLUG });
    expect(afterStatus.stale).toBe(false);

    const planPath = plansFile(h.workspaceRoot, PLAN_SLUG);
    fs.writeFileSync(planPath, FIXTURE_CONTENTS.replace('Validate the phased plan', 'Changed plan body'), 'utf8');
    const afterBody = await h.callToolJson<FastReadPayload>('plan_fast_read', { slug: PLAN_SLUG });
    expect(afterBody.stale).toBe(true);
  });
});

describe('plan_fast_update_status', () => {
  it('mirrors a sub-task status into both plans', async () => {
    const h = await connectPlanHarness();
    await createFast(h);
    const updated = await h.callToolJson<FastStatusPayload>('plan_fast_update_status', {
      slug: PLAN_SLUG,
      target: 'subtask',
      index: '1.2',
      status: 'Completed',
    });
    expect(updated.path).toBe(fastFile(h.workspaceRoot));
    expect(updated.mirroredPath).toBe(plansFile(h.workspaceRoot, PLAN_SLUG));
    expect(updated.plan.phases[0]?.subTasks[1]?.status).toBe('Completed');
    expect(updated.mirroredPlan.phases[0]?.subTasks[1]?.status).toBe('Completed');
    expect(diskPlan(updated.path).phases[0]?.subTasks[1]?.status).toBe('Completed');
    expect(diskPlan(updated.mirroredPath).phases[0]?.subTasks[1]?.status).toBe('Completed');
  });

  it('validates the phase gate before writing either plan', async () => {
    const h = await connectPlanHarness();
    await createFast(h);
    const fastBefore = fs.readFileSync(fastFile(h.workspaceRoot), 'utf8');
    const planBefore = fs.readFileSync(plansFile(h.workspaceRoot, PLAN_SLUG), 'utf8');
    const res = await h.callTool('plan_fast_update_status', {
      slug: PLAN_SLUG,
      target: 'phase',
      index: '1',
      status: 'Completed',
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe('phase 1 cannot complete: sub-task 1.2 is In Progress');
    expect(fs.readFileSync(fastFile(h.workspaceRoot), 'utf8')).toBe(fastBefore);
    expect(fs.readFileSync(plansFile(h.workspaceRoot, PLAN_SLUG), 'utf8')).toBe(planBefore);
  });

  it('restores plan_fast when the plan.md mirror write fails', async () => {
    const h = await connectPlanHarness();
    await createFast(h);
    const fastPath = fastFile(h.workspaceRoot);
    const planPath = plansFile(h.workspaceRoot, PLAN_SLUG);
    const fastBefore = fs.readFileSync(fastPath, 'utf8');
    const planBefore = fs.readFileSync(planPath, 'utf8');
    mockPlanWriteFailure(fastPath, planPath, false);
    await updateToCompletedAndExpectFailure(h);
    expect(fs.readFileSync(fastPath, 'utf8')).toBe(fastBefore);
    expect(fs.readFileSync(planPath, 'utf8')).toBe(planBefore);
    expect(diskPlan(fastPath).phases[0]?.subTasks[1]?.status).toBe('In Progress');
  });

  it('reports the original error when the plan_fast restore also fails', async () => {
    const h = await connectPlanHarness();
    await createFast(h);
    const fastPath = fastFile(h.workspaceRoot);
    const planPath = plansFile(h.workspaceRoot, PLAN_SLUG);
    const planBefore = fs.readFileSync(planPath, 'utf8');
    mockPlanWriteFailure(fastPath, planPath, true);
    await updateToCompletedAndExpectFailure(h);
    expect(fs.readFileSync(planPath, 'utf8')).toBe(planBefore);
    expect(diskPlan(fastPath).phases[0]?.subTasks[1]?.status).toBe('Completed');
  });
});

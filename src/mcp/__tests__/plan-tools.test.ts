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
import { textOf } from '../../__tests__/helpers/mcp.js';
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

afterEach(closePlanHarness);

describe('plan_read', () => {
  it('returns the parsed plan payload for a slug', async () => {
    const h = await connectPlanHarness();
    const payload = await h.callToolJson<PlanPayload & { issues: unknown[] }>('plan_read', { slug: PLAN_SLUG });
    expect(payload.ok).toBe(true);
    expect(payload.path).toBe(plansFile(h.workspaceRoot, PLAN_SLUG));
    expect(payload.plan).toEqual(parsePlan(FIXTURE_CONTENTS));
    expect(payload.issues).toEqual([
      expect.objectContaining({ severity: 'warning', code: 'parallel-subtask-in-sequential-phase', ref: '1.2' }),
    ]);
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

  it('surfaces error-severity scheduling issues for hand-written plans', async () => {
    const invalid = `---
title: Invalid
slug: invalid
---

## Phases

### Phase 1: P

- **Status:** Pending

#### Sub-Task 1.1: T

- **Status:** Pending
- **Delegated to agent:** dh-software-engineer
- **Isolation:** worktree
`;
    const h = await connectPlanHarness((root) => seedPlan(root, 'invalid', invalid));
    const payload = await h.callToolJson<PlanPayload & { issues: unknown[] }>('plan_read', { slug: 'invalid' });
    expect(payload.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ severity: 'error', code: 'worktree-without-scope' })])
    );
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

describe('atomic writes', () => {
  it('leaves no temp files behind after atomic writes', async () => {
    const h = await connectPlanHarness((root) => {
      seedPlan(root);
      fs.writeFileSync(plansIndexFile(root), '# Plans\n', 'utf8');
    });
    await h.callToolJson('plan_update_status', {
      slug: PLAN_SLUG,
      target: 'subtask',
      index: '1.2',
      status: 'Completed',
    });
    await h.callToolJson('plan_create', {
      slug: 'atomic',
      title: 'Atomic',
      objective: 'o',
      phases: [{ title: 'P', subTasks: [] }],
      updateIndex: true,
    });
    const planDir = path.dirname(plansFile(h.workspaceRoot, PLAN_SLUG));
    const residue = [...fs.readdirSync(planDir), ...fs.readdirSync(path.dirname(planDir))].filter((name) =>
      name.endsWith('.tmp')
    );
    expect(residue).toEqual([]);
  });
});

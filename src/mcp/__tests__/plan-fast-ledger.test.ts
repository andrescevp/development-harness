/**
 * plan-fast-ledger.test.ts — skipped-check ledger contract.
 *
 * Covers the append-only rows, create-missing seeding, the replace safeguard
 * (existing rows stay byte-identical), and the fast-plan precondition.
 */
import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { textOf } from '../../__tests__/helpers/mcp.js';
import { closePlanHarness, connectPlanHarness, PLAN_SLUG } from '../../__tests__/helpers/plan-fixtures.js';
import type { FastCreatePayload, SkipPayload } from './helpers/plan-fast-fixtures.js';
import { createFast, fastFile } from './helpers/plan-fast-fixtures.js';

afterEach(closePlanHarness);

describe('plan_fast_skip_check', () => {
  it('preserves existing ledger rows on replace (byte-identical)', async () => {
    const h = await connectPlanHarness();
    await h.callToolJson('plan_create', {
      slug: 'replace-ledger',
      title: 'Replace Ledger',
      objective: 'Keep the ledger',
      phases: [{ title: 'P', subTasks: [{ title: 'T' }] }],
    });
    const created = await createFast(h, 'replace-ledger');
    await h.callToolJson('plan_fast_skip_check', {
      slug: 'replace-ledger',
      checks: ['dh-review'],
      scope: 'End gates',
      reason: 'gate run',
      disposition: 'run: PASS',
    });
    const before = fs.readFileSync(created.skipChecksPath, 'utf8');
    expect(before).toContain('| dh-review | End gates |');

    const replaced = await h.callToolJson<FastCreatePayload>('plan_fast_create', {
      slug: 'replace-ledger',
      replace: true,
    });
    expect(replaced.ok).toBe(true);
    expect(fs.readFileSync(created.skipChecksPath, 'utf8')).toBe(before);
    expect(before).toContain('| dh-code-review | Plan |');
  });

  it('appends escaped rows and preserves prior rows', async () => {
    const h = await connectPlanHarness();
    const created = await createFast(h);
    const first = await h.callToolJson<SkipPayload>('plan_fast_skip_check', {
      slug: PLAN_SLUG,
      checks: ['dh-review', 'dh-simplify'],
      scope: 'Sub-Task 1.2',
      reason: 'reason | with\nnewline',
      disposition: 'end-of-plan',
    });
    expect(first).toMatchObject({ ok: true, path: created.skipChecksPath, appended: 2, rows: 8 });
    const text = fs.readFileSync(created.skipChecksPath, 'utf8');
    expect(text).toContain('reason \\| with newline');
    expect(text).toContain('| dh-review | Plan |');

    const second = await h.callToolJson<SkipPayload>('plan_fast_skip_check', {
      slug: PLAN_SLUG,
      checks: ['dh-preflight'],
      scope: 'End gates',
      reason: 'gate run',
      disposition: 'run: PASS',
    });
    expect(second.appended).toBe(1);
    expect(second.rows).toBe(9);
    expect(fs.readFileSync(created.skipChecksPath, 'utf8')).toContain('| dh-review | Plan |');
  });

  it('seeds the six standard rows when creating a missing ledger', async () => {
    const h = await connectPlanHarness();
    const created = await createFast(h);
    fs.unlinkSync(created.skipChecksPath);
    const payload = await h.callToolJson<SkipPayload>('plan_fast_skip_check', {
      slug: PLAN_SLUG,
      checks: ['dh-review'],
      scope: 'Plan',
      reason: 'seeded after loss',
      disposition: 'deferred to end-of-plan',
    });
    expect(payload).toMatchObject({ ok: true, appended: 1, rows: 7 });
    const ledger = fs.readFileSync(created.skipChecksPath, 'utf8');
    expect(ledger).toContain('| Timestamp | Check | Scope | Reason | Disposition |');
    expect(ledger).toContain('| dh-code-review | Plan |');
    expect(ledger).toContain('conditional at plan end');
    expect(ledger).toContain('seeded after loss');
    expect(ledger).toContain(`updated: ${new Date().toISOString().slice(0, 10)}`);
  });

  it('requires the fast plan', async () => {
    const h = await connectPlanHarness();
    const res = await h.callTool('plan_fast_skip_check', {
      slug: PLAN_SLUG,
      checks: ['dh-review'],
      scope: 'Plan',
      reason: 'x',
      disposition: 'end-of-plan',
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe(`plan_fast not found: ${fastFile(h.workspaceRoot)} (run plan_fast_create)`);
  });
});

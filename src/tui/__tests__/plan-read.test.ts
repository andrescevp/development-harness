/**
 * plan-read.test.ts — read-only filesystem layer (root, scan, index, sidecars).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../../__tests__/helpers/temp-dir.js';
import { readPlanDetails, readPlanScan, resolvePlanRoot } from '../plan-read.js';
import { fixture, snapshotTree, writeIndex, writePlan } from './helpers.js';

describe('resolvePlanRoot', () => {
  it('returns null without an injected location directory', () => {
    expect(resolvePlanRoot(undefined, undefined)).toEqual({ root: null, issues: [] });
    expect(resolvePlanRoot('   ', { DH_WORKSPACE_ROOT: '/elsewhere' })).toEqual({ root: null, issues: [] });
  });

  it('resolves the injected directory and accepts a matching override', async () => {
    await withTempDir((dir) => {
      const result = resolvePlanRoot(dir, { DH_WORKSPACE_ROOT: dir });
      expect(result.root).toBe(path.resolve(dir));
      expect(result.issues).toEqual([]);
    });
  });

  it('warns (without switching roots) when DH_WORKSPACE_ROOT differs', async () => {
    await withTempDir((dir) => {
      const other = path.join(dir, 'other-root');
      fs.mkdirSync(other);
      const result = resolvePlanRoot(dir, { DH_WORKSPACE_ROOT: other });
      expect(result.root).toBe(path.resolve(dir));
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.code).toBe('workspace-root-override');
      expect(result.issues[0]?.message).toContain(other);
    });
  });
});

describe('readPlanScan', () => {
  it('reports no root and no plans directory as the empty states', async () => {
    expect(readPlanScan(null)).toMatchObject({ plansDir: null, hasPlansDir: false, candidates: [] });
    await withTempDir((dir) => {
      const scan = readPlanScan(dir);
      expect(scan.hasPlansDir).toBe(false);
      expect(scan.errors).toEqual([]);
      expect(scan.warnings.map((issue) => issue.code)).toEqual(['no-plans-dir']);
    });
  });

  it('reads candidates, frontmatter, the index fallback columns and issues', async () => {
    await withTempDir((dir) => {
      writeIndex(dir, fixture('index.md'));
      writePlan(dir, 'checkout-flow', fixture('active-plan.md'));
      writePlan(dir, 'legacy-plan', fixture('legacy-plan.md'));
      fs.mkdirSync(path.join(dir, 'docs', 'plans', 'empty-dir'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'docs', 'plans', '.hidden'), { recursive: true });

      const scan = readPlanScan(dir);
      expect(scan.hasPlansDir).toBe(true);
      expect(scan.scanned).toBe(3);
      expect(scan.truncated).toBe(false);
      expect(scan.candidates.map((entry) => entry.slug)).toEqual(['checkout-flow', 'legacy-plan']);

      const checkout = scan.candidates[0]!;
      expect(checkout).toMatchObject({
        title: 'Checkout Flow',
        path: 'docs/plans/checkout-flow/plan.md',
        status: 'In Progress',
        active: true,
        updatedAt: '2026-11-14',
        updatedSource: 'frontmatter',
        valid: true,
        issue: null,
      });

      const legacy = scan.candidates[1]!;
      expect(legacy.valid).toBe(false);
      expect(legacy.issue?.code).toBe('not-a-phased-plan');
      expect(scan.warnings.some((issue) => issue.code === 'not-a-phased-plan')).toBe(true);

      expect(scan.index.map((row) => row.slug)).toEqual(['checkout-flow', 'legacy-plan', 'missing-plan']);
      expect(scan.index[0]?.status).toBe('Pending');

      const orphans = scan.errors.filter((issue) => issue.code === 'index-orphan');
      expect(orphans.map((issue) => issue.message)).toEqual(["index row 'missing-plan' has no plan.md"]);
    });
  });

  it('never writes: scan and details leave the tree byte-identical', async () => {
    await withTempDir((dir) => {
      writeIndex(dir, fixture('index.md'));
      writePlan(dir, 'checkout-flow', fixture('active-plan.md'), {
        'tasks/review.md': fixture('review.md'),
        'plan_fast_skip_checks.md': fixture('ledger.md'),
      });
      const before = snapshotTree(dir);
      readPlanScan(dir);
      readPlanDetails(dir, 'checkout-flow');
      expect(snapshotTree(dir)).toEqual(before);
    });
  });

  it('rejects a symlinked plan file instead of following it', async () => {
    await withTempDir((dir) => {
      const outside = path.join(dir, 'outside-plan.md');
      fs.writeFileSync(outside, fixture('active-plan.md'), 'utf8');
      const linked = path.join(dir, 'docs', 'plans', 'linked', 'plan.md');
      fs.mkdirSync(path.dirname(linked), { recursive: true });
      fs.symlinkSync(outside, linked);

      const scan = readPlanScan(dir);
      const linkedCandidate = scan.candidates.find((entry) => entry.slug === 'linked');
      expect(linkedCandidate?.valid).toBe(false);
      expect(linkedCandidate?.issue?.code).toBe('plan-unreadable');
    });
  });
});

describe('readPlanDetails', () => {
  it('reads the plan and only the sidecars that exist', async () => {
    await withTempDir((dir) => {
      writePlan(dir, 'checkout-flow', fixture('active-plan.md'), {
        'tasks/review.md': fixture('review.md'),
        'plan_fast_skip_checks.md': fixture('ledger.md'),
        'tasks/review-fast.md': '# Plan Alignment Review — fast\n\n**Verdict:** Approve\n',
      });

      const details = readPlanDetails(dir, 'checkout-flow');
      expect(details.errors).toEqual([]);
      expect(details.absPath).toBe(path.join(dir, 'docs', 'plans', 'checkout-flow', 'plan.md'));
      expect(details.plan?.path).toBe('docs/plans/checkout-flow/plan.md');
      expect(details.review?.path).toBe('docs/plans/checkout-flow/tasks/review.md');
      expect(details.ledger?.contents).toContain('dh-review');
      expect(details.fast).toBeNull();
      expect(details.alignment.preExecution?.path).toBe('docs/plans/checkout-flow/tasks/review-fast.md');
      expect(details.alignment.planEnd).toBeNull();
    });
  });

  it('reports a missing plan directory as an error, not a throw', async () => {
    await withTempDir((dir) => {
      fs.mkdirSync(path.join(dir, 'docs', 'plans'), { recursive: true });
      const details = readPlanDetails(dir, 'missing-plan');
      expect(details.plan).toBeNull();
      expect(details.errors[0]?.code).toBe('plan-missing');
      expect(details.errors[0]?.file).toBe('docs/plans/missing-plan/plan.md');
    });
  });
});

/**
 * plan-fast-skills.test.ts — structural contract guard for the fast-plan
 * skill family (orchestrator, per-task skill, template, ledger reference).
 *
 * Asserts the documented tool names, the dual-plan/ledger contract, the
 * first-read rule, the Plan Alignment Mode markers, and that the template's
 * worked example stays parseable. No prose snapshots.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePlan } from '../tools/plan-lifecycle.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAST_DIR = path.join(REPO_ROOT, 'skills', 'dh-execute-plan-fast');
const ORCHESTRATOR = path.join(FAST_DIR, 'SKILL.md');
const TEMPLATE = path.join(FAST_DIR, 'references', 'plan-fast-template.md');
const LEDGER = path.join(FAST_DIR, 'references', 'plan-fast-skip-checks.md');
const TASK = path.join(REPO_ROOT, 'skills', 'dh-execute-plan-task-fast', 'SKILL.md');
const REVIEW = path.join(REPO_ROOT, 'skills', 'dh-review', 'SKILL.md');

const TOOLS = [
  'dh_plan_fast_create',
  'dh_plan_fast_read',
  'dh_plan_fast_update_status',
  'dh_plan_fast_sync',
  'dh_plan_fast_skip_check',
] as const;
const SEED_CHECKS = [
  'dh-review',
  'dh-simplify',
  'dh-code-review',
  'dh-domain-check',
  'dh-preflight',
  'dh-artifact-check',
] as const;

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

describe('fast-plan skill corpus', () => {
  it('orchestrator references the mirror, ledger, tools, review, and dual plans', () => {
    const text = read(ORCHESTRATOR);
    for (const marker of ['plan_fast.md', 'plan_fast_skip_checks.md', 'dh-review', 'both plans']) {
      expect(text, marker).toContain(marker);
    }
    for (const tool of TOOLS) expect(text, tool).toContain(tool);
    expect(text).toContain('tools.dh.plan_fast_');
    expect(text).not.toContain('tools.dh.dh_');
  });

  it('task skill keeps the plan_fast-first rule and never executes plan.md alone', () => {
    const text = read(TASK);
    expect(text).toContain('always read `plan_fast.md` first');
    expect(text).toMatch(/never execute from `plan\.md` alone/i);
    for (const tool of ['dh_plan_fast_read', 'dh_plan_fast_update_status', 'dh_plan_fast_skip_check']) {
      expect(text, tool).toContain(tool);
    }
    expect(text).toMatch(/six per-task/i);
  });

  it('skip-check reference lists the six seed checks and the exact table header', () => {
    const text = read(LEDGER);
    for (const check of SEED_CHECKS) expect(text, check).toContain(check);
    expect(text).toContain('| Timestamp | Check | Scope | Reason | Disposition |');
    expect(text).toMatch(/append-only/i);
  });

  it('review keeps the Plan Alignment Mode separate and code-review-free', () => {
    const text = read(REVIEW);
    expect(text).toContain('Plan Alignment Mode');
    expect(text).toContain('Skip Workflow Steps 1–7');
    expect(text).toContain('no code review');
    expect(text).toContain('review-fast-final.md');
  });

  it('template worked example parses with the phased plan parser', () => {
    const text = read(TEMPLATE);
    const blocks = [...text.matchAll(/```markdown\n([\s\S]*?)```/g)]
      .map((match) => match[1] ?? '')
      .filter((block) => block.startsWith('---') && block.includes('## Phases'));
    expect(blocks.length, 'worked example block').toBeGreaterThan(0);
    expect(text).toContain('# Plan: <title> (Fast Execution)');
    expect(text).toContain('# Plan: Billing retries (Fast Execution)');
    const plan = parsePlan(blocks[0]!);
    expect(plan.phases.length).toBeGreaterThan(0);
    expect(plan.phases.flatMap((phase) => phase.subTasks).length).toBeGreaterThan(0);
  });

  it('fast skills carry no per-task gate instructions', () => {
    for (const file of [ORCHESTRATOR, TASK]) {
      const text = read(file);
      expect(text).not.toMatch(/run\s+`?dh-review`?\s+after\s+each\s+sub-task/i);
      expect(text).not.toMatch(/run\s+`?dh-simplify`?\s+after\s+each\s+sub-task/i);
      expect(text).not.toMatch(/run\s+`?dh-preflight`?\s+after\s+each\s+sub-task/i);
    }
    expect(read(ORCHESTRATOR)).toContain('No per-task gates');
    expect(read(TASK)).toContain('No per-task gates');
  });
});

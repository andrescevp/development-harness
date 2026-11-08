/**
 * plan-fixtures.ts — shared fixtures + harness connector for the plan suites.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { parsePlan } from '../../tools/plan-lifecycle.js';
import type { McpTestHarness } from './mcp.js';
import { connectHarness } from './mcp.js';

export { closeHarness as closePlanHarness } from './mcp.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '..', 'fixtures', 'plans', 'phased-plan.md');

export const PLAN_SLUG = 'example-phased-plan';
export const FIXTURE_CONTENTS = fs.readFileSync(FIXTURE, 'utf8');

export interface PlanPayload {
  ok: boolean;
  path: string;
  plan: ReturnType<typeof parsePlan>;
}

export const MARKERLESS_PLAN = `---
title: Markerless Plan
slug: markerless
---

## Phases

### Phase 1: Markerless

- **Status:** Pending

#### Sub-Task 1.1: No marker

- **Objective:** Demo the missing-marker error.
`;

/** `<root>/docs/plans`. */
export function plansDocIn(root: string): string {
  return path.join(root, 'docs', 'plans');
}

/** `<root>/docs/plans/index.md`. */
export function plansIndexFile(root: string): string {
  return path.join(plansDocIn(root), 'index.md');
}

/** `<root>/docs/plans/<slug>/plan.md`. */
export function plansFile(root: string, slug: string): string {
  return path.join(plansDocIn(root), slug, 'plan.md');
}

/** Lay out a plan file at the canonical location inside a temp workspace. */
export function seedPlan(root: string, slug = PLAN_SLUG, contents = FIXTURE_CONTENTS): void {
  const file = plansFile(root, slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, 'utf8');
}

/** Seed a real index file and point `<plans>/index.md` at it via symlink. */
export function seedSymlinkedIndex(root: string): string {
  const real = path.join(plansDocIn(root), 'real-index.md');
  fs.mkdirSync(plansDocIn(root), { recursive: true });
  fs.writeFileSync(real, '# Plans\n', 'utf8');
  fs.symlinkSync(real, plansIndexFile(root), 'file');
  return real;
}

/** Start (and track) the suite harness; seeds the canonical plan by default. */
export async function connectPlanHarness(setup?: (root: string) => void): Promise<McpTestHarness> {
  return connectHarness({ setup: setup ?? ((root) => seedPlan(root)) });
}

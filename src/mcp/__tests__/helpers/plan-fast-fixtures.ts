/**
 * plan-fast-fixtures.ts — shared payload types + filesystem helpers for the
 * fast-plan MCP suites (plan-fast-tools, plan-fast-sync).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { McpTestHarness } from '../../../__tests__/helpers/mcp.js';
import { PLAN_SLUG, plansDocIn } from '../../../__tests__/helpers/plan-fixtures.js';
import type { FastSyncDifference } from '../../../tools/plan-fast-sync.js';
import type { PlanDocument } from '../../../tools/plan-lifecycle.js';
import { parsePlan } from '../../../tools/plan-lifecycle.js';

export interface FastCreatePayload {
  ok: boolean;
  path: string;
  plan: PlanDocument;
  sourceSha256: string;
  skipChecksPath: string;
}

export interface FastReadPayload {
  ok: boolean;
  path: string;
  plan: PlanDocument;
  sourcePlanPath: string;
  sourceSha256: string;
  stale: boolean;
  skipChecksPath: string;
}

export interface FastStatusPayload {
  ok: boolean;
  path: string;
  plan: PlanDocument;
  mirroredPath: string;
  mirroredPlan: PlanDocument;
}

type Difference = FastSyncDifference;

export interface SyncPayload {
  ok: boolean;
  aligned?: boolean;
  applied?: boolean;
  requiresConfirmation?: boolean;
  differences: Difference[];
  sourceSha256?: string;
  stale?: boolean;
  plan?: PlanDocument;
  fastPlan?: PlanDocument;
}

export interface SkipPayload {
  ok: boolean;
  path: string;
  appended: number;
  rows: number;
}

const FAST = 'plan_fast.md';
const LEDGER = 'plan_fast_skip_checks.md';

export function fastFile(root: string, slug = PLAN_SLUG): string {
  return path.join(plansDocIn(root), slug, FAST);
}

export function ledgerFile(root: string, slug = PLAN_SLUG): string {
  return path.join(plansDocIn(root), slug, LEDGER);
}

export function diskPlan(file: string): PlanDocument {
  return parsePlan(fs.readFileSync(file, 'utf8'));
}

export async function createFast(h: McpTestHarness, slug = PLAN_SLUG): Promise<FastCreatePayload> {
  return h.callToolJson<FastCreatePayload>('plan_fast_create', { slug });
}

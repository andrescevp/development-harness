/**
 * plan-read-files.ts — size-capped, symlink-safe file reads for the TUI layer.
 *
 * Contract: progress-contract.md §9.3 budgets, §10.1 read-only guarantee.
 * Every read goes through `readPlanFile` (`O_NOFOLLOW`) like the `dh` tools.
 */
import fs from 'node:fs';
import { readPlanFile } from '../tools/plan-io.js';
import { type PlanIssue, planIssue } from './plan-issue.js';
import type { SourceFile } from './plan-model.js';

export const PLAN_MAX_BYTES = 1024 * 1024;
export const SIDECAR_MAX_BYTES = 512 * 1024;

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface ReadFileOptions {
  maxBytes: number;
  severity: 'error' | 'warning';
  issues: PlanIssue[];
}

/**
 * Read one regular file, or record an issue and return `null`. A missing file
 * (`ENOENT`) is not an issue: sidecars are optional (contract §7).
 */
export function readFileAt(absPath: string, relPath: string, options: ReadFileOptions): SourceFile | null {
  let stat: fs.Stats | undefined;
  try {
    stat = fs.lstatSync(absPath, { throwIfNoEntry: false });
  } catch (error) {
    options.issues.push(planIssue('plan-unreadable', options.severity, relPath, messageOf(error)));
    return null;
  }
  if (!stat?.isFile()) return null;
  if (stat.size > options.maxBytes) {
    options.issues.push(planIssue('file-too-large', options.severity, relPath, `\`${relPath}\` is ${stat.size} bytes`));
    return null;
  }
  try {
    return { path: relPath, contents: readPlanFile(absPath), mtimeMs: stat.mtimeMs, size: stat.size };
  } catch (error) {
    options.issues.push(planIssue('plan-unreadable', options.severity, relPath, messageOf(error)));
    return null;
  }
}

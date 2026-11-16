/**
 * plan-metadata.ts — parallel execution metadata for phased plans (R1).
 *
 * Phase/sub-task bullets (optional; legacy plans parse unchanged):
 *   - **Parallelizable:** yes|no
 *   - **Depends on:** <phase ids | N.M ids — comma-separated | None>
 *   - **Files/Scope:** <paths/globs — comma-separated | None>  (sub-tasks)
 *   - **Isolation:** shared|worktree                            (sub-tasks)
 *
 * Missing fields default to sequential/shared. Unknown values, empty markers,
 * and empty list entries are format errors (silent defaults would hide author
 * mistakes). `Files/Scope` entries lose their optional surrounding backticks
 * so later scope-overlap checks compare plain paths.
 * Split from plan-lifecycle.ts to keep files under the 300-line rule.
 */

export type PlanIsolation = 'shared' | 'worktree';

const ISOLATIONS: readonly PlanIsolation[] = ['shared', 'worktree'];

export interface PhaseMetadata {
  /** `- **Parallelizable:** yes|no`; false when absent. */
  parallelizable: boolean;
  /** `- **Depends on:**` refs; empty when absent/None. */
  dependsOn: string[];
}

export interface SubTaskMetadata extends PhaseMetadata {
  /** `- **Files/Scope:**` declared paths/globs; empty when absent/None (unknown). */
  filesScope: string[];
  /** `- **Isolation:** shared|worktree`; shared when absent. */
  isolation: PlanIsolation;
}

const PARALLEL = /^-\s+\*\*Parallelizable:\*\*\s*(.*?)\r?$/;
const DEPENDS = /^-\s+\*\*Depends on:\*\*\s*(.*?)\r?$/;
const SCOPE = /^-\s+\*\*Files\/Scope:\*\*\s*(.*?)\r?$/;
const ISOLATION = /^-\s+\*\*Isolation:\*\*\s*(.*?)\r?$/;

function readParallelizable(raw: string, where: string): boolean {
  const value = raw.trim().toLowerCase();
  if (value === '') throw new Error(`${where}: empty Parallelizable marker`);
  if (value === 'yes') return true;
  if (value === 'no') return false;
  throw new Error(`${where}: invalid Parallelizable '${raw.trim()}' (expected yes | no)`);
}

function readIsolation(raw: string, where: string): PlanIsolation {
  const value = raw.trim().toLowerCase();
  if (value === '') throw new Error(`${where}: empty Isolation marker`);
  if ((ISOLATIONS as readonly string[]).includes(value)) return value as PlanIsolation;
  throw new Error(`${where}: invalid Isolation '${raw.trim()}' (expected ${ISOLATIONS.join(' | ')})`);
}

/** Comma-separated list; `None` means empty, empty entries are format errors. */
function readList(raw: string, where: string, field: string): string[] {
  const value = raw.trim();
  if (value === '') throw new Error(`${where}: empty ${field} marker`);
  if (value.toLowerCase() === 'none') return [];
  const entries = splitEntries(value, where, field).map((entry) =>
    entry
      .trim()
      .replace(/^`+|`+$/g, '')
      .trim()
  );
  if (entries.some((entry) => entry === '')) throw new Error(`${where}: empty entry in ${field}`);
  return entries;
}

/**
 * Split on commas outside `{...}` so brace globs such as `*.{ts,tsx}` stay one
 * entry. Unmatched braces are a format error: silently treating half a glob as
 * a path would weaken scope conflict checks.
 */
function splitEntries(value: string, where: string, field: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      if (depth === 0) throw new Error(`${where}: unmatched '}' in ${field} '${value}'`);
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      entries.push(value.slice(start, i));
      start = i + 1;
    }
  }
  if (depth !== 0) throw new Error(`${where}: unmatched '{' in ${field} '${value}'`);
  entries.push(value.slice(start));
  return entries;
}

/** Value of the first matching bullet, ignoring fenced code lines. */
function firstValue(
  lines: readonly string[],
  from: number,
  to: number,
  fenced: readonly boolean[],
  re: RegExp
): string | undefined {
  for (let i = from; i <= to; i++) {
    if (fenced[i]) continue;
    const match = (lines[i] ?? '').match(re);
    if (match) return match[1] ?? '';
  }
  return undefined;
}

/** Phase metadata; absent fields keep the sequential defaults. */
export function readPhaseMetadata(
  lines: readonly string[],
  from: number,
  to: number,
  where: string,
  fenced: readonly boolean[]
): PhaseMetadata {
  const parallel = firstValue(lines, from, to, fenced, PARALLEL);
  const depends = firstValue(lines, from, to, fenced, DEPENDS);
  return {
    parallelizable: parallel === undefined ? false : readParallelizable(parallel, where),
    dependsOn: depends === undefined ? [] : readList(depends, where, 'Depends on'),
  };
}

/** Sub-task metadata; absent fields keep the shared-worktree defaults. */
export function readSubTaskMetadata(
  lines: readonly string[],
  from: number,
  to: number,
  where: string,
  fenced: readonly boolean[]
): SubTaskMetadata {
  const scope = firstValue(lines, from, to, fenced, SCOPE);
  const isolation = firstValue(lines, from, to, fenced, ISOLATION);
  return {
    ...readPhaseMetadata(lines, from, to, where, fenced),
    filesScope: scope === undefined ? [] : readList(scope, where, 'Files/Scope'),
    isolation: isolation === undefined ? 'shared' : readIsolation(isolation, where),
  };
}

/**
 * plan-fast-template.ts — pure rendering/hash/ledger helpers for the fast-plan
 * tool family. No filesystem I/O: callers (plan-fast.ts) own reads/writes.
 *
 * The fast mirror is a derived view of plan.md: the full `## Phases` region is
 * copied verbatim, while scope/requirements stay in plan.md. `source_sha256`
 * hashes the plan body with status lines removed, so status-only progress never
 * makes the mirror stale.
 */
import crypto from 'node:crypto';
import { splitFrontmatter } from '../lib/frontmatter.js';
import type { PlanDocument } from './plan-lifecycle.js';

/** Top-level plan.md sections the fast mirror intentionally omits. */
const FAST_OMITTED_SECTIONS = [
  'Objective',
  'Requirements Snapshot',
  'Scope',
  'Assumptions and Constraints',
  'Risks and Areas Requiring Care',
  'Core concepts',
  'Open Questions',
] as const;

/** The six standard checks recorded by the skipped-check ledger. */
const FAST_SKIPPED_CHECKS = [
  'dh-review',
  'dh-simplify',
  'dh-code-review',
  'dh-domain-check',
  'dh-preflight',
  'dh-artifact-check',
] as const;

const STATUS_LINE = /^-\s+\*\*Status:\*\*/;
const HEADING = /^##\s+/;

/** plan.md body: everything after the closing frontmatter delimiter. */
function planBody(contents: string): string {
  const split = splitFrontmatter(contents);
  if (!split || 'error' in split) return contents;
  if (split.body.startsWith('\r\n')) return split.body.slice(2);
  return split.body.startsWith('\n') ? split.body.slice(1) : split.body;
}

/** SHA-256 of the plan body with every `- **Status:**` line removed. */
export function computeSourceSha256(contents: string): string {
  const filtered = planBody(contents)
    .split('\n')
    .filter((line) => !STATUS_LINE.test(line))
    .join('\n');
  return crypto.createHash('sha256').update(filtered, 'utf8').digest('hex');
}

/** Extract a top-level `## <heading>` section, including its heading line. */
function extractSection(contents: string, heading: string): string | undefined {
  const lines = contents.split('\n');
  const start = lines.findIndex((line) => line.replace(/\r$/, '').trimEnd() === `## ${heading}`);
  if (start === -1) return undefined;
  let end = start + 1;
  while (end < lines.length && !HEADING.test(lines[end]!.replace(/\r$/, ''))) end += 1;
  return lines.slice(start, end).join('\n');
}

/** Section content without its heading or surrounding blank lines. */
function extractSectionBody(contents: string, heading: string): string | undefined {
  const section = extractSection(contents, heading);
  if (section === undefined) return undefined;
  const body = section.split('\n').slice(1).join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  return body.length > 0 ? body : undefined;
}

/** Escape a markdown table cell (backslashes first, then pipes/newlines). */
export function escapeCell(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[\r\n]+/g, ' ');
}

/** Current ISO-8601 UTC timestamp. */
export function isoTimestamp(now = new Date()): string {
  return now.toISOString();
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export interface FastPlanRenderInput {
  slug: string;
  sourceContents: string;
  sourcePlan: PlanDocument;
  /** ISO-8601 timestamp used for created/updated dates. */
  timestamp: string;
}

export interface FastPlanRenderResult {
  contents: string;
  sourceSha256: string;
  title: string;
  project: string;
  status: string;
}

/** Render the complete `plan_fast.md` document (validated by the caller). */
export function renderFastPlan(input: FastPlanRenderInput): FastPlanRenderResult {
  const sourceTitle = (input.sourcePlan.title ?? input.slug).trim() || input.slug;
  const metaStatus = typeof input.sourcePlan.meta.status === 'string' ? input.sourcePlan.meta.status.trim() : '';
  const status = metaStatus.length > 0 ? metaStatus : 'Pending';
  const project =
    typeof input.sourcePlan.meta.project === 'string' && input.sourcePlan.meta.project.trim().length > 0
      ? input.sourcePlan.meta.project.trim()
      : input.slug;
  const sourceSha256 = computeSourceSha256(input.sourceContents);
  const today = input.timestamp.slice(0, 10);
  const phases = extractSectionBody(input.sourceContents, 'Phases') ?? '';
  const planSpecific = extractSectionBody(input.sourceContents, 'Final Integration & Verification');
  const omitted = FAST_OMITTED_SECTIONS.map((section) => `\`## ${section}\``).join(', ');

  const contents = `---
title: ${yamlString(`${sourceTitle} — Fast Execution`)}
slug: ${input.slug}
description: "Fast execution mirror of plan.md; critical verification deferred to plan end."
source_plan: plan.md
source_sha256: ${sourceSha256}
plan_version: fast-1
status: ${status}
active: true
tags: [plan, fast]
project: ${yamlString(project)}
created: ${today}
updated: ${today}
---

# Plan: ${sourceTitle} (Fast Execution)

## Fast Execution Policy

- No per-task \`dh-review\`, \`dh-simplify\`, \`dh-code-review\`, \`dh-preflight\`,
  \`dh-artifact-check\`, or \`dh-domain-check\` gates.
- Execution position and statuses are read from this file; every phase and
  sub-task status change is mirrored to \`plan.md\` in the same turn.
- A phase moves to \`In Progress\` when its first sub-task starts and closes only
  when ALL its sub-tasks are \`Completed\`; close pending phases in both files.
- Narrow validation (tests/lint for changed files) stays part of each sub-task;
  it is a sanity check, not a review gate.
- All critical verification runs once across plan end (see Final Verification).
- Hard blockers halt the loop; a blocked sub-task blocks its phase.

## Alignment Contract

- Same phases/sub-tasks as \`plan.md\`: count, IDs, titles, order, requirements,
  scope, dependencies, instructions, acceptance criteria, done-when.
- Allowed differences: this policy, this contract, \`## Final Verification\`, the
  omitted top-level sections, and status progression.
- Omits from \`plan.md\`: ${omitted}.
- Not allowed: missing/extra/reordered/renamed items; changed requirements,
  scope, or acceptance criteria. \`plan.md\` is the scope reference.
- Misalignment is fixed here; never rewrite \`plan.md\` scope.

## Phases

${phases}

## Final Verification

### Plan-specific verification (copied from plan.md, unchanged)

${planSpecific ?? '- None.'}

### End gates (run once across plan end)

1. \`dh-review\` Plan Alignment Mode \`phase: plan-end\` → \`tasks/review-fast-final.md\`.
2. Execute the plan-specific System-Wide Test and Completion Checklist above.
3. \`dh-simplify\` + \`dh-code-review\` (software only).
4. \`dh-domain-check\` (architectural software plans only; otherwise not applicable).
5. \`dh-preflight\` + \`dh-artifact-check\`.
6. \`dh-final-review\` (reuse results; do not re-run preflight/artifact/semver).
7. \`dh-create-documentation\` + \`dh-semver\` (software only).
8. Append every outcome to \`plan_fast_skip_checks.md\` via \`dh_plan_fast_skip_check\`.
`;

  return { contents, sourceSha256, title: sourceTitle, project, status };
}

export interface SkipLedgerRenderInput {
  slug: string;
  title: string;
  project: string;
  timestamp: string;
}

function ledgerRow(timestamp: string, check: string, scope: string, reason: string, disposition: string): string {
  return `| ${escapeCell(timestamp)} | ${escapeCell(check)} | ${escapeCell(scope)} | ${escapeCell(reason)} | ${escapeCell(disposition)} |`;
}

/** Render the skipped-check ledger; callers create it with the six standard rows. */
export function renderSkipLedger(input: SkipLedgerRenderInput): string {
  const today = input.timestamp.slice(0, 10);
  const seedRows = FAST_SKIPPED_CHECKS.map((check) =>
    ledgerRow(
      input.timestamp,
      check,
      'Plan',
      'fast mode defers per-task verification',
      check === 'dh-domain-check' ? 'conditional at plan end' : 'deferred to end-of-plan'
    )
  );
  const table = `${seedRows.join('\n')}\n`;
  return `---
title: ${yamlString(`${input.title} — Fast Skipped Checks`)}
slug: ${input.slug}
description: "Append-only ledger of standard checks skipped or deferred in fast mode."
tags: [plan, fast, checks]
project: ${yamlString(input.project)}
created: ${today}
updated: ${today}
---

# Fast Execution — Skipped Checks

Append-only evidence of standard checks the fast path skipped, deferred, or
found not applicable.

| Timestamp | Check | Scope | Reason | Disposition |
|---|---|---|---|---|
${table}`;
}

/** Append one row per check and refresh the ledger's `updated` date. */
export function appendSkipRows(contents: string, rows: string[], date: string): string {
  const base = contents.endsWith('\n') ? contents : `${contents}\n`;
  const appended = rows.length > 0 ? `${rows.join('\n')}\n` : '';
  const withRows = `${base}${appended}`;
  const split = splitFrontmatter(withRows);
  if (!split || 'error' in split) return withRows;
  const fm = split.fm.replace(/(^|\n)updated:[^\r\n]*/, `$1updated: ${date}`);
  return `---\n${fm}\n---${split.body}`;
}

/** Count table data rows (excluding the header and separator lines). */
export function countLedgerRows(contents: string): number {
  return contents
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.startsWith('| Timestamp') && !/^\|\s*:?-{3,}/.test(line)).length;
}

/**
 * panel-sections.ts — body sections for the `session.panel` view model
 * (progress-contract §6 checklists, §7 review/fast/ledger, §5 phases).
 *
 * Pure string builders: no Solid, no renderer, no I/O. Every line is already
 * truncated to the panel width so the component only joins strings.
 */
import type { PlanIssue } from '../plan-issue.js';
import type { Checklist, PhaseProgress, PlanProgress, SubTaskProgress } from '../plan-model.js';
import type { ReviewState } from '../plan-sidecars.js';
import { checkboxGlyph, clip, statusSymbol } from './format.js';

function subTaskLines(subTask: SubTaskProgress, width: number): string[] {
  const agent = subTask.delegatedTo ?? 'unassigned';
  const lines = [
    clip(`  ${statusSymbol(subTask.status)} ${subTask.index} ${subTask.title} · ${subTask.status} · ${agent}`, width),
  ];
  for (const criterion of subTask.criteria) {
    lines.push(clip(`    ${checkboxGlyph(null)} (${criterion.kind}) ${criterion.text}`, width));
  }
  for (const item of subTask.checkboxes) {
    lines.push(clip(`    ${checkboxGlyph(item.checked)} ${item.text}`, width));
  }
  return lines;
}

function phaseLines(phase: PhaseProgress, width: number): string[] {
  const counts = `${phase.counts.completed}/${phase.counts.total}`;
  const lines = [
    clip(`${statusSymbol(phase.status)} Phase ${phase.index}: ${phase.title} · ${phase.status} (${counts})`, width),
  ];
  for (const subTask of phase.subTasks) lines.push(...subTaskLines(subTask, width));
  return lines;
}

function checklistLines(label: string, checklist: Checklist, width: number): string[] {
  if (checklist.total === 0 && checklist.inlineText === null) return [];
  const lines = [clip(`${label} — ${checklist.checked}/${checklist.total} checked`, width)];
  for (const item of checklist.items) lines.push(clip(`  ${checkboxGlyph(item.checked)} ${item.text}`, width));
  if (checklist.inlineText !== null) lines.push(clip(`  ${checkboxGlyph(null)} ${checklist.inlineText}`, width));
  if (checklist.truncated) lines.push(clip(`  … ${label} list truncated`, width));
  return lines;
}

function reviewLines(review: ReviewState, plan: PlanProgress, width: number): string[] {
  const verdict = review.verdict ?? plan.fast.alignment.planEnd.verdict;
  if (verdict === null) {
    return [clip(review.present ? 'Review — no verdict found' : 'Review — no review file', width)];
  }
  const source = review.verdict ? `review (${review.scope})` : 'plan-end alignment';
  const risk = review.risk ? ` · risk ${review.risk}` : '';
  const lines = [clip(`Review — ${verdict} · ${source}${risk}`, width)];
  if (review.verdictRaw) lines.push(clip(`  ${review.verdictRaw}`, width));
  if (review.reviewedAgainst) lines.push(clip(`  reviewed against: ${review.reviewedAgainst}`, width));
  return lines;
}

function fastLines(plan: PlanProgress, width: number): string[] {
  const fast = plan.fast;
  const lines: string[] = [];
  if (!fast.present) {
    lines.push(clip('Fast mirror — none', width));
  } else {
    const mirror = fast.stale === true ? 'stale' : fast.stale === false ? 'current' : 'unknown';
    const aligned =
      fast.statusesAligned === null
        ? 'statuses unknown'
        : fast.statusesAligned
          ? 'statuses aligned'
          : 'statuses mismatched';
    lines.push(clip(`Fast mirror — present · ${mirror} · ${aligned}`, width));
    if (fast.updatedAt) lines.push(clip(`  updated ${fast.updatedAt}`, width));
  }
  const ledger = fast.ledger;
  if (!ledger.present) {
    lines.push(clip('Ledger — no plan_fast_skip_checks.md', width));
    return lines;
  }
  lines.push(clip(`Ledger — ${ledger.rows} rows · ${ledger.unresolved.length} deferred`, width));
  if (ledger.unresolved.length > 0) lines.push(clip(`  deferred: ${ledger.unresolved.join(', ')}`, width));
  for (const entry of [fast.alignment.preExecution, fast.alignment.planEnd]) {
    if (!entry.present) continue;
    const label = entry === fast.alignment.planEnd ? 'plan-end' : 'pre-execution';
    lines.push(clip(`  ${label} alignment: ${entry.verdict ?? 'no verdict'}`, width));
  }
  return lines;
}

function issueLines(label: string, issues: PlanIssue[], width: number): string[] {
  if (issues.length === 0) return [];
  const lines = [clip(`${label} — ${issues.length}`, width)];
  for (const issue of issues) {
    const file = issue.file ? ` ${issue.file}` : '';
    lines.push(clip(`  ${issue.severity === 'error' ? '✖' : '⚠'} ${issue.code}${file}: ${issue.message}`, width));
  }
  return lines;
}

/** Full phase/sub-task/checklist/review/ledger body for a ready plan (§6, §7). */
export function planBody(plan: PlanProgress, width: number): string[] {
  const lines: string[] = [];
  for (const phase of plan.phases) lines.push(...phaseLines(phase, width));
  lines.push(...checklistLines('Plan checklists', plan.checklists.plan, width));
  lines.push(...checklistLines('Final verification', plan.checklists.finalVerification, width));
  lines.push('');
  lines.push(...reviewLines(plan.review, plan, width));
  lines.push(...fastLines(plan, width));
  lines.push('');
  lines.push(clip(`Updated ${plan.updatedAt} (${plan.updatedSource})`, width));
  lines.push(...issueLines('Warnings', plan.warnings, width));
  lines.push(...issueLines('Errors', plan.errors, width));
  return lines;
}

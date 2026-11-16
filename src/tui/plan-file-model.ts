/**
 * plan-file-model.ts — pure text models for the read-only plan-file modal.
 *
 * The modal never parses plans in its render path: these helpers build the
 * Markdown body and the phase/sub-task tree once per file read, and the
 * component only renders the strings.
 */
import { mermaidToAscii } from 'mermaid-ascii';
import { splitFrontmatter } from '../lib/frontmatter.js';
import { parsePlan } from '../tools/plan-lifecycle.js';
import { statusSymbol } from './components/format.js';

/** Plan body without the YAML frontmatter (rendered Markdown tab). */
export function planFileMarkdown(contents: string): string {
  const split = splitFrontmatter(contents);
  return split !== null && !('error' in split) ? split.body.replace(/^\r?\n+/, '') : contents;
}

/** Render a Mermaid flowchart to terminal ASCII; null when unsupported. */
export function planMermaidAscii(source: string): string | null {
  try {
    const rendered = mermaidToAscii(source);
    return rendered.trim().length === 0 ? null : rendered;
  } catch {
    return null;
  }
}

/** Flat phase/sub-task tree with statuses and delegated agents. */
export function planTreeText(contents: string, file = '<plan>'): string {
  try {
    const plan = parsePlan(contents, file);
    if (plan.phases.length === 0) return 'Plan has no phases.';
    return plan.phases
      .flatMap((phase) => [
        `${statusSymbol(phase.status)} Phase ${phase.index}: ${phase.title} — ${phase.status}`,
        ...phase.subTasks.map(
          (subTask) =>
            `  ${statusSymbol(subTask.status)} ${subTask.index} ${subTask.title} — ${subTask.status}${
              subTask.delegatedTo === null ? '' : ` · ${subTask.delegatedTo}`
            }`
        ),
      ])
      .join('\n');
  } catch (error) {
    return `Plan tree unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

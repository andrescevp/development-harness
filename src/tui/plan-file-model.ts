/**
 * plan-file-model.ts — pure text models for the read-only plan-file modal.
 *
 * The modal never parses plans in its render path: these helpers build the
 * Markdown body and the phase/sub-task tree once per file read, and the
 * component only renders the strings.
 */
import { mermaidToAscii } from 'mermaid-ascii';
import { splitFrontmatter } from '../lib/frontmatter.js';

/** Plan body without the YAML frontmatter (rendered Markdown preview). */
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

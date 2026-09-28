/**
 * frontmatter.ts — frontmatter splitting + YAML-faithful parsing for harness
 * markdown assets (agent files and skill SKILL.md files).
 *
 * Uses the `yaml` package (YAML 1.2 core) so nested maps (`tools`,
 * `permission`, `metadata`) keep their structure — registration needs the
 * structured objects, not the flattened view the audit's zero-dep parser
 * produces. Pure functions, no I/O, unit-testable.
 */

import { parse as parseYaml } from 'yaml';

export interface ParsedDocument {
  /** Structured frontmatter map (YAML-decoded). Non-string values keep their types. */
  data: Record<string, unknown>;
  /** Markdown body after the closing `---` (leading newline stripped). */
  body: string;
}

/**
 * Split a markdown file into { data, body } by parsing the leading
 * `---`-delimited YAML block. Throws Error with a clear message when the
 * frontmatter is missing, unterminated, or not valid YAML.
 */
export function parseFrontmatter(contents: string): ParsedDocument {
  const split = splitFrontmatter(contents);
  if (!split) throw new Error('missing leading --- frontmatter');
  if ('error' in split) throw new Error(split.error);
  const data = parseYaml(split.fm);
  if (data === null || data === undefined) return { data: {}, body: split.body };
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('frontmatter must be a YAML mapping at the top level');
  }
  return { data: data as Record<string, unknown>, body: split.body };
}

/** Split the leading `---` block. Returns { fm, body } or { error } or null. */
export function splitFrontmatter(text: string): { fm: string; body: string } | { error: string } | null {
  if (!/^---(\r?\n)/.test(text)) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { error: 'unterminated frontmatter (no closing ---)' };
  // fm excludes the leading `---\n` and the closing `---`; body starts after
  // the newline that follows the closing delimiter.
  return { fm: text.slice(4, end), body: text.slice(end + 4) };
}

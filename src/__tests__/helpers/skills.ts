/**
 * skills.ts — shared helpers for structural skill/reference contract tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, read } from './repo.js';

const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');

export const skill = (name: string): string => path.join(SKILLS_ROOT, name, 'SKILL.md');

export const reference = (name: string, file: string): string => path.join(SKILLS_ROOT, name, 'references', file);

/** Content lines only: a trailing newline does not count as an extra line. */
export function contentLines(file: string): number {
  return read(file).replace(/\n$/, '').split('\n').length;
}

/** Number of `- [ ]` items in a reference's validation checklist. */
export function checklistItems(text: string): number {
  const start = text.indexOf('## Validation checklist');
  if (start < 0) throw new Error('missing validation checklist');
  return text.slice(start).match(/^- \[ \]/gm)?.length ?? 0;
}

/** Every bundled skill's SKILL.md. */
export function skillFiles(): string[] {
  return fs
    .readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(SKILLS_ROOT, entry.name, 'SKILL.md'))
    .filter((file) => fs.existsSync(file));
}

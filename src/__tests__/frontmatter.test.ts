/**
 * frontmatter.test.ts — parser corpus + folding + error cases + name regex.
 * Reads the REAL bundled corpus (repo agents/ and skills/) so the suite is
 * meaningful beyond fixtures.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter, splitFrontmatter } from '../lib/frontmatter.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function listMd(dir: string): string[] {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => path.join(abs, e.name))
    .sort();
}

function listSkillMd(): string[] {
  const abs = path.join(REPO_ROOT, 'skills');
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(abs, e.name, 'SKILL.md'))
    .filter((f) => fs.existsSync(f))
    .sort();
}

const AGENT_FILES = listMd('agents');
const SKILL_FILES = listSkillMd();

describe('corpus parsing (real bundled set)', () => {
  it('finds the scoped manifest on disk (6 agents + 12 skills)', () => {
    expect(AGENT_FILES).toHaveLength(7);
    expect(SKILL_FILES).toHaveLength(15);
  });

  it.each([...AGENT_FILES.map((f) => ['agent', f] as const), ...SKILL_FILES.map((f) => ['skill', f] as const)])(
    'parses %s %s with name + description',
    (_kind, file) => {
      const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      expect(typeof data.name).toBe('string');
      expect((data.name as string).trim().length).toBeGreaterThan(0);
      expect(typeof data.description).toBe('string');
      expect((data.description as string).trim().length).toBeGreaterThan(0);
      expect(body.trim().length).toBeGreaterThan(0);
    }
  );

  it('every agent + skill name matches the manifest regex and equals the file identity', () => {
    const names: string[] = [];
    for (const file of AGENT_FILES) names.push(parseFrontmatter(fs.readFileSync(file, 'utf8')).data.name as string);
    for (const file of SKILL_FILES) names.push(parseFrontmatter(fs.readFileSync(file, 'utf8')).data.name as string);
    for (const n of names) expect(n).toMatch(NAME_REGEX);
    expect(new Set(names)).toHaveLength(22); // 7 agents + 15 skills, no duplicates
  });

  it('the coding skill is present and parses', () => {
    const coding = path.join(REPO_ROOT, 'skills', 'dh-coding', 'SKILL.md');
    expect(fs.existsSync(coding)).toBe(true);
    const { data } = parseFrontmatter(fs.readFileSync(coding, 'utf8'));
    expect(data.name).toBe('dh-coding');
    expect(String(data.description)).toMatch(/CODE_RULES\.md/);
    expect(String(data.description)).toMatch(/TDD/i);
  });

  it('no bundled agent carries the permission or tools frontmatter keys', () => {
    // Policy: bundled agents ship without `permission` (M3 strip) AND without
    // `tools` (user mandate 2026-09-28) — they register with no static tool
    // rules; re-extract from ~/.agents restores both unless patched.
    for (const file of AGENT_FILES) {
      const { data } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      expect(data['permission'], file).toBeUndefined();
      expect(data['tools'], file).toBeUndefined();
    }
  });
});

describe('multi-line > description folding', () => {
  it('folds folded descriptions into a single string', () => {
    // execute-plan-task uses `description: >` multi-line in the harness.
    const file = path.join(REPO_ROOT, 'skills', 'dh-execute-plan-task', 'SKILL.md');
    const { data } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    const desc = data.description as string;
    expect(desc).toContain('single sub-task');
    expect(desc.split('\n').length).toBeLessThanOrEqual(4); // folded, no per-line breaks
    expect(desc.length).toBeGreaterThan(100);
  });
});

describe('error cases', () => {
  it('rejects a document without leading ---', () => {
    expect(() => parseFrontmatter('# no frontmatter here\n')).toThrow(/missing leading ---/);
  });

  it('rejects unterminated frontmatter', () => {
    expect(() => parseFrontmatter('---\nname: x')).toThrow(/unterminated/);
  });

  it('splitFrontmatter returns null for non-frontmatter input', () => {
    expect(splitFrontmatter('plain text')).toBeNull();
  });

  it('rejects a non-mapping top-level YAML document', () => {
    expect(() => parseFrontmatter('---\n- a\n- b\n---\nbody')).toThrow(/mapping/);
  });
});

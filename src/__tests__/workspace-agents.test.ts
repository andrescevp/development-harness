/**
 * workspace-agents.test.ts — R8: workspace-first guidance in every bundled agent.
 *
 * Structural assertions that the five shipped agents read the workspace map,
 * take affected packages from `## Workspace Impact`, scope their actions and
 * keep the standalone fallback, plus the 300-line agent limit.
 * Deterministic: file reads only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, read } from './helpers/repo.js';
import { contentLines } from './helpers/skills.js';

const AGENTS_DIR = path.join(REPO_ROOT, 'agents');
const SECTION = '## Workspace First';
const MAP_LINK = '../skills/dh-setup/references/workspace-map.md';

interface AgentCase {
  file: string;
  /** Role-specific behavior the directive must tailor. */
  focus: string;
  needle: string;
}

const AGENTS: AgentCase[] = [
  {
    file: 'dh-software-architect.md',
    focus: 'architecture mapping',
    needle: 'package boundaries',
  },
  {
    file: 'dh-software-engineer.md',
    focus: 'implementation targeting',
    needle: 'package-scoped commands',
  },
  {
    file: 'dh-reviewer.md',
    focus: 'scoped review',
    needle: '`git diff -- <paths>`',
  },
  {
    file: 'dh-final-reviewer.md',
    focus: 'final review',
    needle: 'untouched packages as unaffected',
  },
  {
    file: 'dh-documentor.md',
    focus: 'documentation roots',
    needle: '`package: <name>`',
  },
];

const SHARED_DIRECTIVE = [
  SECTION,
  '`WORKSPACE.md`',
  '`docs/WORKSPACE.md`',
  MAP_LINK,
  '`## Workspace Impact`',
  'never infer',
  'standalone',
  'single root',
  'package-local',
];

describe('workspace-first agent guidance (R8)', () => {
  it.each(AGENTS)('$file reads the map and names affected packages', ({ file }) => {
    const fullPath = path.join(AGENTS_DIR, file);
    const text = read(fullPath);

    for (const needle of SHARED_DIRECTIVE) {
      expect(text, `${file} must contain ${needle}`).toContain(needle);
    }

    expect(fs.existsSync(path.resolve(path.dirname(fullPath), MAP_LINK))).toBe(true);
  });

  it.each(AGENTS)('$file tailors the directive to its role ($focus)', ({ file, needle }) => {
    expect(read(path.join(AGENTS_DIR, file))).toContain(needle);
  });

  it.each(AGENTS)('$file has exactly one Workspace First section', ({ file }) => {
    const headings = read(path.join(AGENTS_DIR, file)).match(/^## Workspace First$/gm) ?? [];
    expect(headings).toHaveLength(1);
  });

  it.each(AGENTS)('$file keeps its name frontmatter and the 300-line limit', ({ file }) => {
    const fullPath = path.join(AGENTS_DIR, file);
    const text = read(fullPath);
    const id = file.replace(/\.md$/, '');

    expect(text.startsWith('---\n')).toBe(true);
    expect(text).toContain(`name: ${id}`);
    expect(fs.existsSync(fullPath)).toBe(true);
    expect(contentLines(fullPath)).toBeLessThan(300);
  });

  it('keeps exactly the five bundled agents', () => {
    const shipped = fs
      .readdirSync(AGENTS_DIR)
      .filter((entry) => entry.endsWith('.md'))
      .sort();

    expect(shipped).toEqual(AGENTS.map((agent) => agent.file).sort());
  });
});

/**
 * agent-selection.test.ts — structural contract for the capability-based
 * delegation model (Phases 1–4):
 *   - no hardcoded `@dh-` agent references anywhere in the bundled corpus;
 *   - the utility agents are gone and their skills exist and parse;
 *   - the selection protocol, plan section, and fast omitted lists agree;
 *   - the inventory is 5 agents / 26 skills;
 *   - the active docs list both utility skills.
 *
 * These are structural assertions over the real repo corpus — no prose
 * snapshots, and historical `docs/plans/**` content is never inspected.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(relative: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');
}

function exists(relative: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, relative));
}

/** Every regular file under a directory, recursively. */
function walkFiles(relativeDir: string): string[] {
  const absolute = path.join(REPO_ROOT, relativeDir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return walkFiles(child);
    return entry.isFile() ? [child] : [];
  });
}

function skillNames(): string[] {
  const skillsDir = path.join(REPO_ROOT, 'skills');
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsDir, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort();
}

describe('agent references (hard cut)', () => {
  it('no bundled skill or agent file contains an @dh- agent reference', () => {
    const files = [...walkFiles('skills'), ...walkFiles('agents')];
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((file) => read(file).includes('@dh-'));
    expect(offenders).toEqual([]);
  });

  it('removed utility agent files do not exist', () => {
    expect(exists('agents/dh-executor.md')).toBe(false);
    expect(exists('agents/dh-explorer.md')).toBe(false);
  });

  it('the utility skills exist, parse, and carry the matching name', () => {
    for (const name of ['dh-execute-cli', 'dh-explore', 'dh-code-query']) {
      const file = `skills/${name}/SKILL.md`;
      expect(exists(file), file).toBe(true);
      const { data, body } = parseFrontmatter(read(file));
      expect(data.name).toBe(name);
      expect(body.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('agent-selection protocol', () => {
  const referencePath = 'skills/dh-planning/references/agent-selection.md';

  it('exists and covers discovery, ranking, fallback, and the recording section', () => {
    expect(exists(referencePath)).toBe(true);
    const text = read(referencePath);
    expect(text).toMatch(/^## \d+\. Discovery$/m);
    expect(text).toMatch(/^## \d+\. Ranking$/m);
    expect(text).toMatch(/^## \d+\. Fallback$/m);
    expect(text).toContain('## Agent Selection');
    expect(text).not.toContain('@dh-');
  });

  it('dh-planning references the protocol and records the section', () => {
    const planning = read('skills/dh-planning/SKILL.md');
    expect(planning).toContain('agent-selection.md');
    expect(planning).toContain('## Agent Selection');
  });

  it('plan template, scaffold, and fixture include ## Agent Selection', () => {
    const sources = [
      'skills/dh-planning/references/phased-plan-template.md',
      'src/tools/plan-template.ts',
      'src/__tests__/fixtures/plans/phased-plan.md',
    ];
    for (const file of sources) expect(read(file), file).toContain('## Agent Selection');
  });

  it('plan template, scaffold, and fixture require Delegated to agent per sub-task', () => {
    const sources = [
      'skills/dh-planning/references/phased-plan-template.md',
      'src/tools/plan-template.ts',
      'src/__tests__/fixtures/plans/phased-plan.md',
    ];
    for (const file of sources) expect(read(file), file).toContain('Delegated to agent');
  });

  it('fast-plan omitted lists include the Agent Selection section', () => {
    const prose = [
      'skills/dh-execute-plan-fast/SKILL.md',
      'skills/dh-execute-plan-fast/references/plan-fast-template.md',
      'skills/dh-review/SKILL.md',
    ];
    for (const file of prose) expect(read(file), file).toContain('## Agent Selection');
    // The renderer stores bare section names (it renders `## <name>` itself).
    expect(read('src/tools/plan-fast-template.ts')).toContain("'Agent Selection'");
  });
});

describe('bundle inventory', () => {
  it('bundles 5 agents and 26 skills with a 31-name unique corpus', () => {
    const agents = walkFiles('agents').filter((file) => file.endsWith('.md'));
    const skills = skillNames();
    expect(agents).toHaveLength(5);
    expect(skills).toHaveLength(26);

    const names = [
      ...agents.map((file) => parseFrontmatter(read(file)).data.name),
      ...skills.map((name) => parseFrontmatter(read(`skills/${name}/SKILL.md`)).data.name),
    ];
    expect(new Set(names).size).toBe(31);
  });
});

describe('active documentation', () => {
  it.each(['AGENTS.md', 'README.md', 'skills/index.md'])('%s lists the utility skills', (file) => {
    const text = read(file);
    expect(text).toContain('dh-execute-cli');
    expect(text).toContain('dh-explore');
    expect(text).toContain('dh-code-query');
  });
});

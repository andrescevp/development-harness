/**
 * research-contract.test.ts — cross-cutting contract for the dh-researcher /
 * dh-research integration: asset shape, the single docs/research registry, the
 * optional `## Research` plan section, the optional execution unblock, and the
 * planning delegation hooks.
 *
 * Stable phrases and section order only — no prose snapshots. Corpus inventory
 * (7 agents / 30 skills) stays in the assets/frontmatter/registration tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { renderFastPlan } from '../tools/plan-fast-template.js';
import { parsePlan } from '../tools/plan-lifecycle.js';
import { planScaffold } from '../tools/plan-template.js';
import { REPO_ROOT, read } from './helpers/repo.js';
import { contentLines, reference, skill } from './helpers/skills.js';

const RESEARCH_AGENT = path.join(REPO_ROOT, 'agents', 'dh-researcher.md');
const RESEARCH_SKILL = skill('dh-research');
const RESEARCH_INDEX = path.join(REPO_ROOT, 'docs', 'research', 'index.md');
const PHASED_TEMPLATE = reference('dh-planning', 'phased-plan-template.md');
const PHASED_FIXTURE = path.join(REPO_ROOT, 'src', '__tests__', 'fixtures', 'plans', 'phased-plan.md');

/** The plan shape inside the reference template's fenced ```markdown block. */
function templateBody(text: string): string {
  return /```markdown\n([\s\S]*?)\n```/.exec(text)?.[1] ?? text;
}

const RESEARCH = '## Research';
const AGENT_SELECTION = '## Agent Selection';
const PHASES = '## Phases';

/** 0-based line index of an exact top-level heading, or -1 (fence-aware). */
function headingLine(text: string, heading: string): number {
  let inFence = false;
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && line.trimEnd() === heading) return index;
  }
  return -1;
}

/** Literal occurrences of a needle. */
function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

const AGENT_TEXT = read(RESEARCH_AGENT);
const SKILL_TEXT = read(RESEARCH_SKILL);
const TEMPLATE_TEXT = templateBody(read(PHASED_TEMPLATE));
const FIXTURE_TEXT = read(PHASED_FIXTURE);
const SCAFFOLD_TEXT = planScaffold({
  slug: 'research-contract',
  title: 'Research Contract',
  objective: 'Prove the scaffold exposes the optional research section.',
  phases: [],
});

describe('research assets', () => {
  const agent = parseFrontmatter(AGENT_TEXT);
  const research = parseFrontmatter(SKILL_TEXT);

  it('ships parseable agent and skill frontmatter with no static tool rules', () => {
    expect(fs.existsSync(RESEARCH_AGENT)).toBe(true);
    expect(fs.existsSync(RESEARCH_SKILL)).toBe(true);
    expect(agent.data.name).toBe('dh-researcher');
    expect(research.data.name).toBe('dh-research');
    for (const doc of [agent, research]) {
      expect(String(doc.data.description).trim().length).toBeGreaterThan(0);
      expect(doc.data.permission).toBeUndefined();
      expect(doc.data.tools).toBeUndefined();
    }
  });

  it('registers a subagent with read-only browsing tools', () => {
    expect(agent.data.mode).toBe('subagent');
    const tools = String(research.data['allowed-tools'] ?? '')
      .split(',')
      .map((tool) => tool.trim())
      .sort();
    expect(tools).toEqual(['read', 'webfetch', 'websearch']);
  });

  it('stays within the audit line limits (agent 300, skill 250)', () => {
    expect(contentLines(RESEARCH_AGENT)).toBeLessThan(300);
    expect(contentLines(RESEARCH_SKILL)).toBeLessThan(250);
  });
});

describe('research note contract', () => {
  it('pins one registry, cited findings, and one question per run', () => {
    expect(SKILL_TEXT).toContain('docs/research/<topic>.md');
    expect(SKILL_TEXT).toContain('docs/research/index.md');
    expect(SKILL_TEXT).toMatch(/source URL/i);
    expect(SKILL_TEXT).toMatch(/retrieval date/i);
    expect(SKILL_TEXT).toMatch(/one run, one question/i);
  });

  it('hands persistence to the documentation owner', () => {
    expect(SKILL_TEXT).toContain('dh-create-documentation');
    expect(SKILL_TEXT).toMatch(/documentation owner/i);
  });

  it('rejects plan-local research folders and loop-step framing', () => {
    expect(SKILL_TEXT).not.toContain('docs/plans/<slug>/research/');
    expect(SKILL_TEXT).not.toContain('loop step 2.4');
    expect(SKILL_TEXT).not.toMatch(/step 2\.4/i);
  });

  it('keeps the researcher read-only and free of removed agent names', () => {
    expect(AGENT_TEXT).toContain('docs/research/');
    expect(AGENT_TEXT).toMatch(/no writes/i);
    expect(AGENT_TEXT).not.toMatch(/@dh-(explorer|executor)\b/);
    expect(AGENT_TEXT).not.toContain('loop step 2.4');
    expect(AGENT_TEXT).not.toMatch(/step 2\.4/i);
  });
});

describe('workspace research registry', () => {
  it('exists with documentation frontmatter and the canonical table header', () => {
    expect(fs.existsSync(RESEARCH_INDEX)).toBe(true);
    const index = read(RESEARCH_INDEX);
    const { data } = parseFrontmatter(index);
    for (const key of ['title', 'project', 'tags'] as const) expect(data[key], key).toBeDefined();
    expect(index).toContain('| Date | Topic | Question | Confidence | Used by | Note |');
  });
});

describe('optional ## Research plan section', () => {
  const ORDERED = [
    { name: 'template', body: TEMPLATE_TEXT },
    { name: 'scaffold', body: SCAFFOLD_TEXT },
    { name: 'canonical fixture', body: FIXTURE_TEXT },
  ];

  it.each(ORDERED)('$name exposes a top-level ## Research section', ({ body }) => {
    expect(headingLine(body, RESEARCH)).toBeGreaterThanOrEqual(0);
  });

  it.each(ORDERED)('$name orders Research, Agent Selection, then Phases', ({ body }) => {
    const research = headingLine(body, RESEARCH);
    const selection = headingLine(body, AGENT_SELECTION);
    const phases = headingLine(body, PHASES);
    expect(research).toBeGreaterThanOrEqual(0);
    expect(research).toBeLessThan(selection);
    expect(selection).toBeLessThan(phases);
  });

  it.each(ORDERED)('$name keeps Research outside the phases region', ({ body }) => {
    const tail = body.split('\n').slice(headingLine(body, PHASES));
    expect(tail).not.toContain(RESEARCH);
  });

  it('scaffolds the placeholder instead of a fabricated note link', () => {
    expect(SCAFFOLD_TEXT).toContain('None — no research consulted');
    expect(SCAFFOLD_TEXT).not.toContain('node-eol.md');
  });

  it('omits Research from the fast mirror on every documented surface', () => {
    const rendered = renderFastPlan({
      slug: 'research-contract',
      sourceContents: FIXTURE_TEXT,
      sourcePlan: parsePlan(FIXTURE_TEXT),
      timestamp: '2026-11-16T00:00:00.000Z',
    });
    expect(rendered.contents).toContain('`## Research`');
    const surfaces = [skill('dh-execute-plan-fast'), reference('dh-execute-plan-fast', 'plan-fast-template.md')];
    for (const file of [...surfaces, skill('dh-review')]) {
      const text = read(file);
      expect(count(text, '`## Research`'), file).toBe(1);
      expect(text, file).toMatch(/omitted|omits|omission/i);
    }
  });
});

describe('execution integration', () => {
  const EXECUTION_SKILLS = [
    { mode: 'standard', file: skill('dh-execute-plan-task'), halt: 'Hard blockers halt automation' },
    { mode: 'fast', file: skill('dh-execute-plan-task-fast'), halt: 'Hard blockers still halt automation' },
  ];

  it.each(EXECUTION_SKILLS)('$mode mode carries one research line and keeps the halt', ({ file, halt }) => {
    const text = read(file);
    expect(count(text, 'dh-research')).toBe(1);
    expect(text).toMatch(/^- \*\*Optional external-fact unblock/m);
    expect(text).toMatch(/run `dh-research` for ONE cited pass/);
    expect(text).toMatch(/documentation owner registers the note under `docs\/research\/`/);
    expect(text).toContain(halt);
  });
});

describe('planning integration', () => {
  it.each(['dh-planning', 'dh-grill-sdd', 'dh-contingency'])(
    '%s may delegate an external-fact question to dh-research',
    (name) => {
      expect(read(skill(name))).toContain('dh-research');
    }
  );

  it('registers Research as a capability role and documents the handoff rows', () => {
    expect(read(reference('dh-planning', 'agent-selection.md'))).toContain('| Research |');
    const docs = read(reference('dh-create-documentation', 'workspace-docs.md'));
    expect(docs).toContain('docs/research/<topic>.md');
    expect(docs).toContain('docs/research/index.md');
  });

  it('rates contingency alternatives only on verified facts', () => {
    expect(read(skill('dh-contingency'))).toContain('rated only on verified facts');
  });
});

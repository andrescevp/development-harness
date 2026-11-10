/**
 * workspace-plan-contract.test.ts — Workspace Impact + Execution Record (R3, R9).
 *
 * Structural assertions over the plan/SDD templates, the generated scaffold,
 * the shared execution-record reference, the plans index, and the execution /
 * review / documentation skills that must link the reference. Also proves the
 * phased parser tolerates both new sections and legacy plans without them.
 * Deterministic: file reads + pure render/parse calls only.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderFastPlan } from '../tools/plan-fast-template.js';
import { appendPlanIndexRow } from '../tools/plan-io.js';
import { parsePlan } from '../tools/plan-lifecycle.js';
import { planScaffold } from '../tools/plan-template.js';
import { REPO_ROOT, read } from './helpers/repo.js';

const REFS = path.join(REPO_ROOT, 'skills', 'dh-planning', 'references');
const TEMPLATE = path.join(REFS, 'phased-plan-template.md');
const RECORD = path.join(REFS, 'execution-record.md');
const FIXTURE = path.join(REPO_ROOT, 'src', '__tests__', 'fixtures', 'plans', 'phased-plan.md');
const INDEX = path.join(REPO_ROOT, 'docs', 'plans', 'index.md');
const FAST_REF = path.join(REPO_ROOT, 'skills', 'dh-execute-plan-fast', 'references', 'plan-fast-template.md');

const SKILLS = {
  planning: path.join(REPO_ROOT, 'skills', 'dh-planning', 'SKILL.md'),
  grill: path.join(REPO_ROOT, 'skills', 'dh-grill-sdd', 'SKILL.md'),
  execute: path.join(REPO_ROOT, 'skills', 'dh-execute-plan', 'SKILL.md'),
  executeFast: path.join(REPO_ROOT, 'skills', 'dh-execute-plan-fast', 'SKILL.md'),
  finalReview: path.join(REPO_ROOT, 'skills', 'dh-final-review', 'SKILL.md'),
  docs: path.join(REPO_ROOT, 'skills', 'dh-create-documentation', 'SKILL.md'),
  review: path.join(REPO_ROOT, 'skills', 'dh-review', 'SKILL.md'),
} as const;

const RECORD_LINK = '../dh-planning/references/execution-record.md';
const IMPACT_HEADER = '| Package | Stack | Test | Build | Docs | Version policy |';
const INDEX_HEADER =
  '| Slug | Executed in (repo/path) | Plan path | Mirrored plan path | Summary | Architectural changes | Date |';
const RECORD_FIELDS = [
  'Execution status',
  'Executed at',
  'Workspace root',
  'Repository kind',
  'Repository path',
  'Branch / worktree',
  'Commit range',
  'Plan path',
  'Mirrored plan path',
  'Summary',
  'Architectural changes',
  'References',
] as const;

const SCAFFOLD = planScaffold({
  slug: 'demo-workspace-plan',
  title: 'Demo Workspace Plan',
  objective: 'Prove the workspace sections render and parse.',
  phases: [{ title: 'Phase One', subTasks: [{ title: 'First task', delegatedTo: 'dh-software-engineer' }] }],
});

/** Slice `text` between two headings; fails loudly when either is missing. */
function between(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  expect(from, `missing ${start}`).toBeGreaterThanOrEqual(0);
  expect(to, `missing ${end}`).toBeGreaterThan(from);
  return text.slice(from, to);
}

describe('plan template: Workspace Impact', () => {
  const template = read(TEMPLATE);

  it('places the section after Scope and before Assumptions, outside Phases', () => {
    const scopeToAssumptions = between(template, '## Scope', '## Assumptions and Constraints');
    expect(scopeToAssumptions).toContain('## Workspace Impact');
    const phasesToFinal = between(template, '## Phases', '## Final Integration & Verification');
    expect(phasesToFinal).not.toContain('## Workspace Impact');
  });

  it('documents the compact package matrix and the standalone fallback', () => {
    expect(template).toContain(IMPACT_HEADER);
    expect(template).toMatch(/None — standalone repository/);
    expect(template).toContain('Shared paths');
    for (const column of ['Test', 'Build', 'Docs', 'Version policy']) expect(template).toContain(column);
  });

  it('requires the section only when a workspace map exists', () => {
    expect(template).toMatch(/`?WORKSPACE\.md`?/);
    expect(template).toMatch(/optional/i);
  });
});

describe('plan template: Execution Record', () => {
  const template = read(TEMPLATE);

  it('places the section after Final Integration, before Open Questions, outside Phases', () => {
    const finalToOpen = between(template, '## Final Integration & Verification', '## Open Questions');
    expect(finalToOpen).toContain('## Execution Record');
    const phasesToFinal = between(template, '## Phases', '## Final Integration & Verification');
    expect(phasesToFinal).not.toContain('## Execution Record');
  });

  it.each(RECORD_FIELDS)('documents the %s field', (field) => {
    expect(template).toContain(`- **${field}:**`);
  });

  it('links the shared execution-record reference outside the fenced template', () => {
    expect(template).toContain('execution-record.md');
    expect(read(RECORD)).toMatch(/^# Execution Record/m);
  });
});

describe('generated scaffold', () => {
  it('includes Workspace Impact after Scope and before Assumptions', () => {
    const section = between(SCAFFOLD, '## Scope', '## Assumptions and Constraints');
    expect(section).toContain('## Workspace Impact');
    expect(section).toContain(IMPACT_HEADER);
    expect(section).toContain('Shared paths');
  });

  it('includes Execution Record after Final Integration and before Open Questions', () => {
    const section = between(SCAFFOLD, '## Final Integration & Verification', '## Open Questions');
    expect(section).toContain('## Execution Record');
    for (const field of RECORD_FIELDS) expect(section).toContain(`- **${field}:**`);
  });

  it('stays parseable and outside the phases region', () => {
    const phases = between(SCAFFOLD, '## Phases', '## Final Integration & Verification');
    expect(phases).not.toContain('## Workspace Impact');
    expect(phases).not.toContain('## Execution Record');
    const plan = parsePlan(SCAFFOLD);
    expect(plan.phases.map((phase) => phase.title)).toEqual(['Phase One']);
    expect(plan.phases[0]?.subTasks[0]?.delegatedTo).toBe('dh-software-engineer');
  });
});

describe('parser tolerance', () => {
  const legacy = read(FIXTURE);
  const withSections = `${legacy.replace(
    '## Assumptions and Constraints',
    `## Workspace Impact\n\n- **Workspace root:** None — standalone repository\n\n${IMPACT_HEADER}\n|---|---|---|---|---|---|\n\n## Assumptions and Constraints`
  )}\n## Execution Record\n\n- **Execution status:** Not executed\n`;

  it('parses a legacy plan without either section', () => {
    expect(legacy).not.toContain('## Workspace Impact');
    expect(legacy).not.toContain('## Execution Record');
    expect(parsePlan(legacy).phases).toHaveLength(2);
  });

  it('parses a plan carrying both sections exactly like the legacy one', () => {
    expect(parsePlan(withSections)).toEqual(parsePlan(legacy));
  });
});

describe('execution-record reference', () => {
  const text = read(RECORD);

  it('lists every field and the status vocabulary', () => {
    for (const field of RECORD_FIELDS) expect(text).toContain(field);
    for (const status of ['In progress', 'Completed', 'Completed with deferrals', 'Not executed']) {
      expect(text).toContain(status);
    }
  });

  it('documents the index row and the T1–T5 timing', () => {
    expect(text).toContain(INDEX_HEADER);
    for (const timing of ['T1', 'T2', 'T3', 'T4', 'T5']) expect(text).toContain(timing);
  });

  it('forbids package-local plan roots and secrets', () => {
    expect(text).toMatch(/package-local/i);
    expect(text).toMatch(/secrets/i);
  });
});

describe('plans index', () => {
  const index = read(INDEX);

  it('keeps the main 7-column table and exactly one Execution Records table', () => {
    expect(index).toContain('| Title | Slug | Description | Created | Updated | Status | Active |');
    expect(index.split('## Execution Records')).toHaveLength(2);
    expect(index.split(INDEX_HEADER)).toHaveLength(2);
    expect(index.indexOf('## Execution Records')).toBeLessThan(index.indexOf('## Plans'));
  });

  it('matches the documented header exactly', () => {
    const section = index.slice(index.indexOf('## Execution Records'));
    const header = section.split('\n').find((line) => line.startsWith('| Slug |'));
    expect(header).toBe(INDEX_HEADER);
  });
});

describe('plans index append', () => {
  it('appends dh_plan_create rows to the plans table when Execution Records comes first', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dh-plan-index-'));
    try {
      const target = path.join(root, 'docs', 'plans', 'index.md');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, read(INDEX));
      appendPlanIndexRow(root, 'new-plan', 'New Plan');
      const updated = fs.readFileSync(target, 'utf8');
      const execution = updated.indexOf('## Execution Records');
      const plans = updated.indexOf('## Plans');
      expect(execution).toBeGreaterThanOrEqual(0);
      expect(plans).toBeGreaterThan(execution);
      expect(updated.slice(plans)).toContain('| New Plan | new-plan | New Plan |');
      const before = read(INDEX);
      expect(updated.slice(execution, plans)).toBe(before.slice(execution, plans));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('skills carry Workspace Impact and link the record reference', () => {
  it('dh-planning requires Workspace Impact when the workspace map exists', () => {
    const text = read(SKILLS.planning);
    expect(text).toContain('## Workspace Impact');
    expect(text).toContain('WORKSPACE.md');
    expect(text).toMatch(/None — standalone repository/);
  });

  it('dh-grill-sdd asks for packages, commands, docs and version policy', () => {
    const text = read(SKILLS.grill);
    expect(text).toContain('## Workspace Impact');
    expect(text).toContain(IMPACT_HEADER);
    for (const topic of ['affected packages', 'test command', 'build command', 'docs root', 'version policy']) {
      expect(text).toContain(topic);
    }
  });

  it('dh-review fast omitted list includes Workspace Impact and Execution Record', () => {
    const text = read(SKILLS.review);
    expect(text).toContain('## Workspace Impact');
    expect(text).toContain('## Execution Record');
  });

  it.each(['execute', 'executeFast', 'finalReview', 'docs'] as const)('%s links the record reference', (key) => {
    const file = SKILLS[key];
    expect(read(file)).toContain(RECORD_LINK);
    expect(read(path.resolve(path.dirname(file), RECORD_LINK))).toMatch(/^# Execution Record/m);
  });

  it('keeps every touched skill under the 250-line limit', () => {
    for (const file of Object.values(SKILLS)) expect(read(file).split('\n').length, file).toBeLessThan(250);
  });
});

describe('fast mode omits the new top-level sections', () => {
  it('lists Workspace Impact and Execution Record as omitted in the reference and the skill', () => {
    for (const file of [FAST_REF, SKILLS.executeFast]) {
      const text = read(file);
      expect(text).toContain('`## Workspace Impact`');
      expect(text).toContain('`## Execution Record`');
    }
  });

  it('renders the omitted list into the generated mirror', () => {
    const mirror = renderFastPlan({
      slug: 'demo-workspace-plan',
      sourceContents: SCAFFOLD,
      sourcePlan: parsePlan(SCAFFOLD),
      timestamp: '2026-11-10T00:00:00.000Z',
    });
    expect(mirror.contents).toContain('`## Workspace Impact`');
    expect(mirror.contents).toContain('`## Execution Record`');
    expect(mirror.contents).not.toContain('## Execution Record\n');
  });
});

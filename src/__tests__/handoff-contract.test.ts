/**
 * handoff-contract.test.ts — guards the pause/resume handoff contract.
 *
 * Structural assertions only: the worked example in the handoff template must
 * stay parseable and complete, both lifecycle skills must keep their
 * validation/drift markers, and the plan status model must stay three-valued.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { PHASE_STATUSES } from '../tools/plan-lifecycle.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'skills', 'dh-pause-plan', 'references', 'handoff-template.md');
const PAUSE_SKILL_PATH = path.join(REPO_ROOT, 'skills', 'dh-pause-plan', 'SKILL.md');
const RESUME_SKILL_PATH = path.join(REPO_ROOT, 'skills', 'dh-resume-plan', 'SKILL.md');

const REQUIRED_KEYS = [
  'handoff_version',
  'plan_slug',
  'plan_path',
  'status',
  'created',
  'updated',
  'paused_at',
  'resumed_at',
  'branch',
  'base_commit',
  'worktree_dirty',
  'worktree_fingerprint',
  'plan_sha256',
  'phase_index',
  'subtask_index',
  'progress',
  'next_action',
  'blocked',
  'tags',
  'project',
] as const;

const REQUIRED_SECTIONS = [
  'Snapshot',
  'Current Position',
  'Work Completed',
  'Work In Flight',
  'Uncommitted Changes',
  'Decisions and Rationale',
  'Blockers and Risks',
  'Validation State',
  'Next Steps',
  'Resume Checklist',
  'Pause History',
] as const;

const HISTORY_EVENTS = ['paused', 'resumed', 're-paused'] as const;
const PAUSE_MARKERS = [
  'dh_plan_read',
  'plan_sha256',
  'worktree_fingerprint',
  'status: paused',
  're-paused',
  'dh-resume-plan',
];
const RESUME_MARKERS = [
  'handoff_version',
  'status: paused',
  'merge-base --is-ancestor',
  'plan_sha256',
  'worktree_fingerprint',
  '--diff-filter=U',
  'status: resumed',
  'resumed_at',
  'dh-execute-plan',
];

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function countLines(text: string): number {
  const lines = text.split('\n');
  return text.endsWith('\n') ? lines.length - 1 : lines.length;
}

function workedExample(template: string): string {
  const templateSection = template.slice(template.indexOf('## Template'));
  const match = templateSection.match(/```markdown\n([\s\S]*?)\n```/);
  if (!match) throw new Error('worked example not found under ## Template');
  return match[1]!;
}

function firstNextStep(body: string): string {
  const nextSteps = body.slice(body.indexOf('## Next Steps'));
  const match = nextSteps.match(/^1\. (.+)$/m);
  if (!match) throw new Error('## Next Steps has no first numbered item');
  return match[1]!.replace(/`/g, '').trim();
}

function documentedFields(template: string): string[] {
  const section = template.slice(template.indexOf('## Frontmatter fields'), template.indexOf('## Required sections'));
  return [...section.matchAll(/^\|\s*`([a-z0-9_]+)`\s*\|/gm)].map((match) => match[1]!);
}

function documentedSections(template: string): string[] {
  const section = template.slice(template.indexOf('## Required sections'), template.indexOf('## Status lifecycle'));
  return [...section.matchAll(/^-\s+`##\s+([^`]+)`/gm)].map((match) => match[1]!.trim());
}

const templateText = read(TEMPLATE_PATH);
const example = workedExample(templateText);
const { data, body } = parseFrontmatter(example);
const pauseSkill = parseFrontmatter(read(PAUSE_SKILL_PATH));
const resumeSkill = parseFrontmatter(read(RESUME_SKILL_PATH));

describe('handoff worked example', () => {
  it('documents exactly the required fields and sections', () => {
    expect(documentedFields(templateText).sort()).toEqual([...REQUIRED_KEYS].sort());
    expect(documentedSections(templateText).sort()).toEqual([...REQUIRED_SECTIONS].sort());
  });

  it('has exactly the required frontmatter keys', () => {
    expect(Object.keys(data).sort()).toEqual([...REQUIRED_KEYS].sort());
  });

  it('matches the paused lifecycle and example identity', () => {
    expect(data.handoff_version).toBe(1);
    expect(data.status).toBe('paused');
    expect(data.resumed_at).toBeNull();
    expect(data.plan_slug).toBe('example-plan');
    expect(data.plan_path).toBe('docs/plans/example-plan/plan.md');
    expect(data.subtask_index).toBe('2.3');
    expect(data.phase_index).toBe(2);
    expect(data.tags).toEqual(['handoff', 'plan']);
    expect(String(data.worktree_fingerprint)).toMatch(/^[a-f0-9]{64}$/);
    expect(String(data.progress)).toMatch(/^\d+\/\d+$/);
  });

  it('contains every required section heading', () => {
    for (const section of REQUIRED_SECTIONS) {
      expect(body, section).toContain(`## ${section}`);
    }
  });

  it('documents the Pause History columns and event vocabulary', () => {
    const history = body.slice(body.indexOf('## Pause History'));
    const lines = history.split('\n');
    const headerIndex = lines.findIndex((line) => line.startsWith('| Timestamp |'));
    if (headerIndex < 0) throw new Error('Pause History header not found');
    expect(
      lines[headerIndex]!.split('|')
        .map((cell) => cell.trim())
        .filter(Boolean)
    ).toEqual(['Timestamp', 'Event', 'Position', 'Note']);

    const tableLines: string[] = [];
    for (const line of lines.slice(headerIndex + 1)) {
      if (!line.startsWith('|')) break;
      tableLines.push(line);
    }
    const rows = tableLines.filter((line) => !/^\|\s*-{2,}/.test(line));
    const events = rows.map((row) => row.split('|')[2]!.trim());
    expect(new Set(events)).toEqual(new Set(HISTORY_EVENTS));
  });

  it('keeps next_action equal to the first Next Steps item', () => {
    expect(data.next_action).toBe(firstNextStep(body));
  });
});

describe('pause and resume skills', () => {
  it('expose valid frontmatter and reference the contract', () => {
    expect(pauseSkill.data.name).toBe('dh-pause-plan');
    expect(resumeSkill.data.name).toBe('dh-resume-plan');
    expect(read(PAUSE_SKILL_PATH)).toContain('handoff-template.md');
    expect(read(RESUME_SKILL_PATH)).toContain('handoff-template.md');
  });

  it('keep the pause workflow markers', () => {
    const text = read(PAUSE_SKILL_PATH);
    for (const marker of PAUSE_MARKERS) expect(text, marker).toContain(marker);
  });

  it('keep the resume workflow markers', () => {
    const text = read(RESUME_SKILL_PATH);
    for (const marker of RESUME_MARKERS) expect(text, marker).toContain(marker);
  });
});

describe('plan status contract', () => {
  it('stays three-valued and has no Paused status', () => {
    expect(PHASE_STATUSES).toEqual(['Pending', 'In Progress', 'Completed']);
    expect(PHASE_STATUSES).toHaveLength(3);
    expect(PHASE_STATUSES).not.toContain('Paused');
  });

  it('keeps the handoff template within the skill-asset line limit', () => {
    expect(countLines(templateText)).toBeLessThanOrEqual(200);
  });
});

/**
 * plan-lifecycle.test.ts — pure helpers for the phased plan lifecycle (M2).
 * Parses the ST1 canonical fixture, tests status edits (idempotent,
 * minimally invasive), transition rules, scaffold template round-trip,
 * CRLF tolerance, error paths, and path-escape/symlink rejection.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildPlanTemplate, parsePlan, resolvePlanPath, setStatus } from '../tools/plan-lifecycle.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = fs.readFileSync(
  path.join(REPO_ROOT, 'src', '__tests__', 'fixtures', 'plans', 'phased-plan.md'),
  'utf8'
);

describe('parsePlan', () => {
  it('parses the canonical fixture into 2 phases and 3 sub-tasks', () => {
    const plan = parsePlan(FIXTURE);
    expect(plan.title).toBe('Example Phased Plan');
    expect(plan.meta.slug).toBe('example-phased-plan');
    expect(plan.phases).toHaveLength(2);
    expect(plan.phases.map((p) => p.title)).toEqual(['Foundation', 'Execution']);
    expect(plan.phases.map((p) => p.status)).toEqual(['In Progress', 'Pending']);
    const all = plan.phases.flatMap((p) => p.subTasks);
    expect(all).toHaveLength(3);
    expect(all.map((s) => s.index)).toEqual(['1.1', '1.2', '2.1']);
    expect(all.map((s) => s.status)).toEqual(['Completed', 'In Progress', 'Pending']);
  });

  it('captures Related Requirements on sub-tasks', () => {
    const plan = parsePlan(FIXTURE);
    const t11 = plan.phases[0]!.subTasks.find((s) => s.index === '1.1')!;
    expect(t11.relatedRequirements).toContain('R1');
  });

  it('does not cross sibling sections when collecting related requirements', () => {
    const doc = `---
title: T
slug: t
---
# T

## Phases

### Phase 1: P

- **Status:** Pending

#### Sub-Task 1.1: Without

- **Status:** Pending
- **Objective:** none

#### Sub-Task 1.2: With

- **Status:** Pending
- **Related Requirements:** R2
`;
    const plan = parsePlan(doc);
    expect(plan.phases[0]!.subTasks[0]!.relatedRequirements).toEqual([]);
    expect(plan.phases[0]!.subTasks[1]!.relatedRequirements).toEqual(['R2']);
  });

  it('round-trips the scaffold template output (everything Pending)', () => {
    const doc = buildPlanTemplate({
      slug: 'demo',
      title: 'Demo Plan',
      objective: 'Demo objective.',
      phases: [
        { title: 'Alpha', subTasks: [{ title: 'A1' }, { title: 'A2' }] },
        { title: 'Beta', subTasks: [{ title: 'B1' }] },
      ],
    });
    expect(doc.startsWith('---')).toBe(true);
    const plan = parsePlan(doc);
    expect(plan.phases).toHaveLength(2);
    expect(plan.phases[0]!.status).toBe('Pending');
    expect(plan.phases[0]!.subTasks.map((s) => s.index)).toEqual(['1.1', '1.2']);
    expect(plan.phases[1]!.subTasks[0]!.status).toBe('Pending');
  });

  it('tolerates a missing frontmatter header (meta {})', () => {
    const plan = parsePlan('# No Frontmatter\n\n## Phases\n\n### Phase 1: X\n\n- **Status:** Pending\n');
    expect(plan.meta).toEqual({});
    expect(plan.phases).toHaveLength(1);
  });

  it('throws on non-phased content and on orphan sub-tasks', () => {
    expect(() => parsePlan('# Flat\n\n## Sub-Tasks\n\n### Sub-Task 1: Old\n')).toThrow(/not a phased plan/);
    expect(() => parsePlan('## Phases\n\n#### Sub-Task 9.1: Orphan\n\n- **Status:** Pending\n')).toThrow(
      /orphan|not a phased plan/
    );
  });

  it('throws on unterminated frontmatter and invalid status values', () => {
    expect(() => parsePlan('---\nname: x\n## Phases\n')).toThrow(/frontmatter/);
    expect(() => parsePlan('## Phases\n\n### Phase 1: X\n\n- **Status:** Done\n')).toThrow(/invalid status/);
  });

  it('parses CRLF documents correctly (status + related)', () => {
    const crlf = FIXTURE.split('\n').join('\r\n');
    const plan = parsePlan(crlf);
    expect(plan.phases.map((p) => p.status)).toEqual(['In Progress', 'Pending']);
    expect(plan.phases[0]!.subTasks.find((s) => s.index === '1.1')!.relatedRequirements).toContain('R1');
  });
});

describe('setStatus', () => {
  it('updates a phase marker only (minimally invasive)', () => {
    const result = setStatus(FIXTURE, 'phase', '2', 'In Progress');
    expect(result.plan.phases[1]!.status).toBe('In Progress');
    expect(parsePlan(FIXTURE).phases[1]!.status).toBe('Pending');
    const a = FIXTURE.split('\n');
    const b = result.contents.split('\n');
    const diffs: number[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diffs.push(i);
    expect(diffs).toHaveLength(1);
    expect(b[diffs[0]!]).toBe('- **Status:** In Progress');
  });

  it('is idempotent for same-status updates', () => {
    const once = setStatus(FIXTURE, 'subtask', '1.1', 'Completed');
    const twice = setStatus(once.contents, 'subtask', '1.1', 'Completed');
    expect(twice.contents).toBe(once.contents);
  });

  it('updates a sub-task marker and re-parses', () => {
    const result = setStatus(FIXTURE, 'subtask', '2.1', 'In Progress');
    expect(result.plan.phases[1]!.subTasks[0]!.status).toBe('In Progress');
  });

  it('preserves CRLF when editing a CRLF document', () => {
    const crlf = FIXTURE.split('\n').join('\r\n');
    const result = setStatus(crlf, 'phase', '2', 'In Progress');
    expect(result.contents.includes('\r\n')).toBe(true);
    expect(result.plan.phases[1]!.status).toBe('In Progress');
    // Only one line differs and the edit keeps its CR.
    const editedLine = result.contents.split('\r\n').find((l) => l.includes('**Status:** In Progress'));
    expect(editedLine).toBe('- **Status:** In Progress');
  });

  it('rejects invalid statuses and unknown refs', () => {
    expect(() => setStatus(FIXTURE, 'phase', '2', 'Done' as never)).toThrow(/invalid status/);
    expect(() => setStatus(FIXTURE, 'subtask', '9.9', 'Pending')).toThrow(/not found/);
  });

  it('blocks phase → Completed while a sub-task is open (minimal transition rule)', () => {
    expect(() => setStatus(FIXTURE, 'phase', '1', 'Completed')).toThrow(/cannot complete/);
    const unlocked = setStatus(FIXTURE, 'subtask', '1.2', 'Completed');
    const completed = setStatus(unlocked.contents, 'phase', '1', 'Completed');
    expect(completed.plan.phases[0]!.status).toBe('Completed');
  });
});

describe('resolvePlanPath', () => {
  const root = path.join(os.tmpdir(), 'dhs-plan-path-test');

  it('anchors slug plans under docs/plans', () => {
    expect(resolvePlanPath(root, 'my-plan')).toBe(path.join(root, 'docs', 'plans', 'my-plan', 'plan.md'));
  });

  it('rejects an empty workspaceRoot (no CWD fallback)', () => {
    expect(() => resolvePlanPath('', 'my-plan')).toThrow(/workspace root/);
  });

  it('rejects escaping slugs', () => {
    expect(() => resolvePlanPath(root, '../evil')).toThrow(/invalid slug|escapes/);
    expect(() => resolvePlanPath(root, 'a/b')).toThrow(/invalid slug|escapes/);
  });

  it('rejects escaping explicit paths and absolute paths outside the anchor', () => {
    expect(() => resolvePlanPath(root, undefined, '../outside.md')).toThrow(/escapes/);
    expect(() => resolvePlanPath(root, undefined, '/etc/passwd')).toThrow(/escapes/);
  });

  it('accepts an explicit in-anchor path', () => {
    expect(resolvePlanPath(root, undefined, 'other/plan.md')).toBe(
      path.join(root, 'docs', 'plans', 'other', 'plan.md')
    );
  });

  it('requires slug or path', () => {
    expect(() => resolvePlanPath(root)).toThrow(/slug or path/);
  });

  it('rejects symlink traversal', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dhs-symlink-'));
    try {
      const plans = path.join(tmp, 'docs', 'plans');
      fs.mkdirSync(plans, { recursive: true });
      fs.writeFileSync(path.join(plans, 'target.md'), '# target\n');
      fs.symlinkSync(path.join(plans, 'target.md'), path.join(plans, 'evil.md'));
      expect(() => resolvePlanPath(tmp, undefined, 'evil.md')).toThrow(/symlink/);
      expect(resolvePlanPath(tmp, undefined, 'target.md')).toBe(path.join(plans, 'target.md'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

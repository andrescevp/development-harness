/**
 * dh-create-worktree skill contract.
 *
 * The skill must read the project-owned WORKTREE_LIFECYCLE.md, execute its
 * before/after create-merge-remove phases, allow worktrees to host different
 * plans on the same branch only at the user's request, and never generate the
 * lifecycle file (dh-setup owns its generation).
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { REPO_ROOT, read } from './helpers/repo.js';

const SKILL = path.join(REPO_ROOT, 'skills', 'dh-create-worktree', 'SKILL.md');
const SETUP = path.join(REPO_ROOT, 'skills', 'dh-setup', 'SKILL.md');
const SETUP_REF = path.join(REPO_ROOT, 'skills', 'dh-setup', 'references', 'worktree-lifecycle.md');
const INDEX = path.join(REPO_ROOT, 'skills', 'index.md');

const PHASES = [
  'Before create',
  'After create',
  'Before merge',
  'After merge',
  'Before remove',
  'After remove',
] as const;

describe('dh-create-worktree skill', () => {
  it('declares its frontmatter', () => {
    const { data } = parseFrontmatter(read(SKILL));
    expect(data.name).toBe('dh-create-worktree');
    expect(String(data.description)).toMatch(/worktree/i);
  });

  it.each(PHASES)('documents the %s lifecycle phase', (phase) => {
    expect(read(SKILL)).toContain(phase);
  });

  it('reads WORKTREE_LIFECYCLE.md and delegates generation to dh-setup', () => {
    const text = read(SKILL);
    expect(text).toContain('WORKTREE_LIFECYCLE.md');
    expect(text).toContain('dh-setup');
    expect(text).toMatch(/never (create|generate)/i);
  });

  it('allows same-branch reuse across plans only at the user request', () => {
    const text = read(SKILL);
    expect(text).toMatch(/same branch/i);
    expect(text).toMatch(/user(?:'s)? request/i);
    expect(text).toMatch(/plan/i);
  });

  it('ships the dh-setup template with all lifecycle sections', () => {
    const setup = read(SETUP);
    expect(setup).toContain('WORKTREE_LIFECYCLE.md');
    expect(setup).toContain('references/worktree-lifecycle.md');
    const ref = read(SETUP_REF);
    for (const phase of PHASES) expect(ref).toContain(phase);
  });

  it('is listed in the skills index', () => {
    expect(read(INDEX)).toContain('dh-create-worktree');
  });
});

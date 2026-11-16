/**
 * parallel-scheduler-contract.test.ts — pins the parallel plan metadata and the
 * shared scheduler contract used by both orchestrators.
 */
import { describe, expect, it } from 'vitest';
import { read } from './helpers/repo.js';
import { reference, skill } from './helpers/skills.js';

const SCHEDULER = reference('dh-execute-plan', 'parallel-scheduler.md');
const TEMPLATE = reference('dh-planning', 'phased-plan-template.md');

describe('parallel plan metadata', () => {
  it('documents every phase/sub-task field and its legacy default', () => {
    const text = read(TEMPLATE);
    for (const field of ['Parallelizable', 'Depends on', 'Files/Scope', 'Isolation']) {
      expect(text, field).toContain(`**${field}:**`);
    }
    expect(text).toMatch(/Parallelizable:\*\* no/);
    expect(text).toMatch(/Depends on:\*\* None/);
    expect(text).toMatch(/Files\/Scope:\*\* None/);
    expect(text).toMatch(/Isolation:\*\* shared/);
  });

  it('keeps planning guidance aligned with the fields', () => {
    const text = read(skill('dh-planning'));
    expect(text).toMatch(/Parallelizable|parallel metadata/i);
  });
});

describe('shared scheduler contract', () => {
  it('exists with readiness, concurrency, isolation, worker, and failure rules', () => {
    const text = read(SCHEDULER);
    for (const phrase of [
      'Parallelizable',
      'Depends on',
      'Files/Scope',
      'Isolation',
      'ready',
      '3',
      '8',
      'worker',
      'parallel-worker',
      'orchestrator',
      'drain',
      'worktree',
      'Resume',
      'fast',
    ]) {
      expect(text.toLowerCase(), phrase).toContain(phrase.toLowerCase());
    }
  });

  it('is the only detailed scheduler contract (orchestrators link it)', () => {
    expect(read(SCHEDULER)).toContain('authoritative');
    expect(read(skill('dh-execute-plan'))).toContain('parallel-scheduler.md');
  });

  it('defines a no-write worker mode in both task skills', () => {
    for (const name of ['dh-execute-plan-task', 'dh-execute-plan-task-fast']) {
      const text = read(skill(name));
      expect(text, name).toContain('Parallel Worker Mode');
      expect(text, name).toMatch(/parallel-worker/);
      expect(text, name).toMatch(/do not write|do \*\*not\*\* write/i);
    }
  });
});

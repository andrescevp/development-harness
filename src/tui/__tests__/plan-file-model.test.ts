/**
 * plan-file-model.test.ts — pure models behind the plan-file modal tabs.
 */
import { describe, expect, it } from 'vitest';
import { planFileMarkdown, planMermaidAscii, planTreeText } from '../plan-file-model.js';
import { fixture } from './helpers.js';

const PLAN = fixture('active-plan.md');

describe('plan-file-model', () => {
  it('strips YAML frontmatter for the Markdown tab', () => {
    const markdown = planFileMarkdown(PLAN);
    expect(markdown.startsWith('# Plan: Checkout Flow')).toBe(true);
    expect(markdown).not.toContain('status: In Progress');
    expect(markdown).toContain('## Objective');
  });

  it('keeps fenced mermaid blocks for the host renderer', () => {
    const withMermaid = PLAN.replace('## Phases', '```mermaid\ngraph TD\n  A-->B\n```\n\n## Phases');
    expect(planFileMarkdown(withMermaid)).toContain('```mermaid\ngraph TD');
  });

  it('renders a flowchart to ASCII and returns null for unsupported syntax', () => {
    const rendered = planMermaidAscii('graph TD\n  A[Start] --> B[End]');
    expect(rendered).toContain('Start');
    expect(rendered).toContain('End');
    expect(planMermaidAscii('sequenceDiagram\n  A->>B: hi')).toBeNull();
  });

  it('builds a phase/sub-task tree with status symbols and agents', () => {
    const tree = planTreeText(PLAN);
    expect(tree).toContain('✔ Phase 1: Domain and Contracts — Completed');
    expect(tree).toContain('▸ Phase 2: Checkout Service — In Progress');
    expect(tree).toContain('  ▸ 2.2 Wire payment retries — In Progress · dh-software-engineer');
  });

  it('degrades to a message for non-plan content', () => {
    expect(planTreeText('# Notes\n')).toContain('Plan tree unavailable');
  });
});

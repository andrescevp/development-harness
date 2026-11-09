/**
 * mermaid-skill.test.ts — structural contract for the `dh-mermaid` skill and
 * its integration points (planning, fast alignment, documentation).
 *
 * Guards the vendored reference corpus, the plan-diagram contract, the MIT
 * attribution, and the cross-skill wiring. No prose snapshots.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../lib/frontmatter.js';
import { renderFastPlan } from '../tools/plan-fast-template.js';
import { parsePlan } from '../tools/plan-lifecycle.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILL_DIR = path.join(REPO_ROOT, 'skills', 'dh-mermaid');
const SKILL = path.join(SKILL_DIR, 'SKILL.md');
const REFERENCES = path.join(SKILL_DIR, 'references');
const CONTRACT = path.join(REFERENCES, 'plan-diagrams.md');
const LICENSE = path.join(SKILL_DIR, 'LICENSE');

const VENDORED_REFERENCES = [
  'architecture.md',
  'block.md',
  'c4.md',
  'classDiagram.md',
  'config-configuration.md',
  'config-directives.md',
  'config-layouts.md',
  'config-math.md',
  'config-theming.md',
  'config-tidy-tree.md',
  'cynefin.md',
  'entityRelationshipDiagram.md',
  'eventmodeling.md',
  'examples.md',
  'flowchart.md',
  'gantt.md',
  'gitgraph.md',
  'ishikawa.md',
  'kanban.md',
  'mindmap.md',
  'packet.md',
  'pie.md',
  'quadrantChart.md',
  'radar.md',
  'railroad.md',
  'requirementDiagram.md',
  'sankey.md',
  'sequenceDiagram.md',
  'stateDiagram.md',
  'swimlanes.md',
  'timeline.md',
  'treemap.md',
  'treeView.md',
  'userJourney.md',
  'venn.md',
  'wardley.md',
  'xyChart.md',
  'zenuml.md',
] as const;

const CATEGORY_HEADINGS = ['## Current state', '## Desired state', '## Critical changes', '## Components'] as const;

const PLAN_TEMPLATE = path.join(REPO_ROOT, 'skills', 'dh-planning', 'references', 'phased-plan-template.md');
const PLAN_SCAFFOLD = path.join(REPO_ROOT, 'src', 'tools', 'plan-template.ts');
const FAST_RENDERER = path.join(REPO_ROOT, 'src', 'tools', 'plan-fast-template.ts');
const FAST_ALIGNMENT_FILES = [
  path.join(REPO_ROOT, 'skills', 'dh-execute-plan-fast', 'SKILL.md'),
  path.join(REPO_ROOT, 'skills', 'dh-execute-plan-fast', 'references', 'plan-fast-template.md'),
  path.join(REPO_ROOT, 'skills', 'dh-review', 'SKILL.md'),
] as const;

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

describe('dh-mermaid skill', () => {
  it('has valid frontmatter with a descriptive trigger', () => {
    const { data } = parseFrontmatter(read(SKILL));
    expect(data.name).toBe('dh-mermaid');
    expect(data.license).toBe('MIT');
    const description = String(data.description).toLowerCase();
    for (const term of ['current', 'desired', 'critical', 'component']) {
      expect(description, term).toContain(term);
    }
  });

  it('documents the plan-diagram set and categories', () => {
    const text = read(CONTRACT);
    for (const marker of ['current-state.md', 'desired-state.md', 'critical-changes.md', 'components.md']) {
      expect(text, marker).toContain(marker);
    }
    for (const heading of CATEGORY_HEADINGS) expect(text, heading).toContain(heading);
    expect(text).toContain('index.md');
    expect(text).toContain('classDef new');
    expect(text).toContain('classDef changed');
    expect(text).toContain('classDef removed');
  });

  it('vendors exactly the upstream reference corpus', () => {
    const files = fs
      .readdirSync(REFERENCES)
      .filter((file) => file.endsWith('.md') && file !== 'plan-diagrams.md')
      .sort();
    expect(files).toEqual([...VENDORED_REFERENCES].sort());
    expect(files).toHaveLength(38);
    expect(fs.existsSync(CONTRACT)).toBe(true);
  });

  it('keeps the MIT attribution and upstream provenance', () => {
    const text = read(LICENSE);
    expect(text).toContain('WH-2099');
    expect(text).toContain('Permission is hereby granted, free of charge');
    expect(text).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(text).toMatch(/Adapted from WH-2099\/mermaid-skill \(MIT\)/);
    expect(read(SKILL)).toContain('WH-2099/mermaid-skill');
  });
});

describe('dh-mermaid integration', () => {
  it('dh-planning routes structural plans through dh-mermaid', () => {
    const text = read(path.join(REPO_ROOT, 'skills', 'dh-planning', 'SKILL.md'));
    expect(text).toContain('dh-mermaid');
    expect(text).toContain('diagrams/');
    expect(text).toContain('## Visual Context');
  });

  it('plan template and scaffold both expose Visual Context', () => {
    expect(read(PLAN_TEMPLATE)).toContain('## Visual Context');
    expect(read(PLAN_SCAFFOLD)).toContain('## Visual Context');
    for (const file of [PLAN_TEMPLATE, PLAN_SCAFFOLD]) {
      expect(read(file), path.basename(file)).toContain('None — no structural change');
    }
  });

  it('documentation owners delegate complex diagrams to dh-mermaid', () => {
    const documentor = read(path.join(REPO_ROOT, 'agents', 'dh-documentor.md'));
    expect(documentor).toContain('dh-mermaid');
    expect(documentor).toContain('Diagram Workflow');
    const docsSkill = read(path.join(REPO_ROOT, 'skills', 'dh-create-documentation', 'SKILL.md'));
    expect(docsSkill).toContain('dh-mermaid');
  });

  it('fast alignment treats Visual Context as an allowed omission', () => {
    for (const file of FAST_ALIGNMENT_FILES) {
      expect(read(file), path.basename(path.dirname(file))).toContain('## Visual Context');
    }
  });

  it('plan template, scaffold, and fixture expose the Agent Selection section', () => {
    const fixture = path.join(REPO_ROOT, 'src', '__tests__', 'fixtures', 'plans', 'phased-plan.md');
    for (const file of [PLAN_TEMPLATE, PLAN_SCAFFOLD, fixture]) {
      const text = read(file);
      expect(text, path.basename(file)).toContain('## Agent Selection');
      expect(text.indexOf('## Agent Selection'), path.basename(file)).toBeLessThan(text.indexOf('\n## Phases\n'));
    }
    expect(read(PLAN_TEMPLATE), 'phased-plan-template.md').toContain('| Role | Selected agent | Why | Fallback |');
    for (const file of [PLAN_TEMPLATE, PLAN_SCAFFOLD, fixture]) {
      expect(read(file), path.basename(file)).toContain('| Role | Selected agent | Why | Fallback |');
    }
  });

  it('fast alignment treats Agent Selection as an allowed omission', () => {
    for (const file of FAST_ALIGNMENT_FILES) {
      expect(read(file), path.basename(path.dirname(file))).toContain('## Agent Selection');
    }
    expect(read(FAST_RENDERER)).toContain("'Agent Selection'");
  });

  it('fast generator lists Visual Context among the omitted sections', () => {
    const source = `---
title: Demo
slug: demo
project: demo
status: Pending
---

# Plan: Demo

## Visual Context

None — no structural change.

## Phases

### Phase 1: Alpha

- **Status:** Pending

#### Sub-Task 1.1: A1

- **Status:** Pending

## Final Integration & Verification

- **System-Wide Test:** done
`;
    const rendered = renderFastPlan({
      slug: 'demo',
      sourceContents: source,
      sourcePlan: parsePlan(source),
      timestamp: '2026-11-08T00:00:00.000Z',
    });
    expect(rendered.contents).toContain('`## Visual Context`');
    expect(rendered.contents).toContain('`## Agent Selection`');
  });
});

describe('repository links', () => {
  it('has no dead relative references', () => {
    const script = path.join(REPO_ROOT, 'scripts', 'check-links.mjs');
    expect(() => execFileSync(process.execPath, [script], { cwd: REPO_ROOT })).not.toThrow();
  });
});

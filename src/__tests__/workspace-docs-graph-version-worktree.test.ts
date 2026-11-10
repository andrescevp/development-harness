/** Structural contracts (R6/R7) for 3.1–3.5: docs, code graph, versioning, worktrees, package scope. */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, read } from './helpers/repo.js';
import { checklistItems, contentLines, reference, skill, skillFiles } from './helpers/skills.js';

const DOCS_REF = reference('dh-create-documentation', 'workspace-docs.md');
const GRAPH_REF = reference('dh-code-query', 'workspace-index.md');
const VERSION_REF = reference('dh-semver', 'monorepo-versioning.md');
const WORKTREE_REF = reference('dh-create-worktree', 'worktree-discovery.md');
const SCOPE_REF = reference('dh-pause-plan', 'package-scope.md');
const SETUP_GRAPH_REF = reference('dh-setup', 'code-graph-rag.md');
const HANDOFF_REF = reference('dh-pause-plan', 'handoff-template.md');
const DOCUMENTOR = path.join(REPO_ROOT, 'agents', 'dh-documentor.md');

describe('workspace-docs reference (3.1)', () => {
  const text = read(DOCS_REF);

  it('carries the workspace/package/vault decision table', () => {
    expect(text).toMatch(/^# Workspace docs/m);
    expect(text).toContain('| Artifact | Docs root | Frontmatter | Why |');
    expect(text).toContain('{workspace_root}/docs/');
    expect(text).toContain('{package}/docs/');
    expect(text).toContain('package: <name>');
    expect(text).toContain('OBSIDIAN_VAULT');
  });

  it('keeps evolution and observation notes at the workspace root', () => {
    expect(text).toContain('{workspace_root}/docs/evolution/<YYYY-MM-DD>-<slug>.md');
    expect(text).toContain('{workspace_root}/docs/evolution/observations/');
    expect(text).toMatch(/workspace-wide/);
  });

  it('warns about git toplevel vs the workspace map in submodules', () => {
    expect(text).toContain('git rev-parse --show-toplevel');
    expect(text).toContain('--show-superproject-working-tree');
    expect(text).toMatch(/submodule/);
    expect(text).toMatch(/never derive the workspace root from the git toplevel alone/i);
  });

  it('documents the standalone fallback and a validation checklist', () => {
    expect(text).toContain('## Standalone fallback');
    expect(checklistItems(text)).toBeGreaterThanOrEqual(6);
  });
});

describe('docs skill and documentor agent (3.1)', () => {
  it('dh-create-documentation links the reference and names both docs roots', () => {
    const text = read(skill('dh-create-documentation'));
    expect(text).toContain('references/workspace-docs.md');
    expect(text).toContain('{workspace_root}/docs');
    expect(text).toContain('{package}/docs');
    expect(text).toContain('OBSIDIAN_VAULT');
    expect(text).toMatch(/evolution[^\n]*workspace/i);
  });

  it('dh-documentor applies the workspace-first docs decision', () => {
    const text = read(DOCUMENTOR);
    expect(text).toContain('workspace-docs.md');
    expect(text).toContain('{workspace_root}/docs');
    expect(text).toContain('{package}/docs');
    expect(text).toContain('package: <name>');
    expect(text).toMatch(/standalone repository keeps/i);
  });
});

describe('workspace-index reference (3.2)', () => {
  const text = read(GRAPH_REF);

  it('distinguishes workspace, package and named cgr workspace indexes', () => {
    expect(text).toMatch(/^# Workspace index/m);
    expect(text).toContain('cgr start --repo-path <workspace_root> --update-graph');
    expect(text).toContain('cgr start --repo-path <package_root> --update-graph');
    expect(text).toContain('cgr workspace create <name>');
    expect(text).toContain('cgr workspace add-repo <name> <path>');
  });

  it('documents routing, the single-project graph rule and the scope line', () => {
    expect(text).toContain('## Routing table');
    expect(text).toContain('--workspace');
    expect(text).toContain('--repo-path');
    expect(text).toMatch(/single-project/);
    expect(text).toContain('**Scope:**');
    expect(text).toMatch(/false negatives/);
  });

  it('documents stale checks, fallback and a validation checklist', () => {
    expect(text).toContain('## Stale checks');
    expect(text).toContain('cgr status');
    expect(text).toContain('--update-graph');
    expect(text).toContain('## Standalone fallback');
    expect(checklistItems(text)).toBeGreaterThanOrEqual(6);
  });
});

describe('code-query skill and setup reference (3.2)', () => {
  it('dh-code-query links the routing reference and names the index scope', () => {
    const text = read(skill('dh-code-query'));
    expect(text).toContain('references/workspace-index.md');
    expect(text).toContain('workspace index');
    expect(text).toContain('package index');
    expect(text).toContain('--workspace');
    expect(text).toContain('--repo-path');
    expect(text).toContain('cgr status');
  });

  it('dh-setup code-graph reference explains workspace vs per-package indexing', () => {
    const text = read(SETUP_GRAPH_REF);
    expect(text).toContain('## Workspace And Package Indexing');
    expect(text).toContain('## Code-graph scope');
    expect(text).toContain('Index: workspace');
    expect(text).toContain('per package');
    expect(text).toContain('cgr workspace add-repo');
    expect(text).toContain('--workspace <name>');
    expect(text).toContain('WORKSPACE.md');
    expect(text).toContain('workspace-index.md');
  });
});

describe('monorepo versioning reference (3.3)', () => {
  const text = read(VERSION_REF);

  it('documents both policies from the workspace map', () => {
    expect(text).toMatch(/^# Monorepo versioning/m);
    expect(text).toContain('## Version policy');
    expect(text).toContain('## Fixed policy');
    expect(text).toContain('## Independent policy');
    expect(text).toContain('WORKSPACE.md');
  });

  it('documents per-package tags, changelog and release trains', () => {
    expect(text).toContain('<package>@<major>.<minor>.<patch>');
    expect(text).toContain('<package>@<X.Y.Z>');
    expect(text).toContain('--match "<package>@*"');
    expect(text).toContain('## Release trains and order');
    expect(text).toMatch(/dependency order/i);
    expect(text).toMatch(/CHANGELOG\.md/);
  });

  it('keeps confirmation-before-tagging and the standalone fallback', () => {
    expect(text).toContain('## Confirmation before tagging');
    expect(text).toMatch(/never push/i);
    expect(text).toMatch(/never infer/i);
    expect(text).toContain('## Standalone fallback');
    expect(checklistItems(text)).toBeGreaterThanOrEqual(6);
  });
});

describe('dh-semver skill (3.3)', () => {
  it('states the policy section and links the reference', () => {
    const text = read(skill('dh-semver'));
    expect(text).toContain('## Monorepo Version Policy');
    expect(text).toContain('references/monorepo-versioning.md');
    expect(text).toContain('WORKSPACE.md');
    expect(text).toMatch(/\*\*fixed\*\*/);
    expect(text).toMatch(/\*\*independent\*\*/);
    expect(text).toContain('<package>@<version>');
    expect(text).toMatch(/never push without confirmation/i);
    expect(text).toMatch(/standalone/i);
  });
});

describe('worktree-discovery reference (3.4)', () => {
  const text = read(WORKTREE_REF);

  it('documents discovery of the root and package lifecycle files', () => {
    expect(text).toMatch(/^# Worktree discovery/m);
    expect(text).toContain('## Discovery');
    expect(text).toContain('{workspace_root}/WORKTREE_LIFECYCLE.md');
    expect(text).toContain('<package>/WORKTREE_LIFECYCLE.md');
    expect(text).toContain('WORKSPACE.md');
  });

  it('documents the execution order and submodule branch alignment', () => {
    expect(text).toContain('## Execution order');
    expect(text).toContain('## Branch alignment');
    expect(text).toMatch(/detached HEAD/);
    expect(text).toMatch(/submodule pointer/);
    expect(text).toMatch(/same branch/);
  });

  it('documents missing files, failures and the checklist', () => {
    expect(text).toContain('## Missing files and failures');
    expect(text).toMatch(/missing root file stopped the operation/i);
    expect(text).toMatch(/no lifecycle file/);
    expect(checklistItems(text)).toBeGreaterThanOrEqual(6);
  });
});

describe('dh-create-worktree skill (3.4)', () => {
  it('links the discovery reference and keeps the reuse rule', () => {
    const text = read(skill('dh-create-worktree'));
    expect(text).toContain('## Discovery And Alignment');
    expect(text).toContain('references/worktree-discovery.md');
    expect(text).toMatch(/submodule/);
    expect(text).toMatch(/same-branch reuse rule/i);
    expect(text).toMatch(/one branch, one worktree/i);
  });
});

describe('package-scope reference (3.5)', () => {
  const text = read(SCOPE_REF);

  it('derives scope from Workspace Impact and fingerprints packages', () => {
    expect(text).toMatch(/^# Package scope/m);
    expect(text).toContain('## Workspace Impact');
    expect(text).toContain('Shared paths');
    expect(text).toContain('## Package fingerprint');
    expect(text).toContain('git hash-object');
    expect(text).toContain('64-hex');
  });

  it('reports unrelated dirty packages separately, not as drift', () => {
    expect(text).toContain('## Classification');
    expect(text).toMatch(/out of scope/);
    expect(text).toMatch(/never[^\n]*drift|not drift/i);
    expect(text).toMatch(/unattributed/);
  });

  it('defines the handoff field and the repo-wide fallback', () => {
    expect(text).toContain('## Handoff field');
    expect(text).toContain('## Package Scope');
    expect(text).toContain('## Repo-wide fallback');
    expect(text).toMatch(/handoff_version` stays `1/);
    expect(checklistItems(text)).toBeGreaterThanOrEqual(6);
  });
});

describe('pause/resume/domain skills (3.5)', () => {
  it('dh-pause-plan links the package-scope reference', () => {
    const text = read(skill('dh-pause-plan'));
    expect(text).toContain('references/package-scope.md');
    expect(text).toContain('## Workspace Impact');
    expect(text).toContain('## Package Scope');
    expect(text).toContain('fingerprint');
  });

  it('dh-resume-plan treats out-of-scope packages as explainable, not drift', () => {
    const text = read(skill('dh-resume-plan'));
    expect(text).toContain('../dh-pause-plan/references/package-scope.md');
    expect(text).toMatch(/out-of-scope package/);
    expect(text).toMatch(/explainable/);
    expect(text).toMatch(/repo-wide comparison/);
  });

  it('dh-domain-check uses the workspace package graph before directory heuristics', () => {
    const text = read(skill('dh-domain-check'));
    expect(text).toContain('WORKSPACE.md');
    expect(text).toContain('docs/WORKSPACE.md');
    expect(text).toMatch(/package graph/);
    expect(text).toMatch(/before any top-level directory heuristic/i);
    expect(text).toMatch(/## Workspace Impact/);
  });

  it('the handoff contract documents the optional section without a version bump', () => {
    const text = read(HANDOFF_REF);
    expect(text).toContain('## Package Scope');
    expect(text).toContain('package-scope.md');
    expect(text).toMatch(/no version bump/);
  });
});

describe('bundle limits', () => {
  it('keeps every SKILL.md under 250 content lines', () => {
    const files = skillFiles();
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      expect(contentLines(file), path.relative(REPO_ROOT, file)).toBeLessThan(250);
    }
  });

  it('keeps the documentor agent under the 300-line agent limit', () => {
    expect(contentLines(DOCUMENTOR)).toBeLessThan(300);
  });
});

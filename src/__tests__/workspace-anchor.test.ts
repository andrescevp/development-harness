/**
 * workspace-anchor.test.ts — plan/docs anchor contract (R1).
 *
 * Structural assertions over the shipped setup guidance and the normative
 * workspace contract, plus resolver checks proving `resolveWorkspaceRoot`
 * still reproduces the documented cwd × `DH_WORKSPACE_ROOT` decision table.
 * Deterministic: text reads only, one temp-dir fixture, no network or git.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveWorkspaceRoot } from '../mcp/workspace.js';
import { REPO_ROOT, read } from './helpers/repo.js';
import { withTempDir } from './helpers/temp-dir.js';

const SETUP = path.join(REPO_ROOT, 'skills', 'dh-setup', 'SKILL.md');
const MAP_REF = path.join(REPO_ROOT, 'skills', 'dh-setup', 'references', 'workspace-map.md');
const CONTRACT = path.join(REPO_ROOT, 'docs', 'plans', 'harness-monorepo-awareness', 'workspace-contract.md');

/** Detection markers required by R2 (and contract section 8). */
const MARKERS = [
  'pnpm-workspace.yaml',
  'package.json#workspaces',
  'turbo.json',
  'nx.json',
  'lerna.json',
  '[workspace]',
  'go.work',
  'settings.gradle',
  '.sln',
  '.gitmodules',
] as const;

/** `WORKSPACE.md` sections that must stay documented (1.2 acceptance criteria). */
const MAP_SECTIONS = [
  '## Workspace root',
  '## Packages',
  '## Aggregate commands',
  '## Docs roots',
  '## Code-graph scope',
  '## Worktree scope',
  '## Version policy',
] as const;

/**
 * Contract section 5 decision table: the MCP root each cwd/override pair
 * resolves to (column "MCP plan dir" is `<root>/docs/plans`).
 */
const DECISION_ROWS = [
  { row: 1, cwd: '/repo', override: undefined, root: '/repo' },
  { row: 2, cwd: '/repo', override: '/repo', root: '/repo' },
  { row: 3, cwd: '/repo', override: '/elsewhere', root: '/elsewhere' },
  { row: 4, cwd: '/repo', override: '../x', root: '/x' },
  { row: 5, cwd: '/repo/apps/web', override: undefined, root: '/repo/apps/web' },
  { row: 6, cwd: '/repo/apps/web', override: '/repo', root: '/repo' },
  { row: 7, cwd: '/repo/apps/web', override: '../..', root: '/repo' },
  { row: 8, cwd: '/solo', override: undefined, root: '/solo' },
  { row: 9, cwd: '/solo', override: '/solo', root: '/solo' },
  { row: 10, cwd: '/solo', override: '/other', root: '/other' },
] as const;

const planDir = (root: string): string => path.join(root, 'docs', 'plans');

describe('dh-setup workspace map reference', () => {
  it('ships the reference linked from the skill', () => {
    expect(read(SETUP)).toContain('references/workspace-map.md');
    expect(read(MAP_REF)).toMatch(/^# Workspace map/m);
  });

  it.each(MARKERS)('documents the %s detection marker', (marker) => {
    expect(read(SETUP)).toContain(marker);
    expect(read(MAP_REF)).toContain(marker);
  });

  it('requires markers plus user confirmation (no nested package.json inference)', () => {
    expect(read(SETUP)).toMatch(/confirm\s+with the user/i);
    expect(read(MAP_REF)).toMatch(/nested `package\.json` alone does\s+not\s+make a workspace/i);
  });

  it('probes upward and stops when a parent marker is found', () => {
    const ref = read(MAP_REF);
    expect(read(SETUP)).toMatch(/probe upward/i);
    expect(read(SETUP)).toMatch(/parent marker means restart at that root/i);
    expect(ref).toMatch(/marker is found above the cwd/i);
    expect(ref).toMatch(/map\s+declined/i);
  });

  it.each(MAP_SECTIONS)('templates the %s map section', (section) => {
    expect(read(MAP_REF)).toContain(section);
  });

  it('wires DH_WORKSPACE_ROOT to the absolute workspace root', () => {
    const ref = read(MAP_REF);
    expect(ref).toContain('DH_WORKSPACE_ROOT');
    expect(ref).toMatch(/absolute/i);
    expect(ref).toMatch(/environment/);
    expect(ref).toMatch(/relative values depend on the cwd/i);
  });

  it('keeps the standalone fallback unchanged', () => {
    expect(read(MAP_REF)).toMatch(/## Standalone fallback/);
    expect(read(MAP_REF)).toMatch(/standalone repository is never required/i);
  });
});

describe('dh-setup anchor verification', () => {
  it('verifies cwd, override and plan-dir agreement before writes', () => {
    const setup = read(SETUP);
    expect(setup).toContain('pwd -P');
    expect(setup).toContain('DH_WORKSPACE_ROOT');
    expect(setup).toContain('docs/plans');
    expect(setup).toMatch(/unset or\s+equal after realpath/i);
    expect(setup).toMatch(/on\s+mismatch STOP before any plan write/i);
    expect(setup).toMatch(/restart\s+at the workspace root/i);
  });

  it('lists the verification steps in the reference', () => {
    const ref = read(MAP_REF);
    expect(ref).toMatch(/## Anchor verification/);
    expect(ref).toContain('pwd -P');
    expect(ref).toContain('git rev-parse --show-toplevel');
    expect(ref).toContain('--show-superproject-working-tree');
    expect(ref).toContain('dh_plan_read');
    expect(ref).toMatch(/stop before the first write/i);
  });

  it('records the anchor item in the setup checklist', () => {
    expect(read(SETUP)).toMatch(/Step 3 anchor:.*pwd -P.*DH_WORKSPACE_ROOT/s);
  });
});

describe('workspace contract anchors', () => {
  const contract = read(CONTRACT);

  it('keeps the section 5 decision table header and all ten rows', () => {
    expect(contract).toMatch(/^\| # \| cwd \| `DH_WORKSPACE_ROOT` \|/m);
    for (const { row } of DECISION_ROWS) expect(contract).toMatch(new RegExp(`^\\| ${row} \\|`, 'm'));
  });

  it('keeps every documented verdict', () => {
    for (const verdict of [
      'OK — canonical',
      'Mismatch — stop',
      'Reject — relative override',
      'Consistent but wrong root — stop',
      'Split — stop',
    ]) {
      expect(contract).toContain(verdict);
    }
  });

  it('keeps the mismatch report codes and remediation', () => {
    expect(contract).toContain('[workspace-anchor-mismatch]');
    expect(contract).toContain('[plan-root-not-workspace-root]');
    expect(contract).toMatch(/restart opencode at \/repo/);
    expect(contract).toMatch(/package-local docs\/plans is not supported/i);
  });

  it('keeps the standalone fallback rule', () => {
    expect(contract).toMatch(/^## 8\. Standalone fallback/m);
    expect(contract).toContain('`DH_WORKSPACE_ROOT` unset is valid');
  });
});

describe('resolveWorkspaceRoot matches the documented decision table', () => {
  it.each(DECISION_ROWS)('row $row: cwd $cwd + override $override → $root', ({ cwd, override, root }) => {
    const env = override === undefined ? {} : { DH_WORKSPACE_ROOT: override };
    expect(planDir(resolveWorkspaceRoot({ env, cwd }))).toBe(planDir(root));
  });

  it('treats a blank override as unset (row 1)', () => {
    expect(resolveWorkspaceRoot({ env: { DH_WORKSPACE_ROOT: '   ' }, cwd: '/repo' })).toBe(path.resolve('/repo'));
  });

  it('reproduces the root + package-cwd split from rows 5 and 6', async () => {
    await withTempDir(async (dir) => {
      const workspace = path.join(dir, 'repo');
      const packageRoot = path.join(workspace, 'apps', 'web');
      fs.mkdirSync(packageRoot, { recursive: true });
      fs.writeFileSync(path.join(workspace, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');

      // Row 5: no override — both sides agree on the package, a wrong plan root.
      expect(planDir(resolveWorkspaceRoot({ env: {}, cwd: packageRoot }))).toBe(planDir(packageRoot));
      // Row 6: override = workspace root — the two sides split; stop before writes.
      expect(planDir(resolveWorkspaceRoot({ env: { DH_WORKSPACE_ROOT: workspace }, cwd: packageRoot }))).toBe(
        planDir(workspace)
      );
      expect(planDir(packageRoot)).not.toBe(planDir(workspace));
    });
  });
});

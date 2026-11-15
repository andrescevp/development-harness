/**
 * workspace-monorepo-fixtures.test.ts — R2/R8: detection markers, layout
 * fixtures and requirement coverage.
 *
 * Fixtures are static text trees under fixtures/workspaces/<layout>/; each
 * carries marker files, package roots and the expected `WORKSPACE.md` map so
 * the layout can be checked against the workspace-map template without running
 * any package manager. Deterministic: filesystem reads only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, read } from './helpers/repo.js';
import { reference, skill } from './helpers/skills.js';

const FIXTURES_DIR = path.join(REPO_ROOT, 'src', '__tests__', 'fixtures', 'workspaces');
const TESTS_DIR = path.join(REPO_ROOT, 'src', '__tests__');
const WORKSPACE_MAP_REF = reference('dh-setup', 'workspace-map.md');
const SETUP_SKILL = skill('dh-setup');

interface FileExpectation {
  file: string;
  includes: string[];
}

interface LayoutFixture {
  id: string;
  layout: string;
  files: FileExpectation[];
  packages: string[];
}

const LAYOUTS: LayoutFixture[] = [
  {
    id: 'pnpm',
    layout: 'pnpm workspace',
    files: [
      { file: 'pnpm-workspace.yaml', includes: ['packages:', 'apps/*', 'packages/*'] },
      { file: 'package.json', includes: ['"private": true'] },
      { file: 'apps/web/package.json', includes: ['"name": "@fixture/web"'] },
      { file: 'packages/core/package.json', includes: ['"name": "@fixture/core"'] },
    ],
    packages: ['apps/web', 'packages/core'],
  },
  {
    id: 'npm',
    layout: 'npm workspaces',
    files: [
      { file: 'package.json', includes: ['"workspaces"', 'apps/*', 'libs/*'] },
      { file: 'apps/console/package.json', includes: ['"name": "@fixture/console"'] },
      { file: 'libs/shared/package.json', includes: ['"name": "@fixture/shared"'] },
    ],
    packages: ['apps/console', 'libs/shared'],
  },
  {
    id: 'nx',
    layout: 'Nx',
    files: [
      { file: 'nx.json', includes: ['"workspaceLayout"'] },
      { file: 'package.json', includes: ['"private": true'] },
      { file: 'apps/shop/project.json', includes: ['"name": "shop"'] },
      { file: 'libs/ui/project.json', includes: ['"name": "ui"'] },
    ],
    packages: ['apps/shop', 'libs/ui'],
  },
  {
    id: 'turbo',
    layout: 'Turbo',
    files: [
      { file: 'turbo.json', includes: ['"tasks"', '"build"', '"test"'] },
      { file: 'pnpm-workspace.yaml', includes: ['apps/*'] },
      { file: 'package.json', includes: ['"private": true'] },
      { file: 'apps/dashboard/package.json', includes: ['"name": "@fixture/dashboard"'] },
    ],
    packages: ['apps/dashboard'],
  },
  {
    id: 'cargo',
    layout: 'Cargo workspace',
    files: [
      { file: 'Cargo.toml', includes: ['[workspace]', 'members', 'crates/engine'] },
      { file: 'crates/engine/Cargo.toml', includes: ['name = "engine"'] },
      { file: 'crates/engine/src/lib.rs', includes: ['pub fn name'] },
    ],
    packages: ['crates/engine'],
  },
  {
    id: 'go',
    layout: 'Go workspace',
    files: [
      { file: 'go.work', includes: ['use ./services/api'] },
      { file: 'services/api/go.mod', includes: ['module example.com/api'] },
    ],
    packages: ['services/api'],
  },
  {
    id: 'submodules',
    layout: 'Git submodules',
    files: [
      {
        file: '.gitmodules',
        includes: ['[submodule "engine"]', 'path = packages/engine', '[submodule "ui"]', 'path = packages/ui'],
      },
      { file: 'packages/engine/README.md', includes: ['submodule fixture'] },
      { file: 'packages/ui/README.md', includes: ['submodule fixture'] },
    ],
    packages: ['packages/engine', 'packages/ui'],
  },
];

const DETECTION_MARKERS = [
  'pnpm-workspace.yaml',
  'package.json#workspaces',
  'turbo.json',
  'nx.json',
  'lerna.json',
  '[workspace]',
  'go.work',
  'settings.gradle',
  '*.sln',
  '.gitmodules',
];

function fixturePath(id: string, file: string): string {
  return path.join(FIXTURES_DIR, id, file);
}

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

function templateSections(): string[] {
  const text = read(WORKSPACE_MAP_REF);
  const block = text.match(/```markdown\n([\s\S]*?)```/);
  if (!block) throw new Error('workspace-map.md is missing the markdown template block');
  const body = block[1] ?? '';
  return [...body.matchAll(/^## (.+)$/gm)].map((heading) => (heading[1] ?? '').trim()).filter(Boolean);
}

describe('workspace-map template sections', () => {
  it('keeps the section contract used by every fixture map', () => {
    expect(templateSections()).toEqual([
      'Workspace root',
      'Packages',
      'Aggregate commands',
      'Docs roots',
      'Code-graph scope',
      'Worktree scope',
      'Version policy',
    ]);
  });
});

describe('detection markers (R2)', () => {
  it.each(DETECTION_MARKERS)('dh-setup reference and skill name %s', (marker) => {
    expect(read(WORKSPACE_MAP_REF), marker).toContain(marker);
    expect(read(SETUP_SKILL), marker).toContain(marker);
  });
});

describe('layout fixtures (R2/R8)', () => {
  it.each(LAYOUTS)('$id ships its marker files ($layout)', ({ id, files }) => {
    for (const { file, includes } of files) {
      const fullPath = fixturePath(id, file);
      expect(fs.existsSync(fullPath), fullPath).toBe(true);

      for (const needle of includes) {
        expect(read(fullPath), `${file} must contain ${needle}`).toContain(needle);
      }
    }
  });

  it.each(LAYOUTS)('$id expected map covers every template section', ({ id }) => {
    const map = read(fixturePath(id, 'WORKSPACE.md'));

    expect(map).toContain('# Workspace Map');
    for (const section of templateSections()) {
      expect(map, `${id} map must contain ## ${section}`).toContain(`## ${section}`);
    }
  });

  it.each(LAYOUTS)('$id map lists existing package roots', ({ id, packages }) => {
    const map = read(fixturePath(id, 'WORKSPACE.md'));

    for (const pkg of packages) {
      const fullPath = fixturePath(id, pkg);
      expect(fs.statSync(fullPath).isDirectory(), fullPath).toBe(true);
      expect(map).toContain(`\`${pkg}\``);
    }
  });

  it('keeps every fixture path machine-independent', () => {
    const offenders = filesUnder(FIXTURES_DIR).filter((file) => {
      const text = read(file);
      return /\/(?:home|Users|tmp)\//.test(text) || /[A-Za-z]:[\\/]/.test(text);
    });

    expect(offenders).toEqual([]);
  });
});

interface RequirementCoverage {
  file: string;
  proves: string;
  needle: string;
}

const REQUIREMENT_COVERAGE: Record<string, RequirementCoverage> = {
  R1: { file: 'workspace-anchor.test.ts', proves: 'anchor decision table', needle: 'resolveWorkspaceRoot' },
  R2: {
    file: 'workspace-monorepo-fixtures.test.ts',
    proves: 'detection markers and layouts',
    needle: 'it.each(LAYOUTS)',
  },
  R3: { file: 'workspace-plan-contract.test.ts', proves: 'Workspace Impact parsing', needle: '## Workspace Impact' },
  R4: { file: 'workspace-gates-scope-rules.test.ts', proves: 'per-package gate commands', needle: 'pnpm -r' },
  R5: { file: 'workspace-gates-scope-rules.test.ts', proves: 'scoped diff commands', needle: 'git diff --name-only' },
  R6: {
    file: 'workspace-gates-scope-rules.test.ts',
    proves: 'CODE_RULES inheritance',
    needle: 'code-rules-resolution.md',
  },
  R7: {
    file: 'workspace-docs-graph-version-worktree.test.ts',
    proves: 'version policy contract',
    needle: '## Version policy',
  },
  R8: { file: 'workspace-agents.test.ts', proves: 'workspace-first agent guidance', needle: '## Workspace First' },
  R9: { file: 'workspace-plan-contract.test.ts', proves: 'execution record contract', needle: '## Execution Record' },
};

describe('requirement coverage (R1-R9)', () => {
  for (const [requirement, coverage] of Object.entries(REQUIREMENT_COVERAGE)) {
    it(`${requirement} is covered by ${coverage.file} (${coverage.proves})`, () => {
      const fullPath = path.join(TESTS_DIR, coverage.file);
      expect(fs.existsSync(fullPath), fullPath).toBe(true);

      const text = read(fullPath);
      expect(text, `${coverage.file} must name ${requirement}`).toContain(requirement);
      expect(text, `${coverage.file} must contain ${coverage.needle}`).toContain(coverage.needle);
      expect(text).toContain('it(');
    });
  }
});

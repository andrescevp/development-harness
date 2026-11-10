/**
 * workspace-gates-scope-rules.test.ts — R4/R5/R6 contracts.
 *
 * Structural assertions that the package-aware gates (`dh-preflight`,
 * `dh-artifact-check`), the scoped review skills (`dh-review`, `dh-code-review`,
 * `dh-simplify`, `dh-final-review`) and the CODE_RULES inheritance
 * (`dh-coding`, `dh-code-ruler`) document the workspace rules and link their
 * shared references, plus the 250-line SKILL.md limit.
 * Deterministic: file reads only.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT, read } from './helpers/repo.js';
import { checklistItems, contentLines, reference, skill, skillFiles } from './helpers/skills.js';

const GATES_REF = reference('dh-preflight', 'workspace-gates.md');
const DIFF_REF = reference('dh-review', 'workspace-diff-scope.md');
const RULES_REF = reference('dh-coding', 'code-rules-resolution.md');

const GATES_TITLE = /^# Workspace gates/m;
const DIFF_TITLE = /^# Workspace diff scope/m;

const GATE_SKILLS = {
  preflight: { file: skill('dh-preflight'), link: 'references/workspace-gates.md', table: '## Package Gates' },
  artifact: {
    file: skill('dh-artifact-check'),
    link: '../dh-preflight/references/workspace-gates.md',
    table: '## Package Builds',
  },
} as const;

const REVIEW_SKILLS = {
  review: { file: skill('dh-review'), link: 'references/workspace-diff-scope.md' },
  codeReview: { file: skill('dh-code-review'), link: '../dh-review/references/workspace-diff-scope.md' },
  simplify: { file: skill('dh-simplify'), link: '../dh-review/references/workspace-diff-scope.md' },
  finalReview: { file: skill('dh-final-review'), link: '../dh-review/references/workspace-diff-scope.md' },
} as const;

/** A skill must carry the section and a link that resolves to a titled reference. */
function expectImpactAndLink(entry: { file: string; link: string }, title: RegExp): void {
  const text = read(entry.file);
  expect(text).toContain('## Workspace Impact');
  expect(text).toContain(entry.link);
  expect(read(path.resolve(path.dirname(entry.file), entry.link))).toMatch(title);
}

describe('workspace-gates reference (R4)', () => {
  const text = read(GATES_REF);

  it('documents the command patterns for every supported aggregator', () => {
    for (const pattern of [
      'pnpm -r',
      '--filter',
      'npm test --workspace',
      'yarn workspace',
      'nx affected',
      'turbo run',
      'cargo test --workspace',
      'go.work',
      'dotnet test',
      'gradlew',
    ]) {
      expect(text, pattern).toContain(pattern);
    }
  });

  it('documents affected-vs-aggregate selection and the aggregate caveat', () => {
    expect(text).toContain('## Affected vs aggregate selection');
    expect(text).toMatch(/aggregate never replaces a package row/i);
    expect(text).toMatch(/affected mode is the default/i);
  });

  it('documents unknown packages, skipped packages and the false-green rule', () => {
    expect(text).toMatch(/unknown package/i);
    expect(text).toMatch(/never report green/i);
    expect(text).toMatch(/pass \/ fail \/ skipped/i);
    expect(text).toMatch(/not validated/i);
  });

  it('documents the standalone fallback and a validation checklist', () => {
    expect(text).toContain('## Standalone fallback');
    expect(checklistItems(text)).toBeGreaterThanOrEqual(6);
  });
});

describe('package-aware gate skills (R4)', () => {
  it.each(Object.entries(GATE_SKILLS))('%s reads Workspace Impact and links the shared reference', (_key, entry) => {
    expectImpactAndLink(entry, GATES_TITLE);
    expect(read(entry.file)).toContain(entry.table);
  });

  it.each(Object.entries(GATE_SKILLS))('%s reports per package and forbids false green', (_key, entry) => {
    const text = read(entry.file);
    expect(text).toMatch(/pass \/ fail \/ skipped/i);
    expect(text).toMatch(/never report green/i);
    expect(text).toMatch(/unknown package/i);
    expect(text).toMatch(/unvalidated|did not run/i);
  });

  it.each(Object.entries(GATE_SKILLS))('%s keeps the standalone single-root behavior', (_key, entry) => {
    const text = read(entry.file);
    expect(text).toMatch(/standalone/i);
    expect(text).toMatch(/single-root|single-table report/i);
  });
});

describe('workspace-diff-scope reference (R5)', () => {
  const text = read(DIFF_REF);

  it('documents the path-derivation formula and the scoped git commands', () => {
    expect(text).toMatch(/path derivation/i);
    expect(text).toMatch(/paths = affected_packages/);
    expect(text).toContain('git diff --name-only <base>...HEAD -- <paths>');
    expect(text).toContain('git diff <base>...HEAD -- <paths>');
    expect(text).toContain('git diff HEAD -- <paths>');
    expect(text).toContain('git status --porcelain -- <paths>');
    expect(text).toMatch(/`--` before the paths/);
  });

  it('documents root/shared handling and package labels', () => {
    expect(text).toContain('## Root and shared files');
    expect(text).toMatch(/root\/shared/i);
    expect(text).toContain('## Package labels in findings');
    expect(text).toContain('`[workspace]`');
    expect(text).toMatch(/unaffected/i);
  });

  it('includes a two-package example and a validation checklist', () => {
    expect(text).toMatch(/## Two-package example/);
    expect(text).toMatch(/apps\/web/);
    expect(text).toMatch(/services\/api/);
    expect(checklistItems(text)).toBeGreaterThanOrEqual(6);
  });
});

describe('scoped review skills (R5)', () => {
  it.each(Object.entries(REVIEW_SKILLS))(
    '%s reads Workspace Impact and links the diff-scope reference',
    (_key, entry) => {
      expectImpactAndLink(entry, DIFF_TITLE);
    }
  );

  it.each(Object.entries(REVIEW_SKILLS))('%s scopes git diff with `-- <paths>` and labels packages', (_key, entry) => {
    const text = read(entry.file);
    expect(text).toMatch(/git diff[^\n]*--/);
    expect(text).toMatch(/unaffected/i);
    expect(text).toMatch(/package/i);
  });

  it.each(Object.entries(REVIEW_SKILLS))('%s keeps the standalone full diff', (_key, entry) => {
    expect(read(entry.file)).toMatch(/standalone[^\n]*full diff|full diff[^\n]*standalone/i);
  });
});

describe('CODE_RULES resolution reference (R6)', () => {
  const text = read(RULES_REF);

  it('documents the precedence table, discovery and conflicts', () => {
    expect(text).toMatch(/## Precedence/);
    expect(text).toContain('| File being written | Resolved rules | Why |');
    expect(text).toContain('## Package-root discovery');
    expect(text).toMatch(/longest/i);
    expect(text).toContain('## Conflicts');
    expect(text).toMatch(/never merged/i);
  });

  it('includes a worked example, the resolved-file report and a checklist', () => {
    expect(text).toMatch(/## Worked example/);
    expect(text).toMatch(/apps\/web\/CODE_RULES\.md/);
    expect(text).toMatch(/resolved file/i);
    expect(checklistItems(text)).toBeGreaterThanOrEqual(5);
  });
});

describe('CODE_RULES skills (R6)', () => {
  it('dh-coding resolves package rules first, then root, and reports the resolved file', () => {
    const text = read(skill('dh-coding'));
    expect(text).toContain('references/code-rules-resolution.md');
    expect(text).toMatch(/package[^\n]*first/i);
    expect(text).toMatch(/root `CODE_RULES\.md`/);
    expect(text).toMatch(/report the resolved file/i);
    expect(text).toMatch(/never merged/i);
    expect(text).toMatch(/standalone/i);
  });

  it('dh-code-ruler creates root defaults plus package overrides', () => {
    const text = read(skill('dh-code-ruler'));
    expect(text).toContain('../dh-coding/references/code-rules-resolution.md');
    expect(text).toMatch(/package override/i);
    expect(text).toMatch(/longest prefix/i);
    expect(text).toMatch(/root defaults/i);
    expect(text).toMatch(/standalone/i);
  });
});

describe('bundle limits', () => {
  it('keeps every SKILL.md under 250 lines', () => {
    for (const file of skillFiles()) {
      expect(contentLines(file), path.relative(REPO_ROOT, file)).toBeLessThan(250);
    }
  });
});

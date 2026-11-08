/**
 * plan-io.test.ts — plan-file I/O helpers (fd-based read + index append).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { appendPlanIndexRow, readPlanFile } from '../tools/plan-io.js';
import { plansIndexFile, seedSymlinkedIndex } from './helpers/plan-fixtures.js';

/** Run `body` against a fresh temp root, cleaning it up afterwards. */
function withTempRoot<T>(body: (root: string) => T): T {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dhs-io-'));
  try {
    return body(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/** Seed `<root>/docs/plans/index.md` with a header line. */
function seedIndex(root: string): void {
  fs.mkdirSync(path.dirname(plansIndexFile(root)), { recursive: true });
  fs.writeFileSync(plansIndexFile(root), '# Plans\n', 'utf8');
}

describe('readPlanFile', () => {
  it('reads plan contents', () => {
    withTempRoot((root) => {
      const file = path.join(root, 'plan.md');
      fs.writeFileSync(file, '# Plan\n', 'utf8');
      expect(readPlanFile(file)).toBe('# Plan\n');
    });
  });

  it('reports a descriptive error for a missing file', () => {
    expect(() => readPlanFile(path.join(os.tmpdir(), 'dhs-io-missing', 'plan.md'))).toThrow(/plan file not readable/);
  });

  it('reports a descriptive error when the path is a directory', () => {
    withTempRoot((root) => {
      const file = path.join(root, 'plan.md');
      fs.mkdirSync(file);
      expect(() => readPlanFile(file)).toThrow(/plan file not readable/);
    });
  });

  it('refuses to read through a final-component symlink (O_NOFOLLOW)', () => {
    withTempRoot((root) => {
      const target = path.join(root, 'target.md');
      fs.writeFileSync(target, '# Target\n', 'utf8');
      const link = path.join(root, 'link.md');
      fs.symlinkSync(target, link);
      expect(() => readPlanFile(link)).toThrow(`path traverses a symlink: ${link}`);
    });
  });
});

describe('appendPlanIndexRow', () => {
  it('rejects an empty workspace root', () => {
    expect(() => appendPlanIndexRow('', 'slug', 'Title')).toThrow(/no workspace root available/);
  });

  it('escapes pipes and newlines into one well-formed row', () => {
    withTempRoot((root) => {
      seedIndex(root);
      appendPlanIndexRow(root, 'escaped', 'Line | break\nsecond');
      const rows = fs.readFileSync(plansIndexFile(root), 'utf8').trimEnd().split('\n');
      expect(rows).toHaveLength(2);
      const today = new Date().toISOString().slice(0, 10);
      expect(rows[1]).toBe(
        `| Line \\| break second | escaped | Line \\| break second | ${today} | ${today} | Pending | Yes |`
      );
    });
  });

  it('escapes backslashes before pipes in both cells', () => {
    withTempRoot((root) => {
      seedIndex(root);
      appendPlanIndexRow(root, 'slug|pipe', 'Back\\|slash');
      const row = fs.readFileSync(plansIndexFile(root), 'utf8').trimEnd().split('\n')[1];
      const bs = '\\';
      expect(row).toContain(`| Back${bs}${bs}${bs}|slash | slug${bs}|pipe |`);
    });
  });

  it('refuses a symlinked index', () => {
    withTempRoot((root) => {
      const real = seedSymlinkedIndex(root);
      expect(() => appendPlanIndexRow(root, 'slug', 'T')).toThrow(/path traverses a symlink/);
      expect(fs.readFileSync(real, 'utf8')).toBe('# Plans\n');
    });
  });
});

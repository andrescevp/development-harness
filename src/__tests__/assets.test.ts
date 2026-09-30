/**
 * assets.test.ts — loadHarnessAssets against the real repo layout (agents/ +
 * skills/ mirror the dist/assets layout) and against temp fixtures for error
 * handling. loadHarnessAssets(root) is CWD-independent (root injectable).
 * Expectations are derived from the repo's own surface — it is fully
 * repo-authored, so the corpus IS the contract (7 agents, 15 skills).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadHarnessAssets } from '../lib/assets.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('loadHarnessAssets on the real repo layout', () => {
  const assets = loadHarnessAssets(REPO_ROOT);

  it('loads the 7 bundled agents', () => {
    expect(assets.agents).toHaveLength(7);
  });

  it('loads the 15 bundled skills including dh-coding', () => {
    expect(assets.skills).toHaveLength(15);
    expect(assets.skills.some((s) => s.name === 'dh-coding')).toBe(true);
  });

  it('every registered name matches the name regex, is dh-prefixed, and unique', () => {
    const names = [...assets.agents.map((a) => a.name), ...assets.skills.map((s) => s.name)];
    for (const n of names) {
      expect(n, n).toMatch(NAME_REGEX);
      expect(n, n).toMatch(/^dh-/);
    }
    expect(new Set(names).size).toBe(22); // 7 agents + 15 skills, no duplicates
  });

  it('captures the index and reports zero errors on the clean corpus', () => {
    expect(assets.index).toBeDefined();
    expect(typeof assets.index).toBe('string');
    expect(assets.errors).toEqual([]);
  });

  it('every agent record carries an executable body (system prompt) and a mode', () => {
    for (const a of assets.agents) {
      expect(a.body.trim().length).toBeGreaterThan(0);
      expect(['all', 'subagent', 'primary']).toContain(a.mode);
    }
  });
});

describe('loadHarnessAssets error handling', () => {
  it('collects per-file errors instead of throwing, and excludes bad files', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dhs-assets-'));
    try {
      fs.mkdirSync(path.join(tmp, 'agents'), { recursive: true });
      fs.mkdirSync(path.join(tmp, 'skills', 'good'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'agents', 'bad.md'), 'no frontmatter here\n', 'utf8');
      fs.writeFileSync(
        path.join(tmp, 'skills', 'good', 'SKILL.md'),
        '---\nname: good\ndescription: A good skill.\n---\nbody\n',
        'utf8'
      );
      const assets = loadHarnessAssets(tmp);
      expect(assets.agents).toHaveLength(0);
      expect(assets.skills.map((s) => s.name)).toEqual(['good']);
      expect(assets.errors).toHaveLength(1);
      expect(assets.errors[0]!.reason).toMatch(/missing leading ---/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('returns empty sets for a missing root (never throws)', () => {
    const assets = loadHarnessAssets('/tmp/opencode/definitely-missing-dhs-root');
    expect(assets.agents).toHaveLength(0);
    expect(assets.skills).toHaveLength(0);
    expect(assets.index).toBeUndefined();
    expect(assets.errors).toEqual([]);
  });
});

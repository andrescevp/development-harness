/**
 * plugin-entries.test.ts — pure `opencode plugin add` duplicate detection (4.4).
 *
 * Detection reads the config `plugins` array and must recognize every channel
 * that resolves to this package (npm with tags, GitHub shorthand, Git URLs)
 * while ignoring look-alike package names and foreign repositories. Invalid or
 * missing structures never throw: callers own config validation.
 */
import { describe, expect, it } from 'vitest';
import { describeDuplicateLoad, findPluginEntries, isThisPackageSpecifier } from '../plugin-entries.js';

const configWith = (value: unknown): string => JSON.stringify({ plugins: value }, null, 2);

describe('isThisPackageSpecifier', () => {
  it.each([
    'dev-harness-skills',
    'dev-harness-skills@1.2.3',
    'dev-harness-skills@latest',
    'npm:dev-harness-skills',
    'npm:dev-harness-skills@1.2.3',
    'github:andrescevp/development-harness',
    'github:andrescevp/development-harness#v1.0.0',
    'github:andrescevp/development-harness.git',
    'andrescevp/development-harness',
    'git+https://github.com/andrescevp/development-harness',
    'git+https://github.com/andrescevp/development-harness.git',
    'git+https://github.com/andrescevp/development-harness.git#main',
    'https://github.com/andrescevp/development-harness',
    'git+ssh://git@github.com/andrescevp/development-harness.git',
    'git://github.com/andrescevp/development-harness.git',
    'git@github.com:andrescevp/development-harness.git',
  ])('matches this package: %s', (specifier) => {
    expect(isThisPackageSpecifier(specifier)).toBe(true);
  });

  it.each([
    '',
    '   ',
    'other-plugin',
    'dev-harness-skills-extra',
    'dev-harness-skills-extra@1.0.0',
    '@scope/dev-harness-skills',
    'github:andrescevp/other-repo',
    'github:someone/development-harness',
    'https://github.com/someone/dev-harness-skills',
    'https://gitlab.com/andrescevp/development-harness',
    'git+https://example.com/andrescevp/development-harness.git',
  ])('ignores a foreign specifier: %j', (specifier) => {
    expect(isThisPackageSpecifier(specifier)).toBe(false);
  });
});

describe('findPluginEntries', () => {
  it('returns matching specifiers in config order, keeping duplicates verbatim', () => {
    const text = `// user config\n{\n  "theme": "dark",\n  "plugins": [\n    "other-plugin",\n    "dev-harness-skills@1.2.3",\n    "github:andrescevp/development-harness#main",\n    "dev-harness-skills@1.2.3",\n  ],\n}\n`;
    expect(findPluginEntries(text)).toEqual([
      'dev-harness-skills@1.2.3',
      'github:andrescevp/development-harness#main',
      'dev-harness-skills@1.2.3',
    ]);
  });

  it('returns an empty list when the plugins array is absent', () => {
    expect(findPluginEntries('{\n  "theme": "dark"\n}\n')).toEqual([]);
    expect(findPluginEntries('')).toEqual([]);
  });

  it('ignores invalid JSONC instead of throwing', () => {
    expect(findPluginEntries('{\n  "plugins": [\n')).toEqual([]);
  });

  it('ignores a plugins value that is not an array', () => {
    expect(findPluginEntries(configWith('dev-harness-skills'))).toEqual([]);
    expect(findPluginEntries(configWith({ spec: 'dev-harness-skills' }))).toEqual([]);
  });

  it('skips non-string array elements', () => {
    expect(findPluginEntries(configWith([1, null, { spec: 'dev-harness-skills' }, 'dev-harness-skills']))).toEqual([
      'dev-harness-skills',
    ]);
  });

  it('returns an empty list when only unrelated plugins are listed', () => {
    expect(findPluginEntries(configWith(['other-plugin', 'dev-harness-skills-extra']))).toEqual([]);
  });
});

describe('describeDuplicateLoad', () => {
  it('names the specifiers and both remedies without leaking the whole config', () => {
    const message = describeDuplicateLoad(['dev-harness-skills@1.2.3']);
    expect(message).toContain('dev-harness-skills@1.2.3');
    expect(message).toMatch(/load it twice/);
    expect(message).toContain('--mcp-only');
    expect(message).toContain('remove one channel');
  });
});

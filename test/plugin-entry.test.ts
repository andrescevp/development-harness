/**
 * plugin-entry.test.ts — the root index.ts entry used when the repo is
 * cloned into an opencode plugin directory (.opencode/plugins/ or
 * ~/.config/opencode/plugins/): opencode discovers plugin package
 * directories and loads their index.ts directly from source. Verify the
 * entry re-exports a valid Plugin.define value.
 *
 * Lives outside src/ on purpose: the entry is consumed from the repo root,
 * and tsconfig.rootDir is src/ (the root file is typechecked via vitest,
 * not tsc).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { default as rootPlugin } from '../index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_PLUGIN = path.join(REPO_ROOT, 'dist', 'plugin.js');

describe('root index.ts plugin entry (plugin-directory discovery)', () => {
  it('exports a Plugin.define value with the harness id and a setup function', () => {
    expect(rootPlugin).toBeDefined();
    expect(rootPlugin.id).toBe('dev-harness-skills');
    expect(typeof rootPlugin.setup).toBe('function');
  });

  it('is the same plugin definition the built bundle ships', async () => {
    const { default: builtPlugin } = (await import(DIST_PLUGIN)) as {
      default: { id: string; setup: () => unknown };
    };
    expect(rootPlugin.id).toBe(builtPlugin.id);
    expect(typeof builtPlugin.setup).toBe('function');
  });
});
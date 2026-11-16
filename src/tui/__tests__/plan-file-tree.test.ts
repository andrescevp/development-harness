/**
 * plan-file-tree.test.ts — plan-directory tree used by the modal left panel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../../__tests__/helpers/temp-dir.js';
import { defaultPlanFile, directoryPaths, readPlanFileTree, visiblePlanFiles } from '../plan-file-tree.js';

function write(root: string, relative: string, contents = 'x'): void {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, 'utf8');
}

describe('readPlanFileTree', () => {
  it('lists directories first, skips tmp files and symlinks, and keeps relative paths', async () => {
    await withTempDir((root) => {
      write(root, 'plan.md', '# Plan');
      write(root, 'sdd.md');
      write(root, 'tasks/review.md');
      write(root, 'tasks/atomic.tmp');
      write(root, 'diagrams/flow.md');
      fs.symlinkSync(path.join(root, 'plan.md'), path.join(root, 'linked.md'));
      const tree = readPlanFileTree(path.join(root, 'plan.md'));
      expect(tree.map((node) => node.name)).toEqual(['diagrams', 'tasks', 'plan.md', 'sdd.md']);
      expect(tree[0]?.children[0]?.relative).toBe('diagrams/flow.md');
      expect(directoryPaths(tree).sort()).toEqual(['diagrams', 'tasks']);
    });
  });

  it('flattens only expanded directories and chooses plan.md by default', async () => {
    await withTempDir((root) => {
      write(root, 'plan.md');
      write(root, 'tasks/review.md');
      write(root, 'diagrams/flow.md');
      const tree = readPlanFileTree(path.join(root, 'plan.md'));
      const collapsed = visiblePlanFiles(tree, () => false);
      expect(collapsed.map((row) => row.node.relative)).toEqual(['diagrams', 'tasks', 'plan.md']);
      const expanded = visiblePlanFiles(tree, () => true);
      expect(expanded.map((row) => `${row.depth}:${row.node.relative}`)).toEqual([
        '0:diagrams',
        '1:diagrams/flow.md',
        '0:tasks',
        '1:tasks/review.md',
        '0:plan.md',
      ]);
      expect(defaultPlanFile(tree)?.relative).toBe('plan.md');
    });
  });
});

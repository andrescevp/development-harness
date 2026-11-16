/**
 * plan-file-tree.ts — read-only file tree for the plan modal's left panel.
 *
 * Files come from the selected plan's own directory (`docs/plans/<slug>/`):
 * plan.md, sdd.md, tasks/*.md, diagrams/*.md, handoff.md and fast-mode
 * sidecars. Symlinks and `*.tmp` atomic-write residue are ignored.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface PlanFileNode {
  name: string;
  /** Absolute path. */
  path: string;
  /** Slash-normalized path relative to the plan directory. */
  relative: string;
  directory: boolean;
  children: PlanFileNode[];
}

const MAX_DEPTH = 4;
const MAX_NODES = 200;

function sortNodes(nodes: PlanFileNode[]): PlanFileNode[] {
  return nodes.sort((left, right) => {
    if (left.directory !== right.directory) return left.directory ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

/** Read one plan directory as a sorted tree; unreadable directories are skipped. */
export function readPlanFileTree(planPath: string): PlanFileNode[] {
  let budget = MAX_NODES;

  const walk = (directory: string, relative: string, depth: number): PlanFileNode[] => {
    if (depth > MAX_DEPTH || budget <= 0) return [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return [];
    }
    const nodes: PlanFileNode[] = [];
    for (const entry of entries) {
      if (budget <= 0) break;
      if (entry.isSymbolicLink() || entry.name.endsWith('.tmp')) continue;
      const childPath = path.join(directory, entry.name);
      const childRelative = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        budget -= 1;
        nodes.push({
          name: entry.name,
          path: childPath,
          relative: childRelative,
          directory: true,
          children: walk(childPath, childRelative, depth + 1),
        });
      } else if (entry.isFile()) {
        budget -= 1;
        nodes.push({ name: entry.name, path: childPath, relative: childRelative, directory: false, children: [] });
      }
    }
    return sortNodes(nodes);
  };

  return walk(path.dirname(planPath), '', 0);
}

/** Every directory path in the tree (used to start fully expanded). */
export function directoryPaths(nodes: readonly PlanFileNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (!node.directory) continue;
    paths.push(node.relative);
    paths.push(...directoryPaths(node.children));
  }
  return paths;
}

/** Depth-first visible rows for the current expansion set. */
export function visiblePlanFiles(
  nodes: readonly PlanFileNode[],
  expanded: (relative: string) => boolean
): Array<{ node: PlanFileNode; depth: number }> {
  const rows: Array<{ node: PlanFileNode; depth: number }> = [];
  const walk = (items: readonly PlanFileNode[], depth: number): void => {
    for (const node of items) {
      rows.push({ node, depth });
      if (node.directory && expanded(node.relative)) walk(node.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return rows;
}

/** First file matching `relative`, or the first file at all. */
export function defaultPlanFile(nodes: readonly PlanFileNode[], preferred = 'plan.md'): PlanFileNode | null {
  let first: PlanFileNode | null = null;
  const walk = (items: readonly PlanFileNode[]): PlanFileNode | null => {
    for (const node of items) {
      if (node.directory) {
        const found = walk(node.children);
        if (found?.relative === preferred) return found;
        continue;
      }
      first ??= node;
      if (node.relative === preferred) return node;
    }
    return null;
  };
  return walk(nodes) ?? first;
}

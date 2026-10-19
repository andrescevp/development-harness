/**
 * plan-paths.ts — workspace-anchored plan path resolution + symlink ACL (R4).
 *
 * Extracted from plan-lifecycle.ts to keep files under the 300-line rule.
 * Lexical + lstat checks only; no plan content is read here.
 */
import fs from 'node:fs';
import path from 'node:path';

/** `<workspaceRoot>/docs/plans` — the single source of the plan layout. */
function plansDir(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, 'docs', 'plans');
}

/** `<workspaceRoot>/docs/plans/index.md` — the plan index file. */
export function planIndexFile(workspaceRoot: string): string {
  return path.join(plansDir(workspaceRoot), 'index.md');
}

/** Reject an empty workspace root (plan paths never fall back to the process CWD). */
export function requireWorkspaceRoot(workspaceRoot: string): void {
  if (!workspaceRoot) throw new Error('no workspace root available; pass an explicit `path` input');
}

/**
 * Resolve a plan file path, anchored under <workspaceRoot>/docs/plans.
 * Rejects `..` escapes, absolute paths outside the anchor, slugs containing
 * path separators, and symlink traversal (anchor components included).
 * Requires a non-empty workspaceRoot (never falls back to the process CWD).
 */
export function resolvePlanPath(workspaceRoot: string, slug?: string, explicitPath?: string): string {
  requireWorkspaceRoot(workspaceRoot);
  const base = plansDir(workspaceRoot);
  const baseWithSep = base + path.sep;

  let resolved: string;
  if (explicitPath !== undefined) {
    resolved = path.resolve(base, explicitPath);
  } else {
    if (!slug) throw new Error('either slug or path is required');
    if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) throw new Error(`invalid slug: ${slug}`);
    resolved = path.resolve(base, slug, 'plan.md');
  }
  if (!resolved.startsWith(baseWithSep)) throw new Error(`path escapes docs/plans: ${explicitPath ?? slug}`);

  assertNoSymlinks(workspaceRoot, resolved);
  return resolved;
}

/**
 * Reject symlink components on the anchor chain (`docs`, `docs/plans`) and
 * from the anchor down to `target`. Fail-closed for targets outside the
 * anchor. The workspaceRoot itself is exempt (a symlinked cwd is acceptable;
 * only plan-relative traversal is guarded). `lstat` does not follow links, so
 * dangling symlinks are rejected too.
 */
export function assertNoSymlinks(workspaceRoot: string, target: string): void {
  const root = path.resolve(workspaceRoot);
  const base = plansDir(root);
  const resolved = path.resolve(target);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`path escapes docs/plans: ${target}`);
  }
  const rel = path.relative(base, resolved);
  const segments = [...path.relative(root, base).split(path.sep), ...rel.split(path.sep)].filter(
    (seg) => seg.length > 0
  );

  let current = root;
  for (const seg of segments) {
    current = path.join(current, seg);
    let stat: fs.Stats | undefined;
    try {
      stat = fs.lstatSync(current, { throwIfNoEntry: false });
    } catch (err) {
      // A regular file sits at a path component — nothing deeper can be a
      // symlink; let the downstream I/O produce its descriptive error.
      if ((err as NodeJS.ErrnoException).code === 'ENOTDIR') return;
      throw err;
    }
    if (stat?.isSymbolicLink()) throw new Error(`path traverses a symlink: ${current}`);
  }
}

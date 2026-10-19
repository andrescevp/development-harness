/**
 * plan-tools-acl.test.ts — path ACL rejections through the MCP surface.
 *
 * Traversal escapes, invalid slugs, symlinked components/anchors (including
 * dangling links), and the pre-create index validation of plan_create.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { textOf } from '../../__tests__/helpers/mcp.js';
import {
  closePlanHarness,
  connectPlanHarness,
  PLAN_SLUG,
  plansDocIn,
  plansFile,
  plansIndexFile,
  seedPlan,
  seedSymlinkedIndex,
} from '../../__tests__/helpers/plan-fixtures.js';

afterEach(closePlanHarness);

describe('path ACL rejections', () => {
  it('rejects `..` escapes', async () => {
    const h = await connectPlanHarness();
    const res = await h.callTool('plan_read', { path: '../outside.md' });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe('path escapes docs/plans: ../outside.md');
  });

  it('rejects absolute paths outside the anchor', async () => {
    const h = await connectPlanHarness();
    const res = await h.callTool('plan_read', { path: '/etc/passwd' });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe('path escapes docs/plans: /etc/passwd');
  });

  it('rejects slugs containing separators', async () => {
    const h = await connectPlanHarness();
    const res = await h.callTool('plan_read', { slug: 'a/b' });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe('invalid slug: a/b');
  });

  it('rejects a symlinked path component', async () => {
    const h = await connectPlanHarness((root) => {
      seedPlan(root);
      const base = plansDocIn(root);
      fs.mkdirSync(path.join(base, 'real-dir'), { recursive: true });
      fs.symlinkSync(path.join(base, 'real-dir'), path.join(base, 'evil'), 'dir');
    });
    const res = await h.callTool('plan_read', { path: 'evil/plan.md' });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe(`path traverses a symlink: ${path.join(plansDocIn(h.workspaceRoot), 'evil')}`);
  });

  it('rejects a symlinked docs/plans anchor', async () => {
    const h = await connectPlanHarness((root) => {
      const realPlans = path.join(root, 'real-plans');
      seedPlan(root, PLAN_SLUG);
      fs.renameSync(plansDocIn(root), realPlans);
      fs.symlinkSync(realPlans, plansDocIn(root), 'dir');
    });
    const res = await h.callTool('plan_read', { slug: PLAN_SLUG });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe(`path traverses a symlink: ${plansDocIn(h.workspaceRoot)}`);
  });

  it('rejects a symlinked index before creating the plan', async () => {
    const h = await connectPlanHarness((root) => {
      seedSymlinkedIndex(root);
    });
    const realIndex = path.join(plansDocIn(h.workspaceRoot), 'real-index.md');
    const res = await h.callTool('plan_create', {
      slug: 'stranded',
      title: 'Stranded',
      objective: 'o',
      phases: [{ title: 'P', subTasks: [] }],
      updateIndex: true,
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe(`path traverses a symlink: ${plansIndexFile(h.workspaceRoot)}`);
    // The symlink target stays byte-unchanged and no plan file is stranded.
    expect(fs.readFileSync(realIndex, 'utf8')).toBe('# Plans\n');
    expect(fs.existsSync(plansFile(h.workspaceRoot, 'stranded'))).toBe(false);
  });

  it('rejects a symlinked docs directory', async () => {
    const h = await connectPlanHarness((root) => {
      const realDocs = path.join(root, 'real-docs');
      fs.mkdirSync(path.join(realDocs, 'plans', PLAN_SLUG), { recursive: true });
      fs.symlinkSync(realDocs, path.join(root, 'docs'), 'dir');
    });
    const res = await h.callTool('plan_read', { slug: PLAN_SLUG });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe(`path traverses a symlink: ${path.join(h.workspaceRoot, 'docs')}`);
  });

  it('reports a file blocking a path component as unreadable, not ENOTDIR', async () => {
    const h = await connectPlanHarness((root) => {
      seedPlan(root);
      fs.writeFileSync(path.join(plansDocIn(root), 'blocker'), 'not a dir\n', 'utf8');
    });
    const res = await h.callTool('plan_read', { path: 'blocker/plan.md' });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toBe(`plan file not readable: ${path.join(plansDocIn(h.workspaceRoot), 'blocker', 'plan.md')}`);
  });

  it('rejects dangling symlinks around the plan path and the index', async () => {
    const h = await connectPlanHarness((root) => {
      const plans = plansDocIn(root);
      fs.mkdirSync(plans, { recursive: true });
      fs.symlinkSync(path.join(plans, 'missing-dir'), path.join(plans, 'dangling'), 'dir');
      fs.symlinkSync(path.join(plans, 'missing-index.md'), plansIndexFile(root), 'file');
    });
    const read = await h.callTool('plan_read', { path: 'dangling/plan.md' });
    expect(read.isError).toBe(true);
    expect(textOf(read)).toBe(`path traverses a symlink: ${path.join(plansDocIn(h.workspaceRoot), 'dangling')}`);

    const created = await h.callTool('plan_create', {
      slug: 'dangling-index',
      title: 'D',
      objective: 'o',
      phases: [],
      updateIndex: true,
    });
    expect(created.isError).toBe(true);
    expect(textOf(created)).toBe(`path traverses a symlink: ${plansIndexFile(h.workspaceRoot)}`);
  });
});

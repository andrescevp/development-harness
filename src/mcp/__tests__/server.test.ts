/**
 * server.test.ts — `tools/list` contract for the MCP server factory.
 *
 * Proves the factory registers exactly the 7 harness capabilities with
 * meaningful descriptions, and that plan handlers anchor on the injected
 * workspace root. Payload/error parity is covered by the dedicated
 * plan/sheet/command parity suites.
 */
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { McpTestHarness } from '../../__tests__/helpers/mcp.js';
import { createMcpTestHarness } from '../../__tests__/helpers/mcp.js';

const HARNESS_TOOLS = [
  'logged_command',
  'plan_create',
  'plan_read',
  'plan_update_status',
  'read_sheet',
  'sheet_schema',
  'update_sheet',
].sort();

describe('MCP server tools/list contract', () => {
  let harness: McpTestHarness | undefined;

  beforeEach(async () => {
    harness = await createMcpTestHarness();
  });

  afterEach(async () => {
    await harness?.close();
  });

  it('exposes exactly the 7 harness tools', async () => {
    const { tools } = await harness!.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(HARNESS_TOOLS);
  });

  it('gives every tool a meaningful description', async () => {
    const { tools } = await harness!.listTools();
    expect(tools).toHaveLength(HARNESS_TOOLS.length);
    for (const tool of tools) {
      expect(tool.description?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it('anchors plan handlers on the injected workspace root', async () => {
    const created = await harness!.callToolJson<{ ok: boolean; path: string; plan: { title?: string } }>(
      'plan_create',
      {
        slug: 'demo',
        title: 'Demo Plan',
        objective: 'Prove workspace anchoring',
        phases: [{ title: 'Phase One', subTasks: [{ title: 'First task' }] }],
      }
    );
    expect(created.ok).toBe(true);
    expect(created.path).toBe(path.join(harness!.workspaceRoot, 'docs', 'plans', 'demo', 'plan.md'));
    expect(created.plan.title).toBe('Demo Plan');

    const read = await harness!.callToolJson<{ path: string }>('plan_read', { slug: 'demo' });
    expect(read.path).toBe(created.path);
  });
});

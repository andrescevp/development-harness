/**
 * registration.test.ts — integration-style check: run the REAL plugin setup
 * against a stub ctx and assert the hard cut (Sub-Task 3.1): the plugin
 * registers 7 agents and 17 skills ONLY. Tools live in the `dh` MCP server,
 * so ANY tool-domain access throws (same guard style as the command domain);
 * the guards themselves are meta-tested below.
 *
 * The plugin entry imports the BUILT dist/plugin.js so the whole pipeline
 * (tsup bundle + dist/assets) is under test. Requires `pnpm build` first.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST_PLUGIN = path.join(REPO_ROOT, 'dist', 'plugin.js');

interface CapturedUpdate {
  domain: 'agent' | 'skill';
  kind: 'update' | 'add';
  name?: string;
}

/** Minimal stub ctx capturing transform registrations (mirrors the V2 contract). */
function createStubContext() {
  const captured: CapturedUpdate[] = [];
  let toolTouches = 0;
  const ctx = {
    agent: {
      transform: async (
        fn: (editor: { update: (id: string, mutate: (agent: Record<string, unknown>) => void) => void }) => void
      ) => {
        fn({
          update: (id, mutate) => {
            const agent: Record<string, unknown> = {};
            mutate(agent);
            captured.push({ domain: 'agent', kind: 'update', name: id });
          },
        });
      },
    },
    skill: {
      transform: async (fn: (editor: { add: (info: { name: string }) => void }) => void) => {
        fn({
          add: (info) => captured.push({ domain: 'skill', kind: 'add', name: info.name }),
        });
      },
    },
    tool: {
      transform: async (_fn: unknown) => {
        toolTouches += 1;
        throw new Error('tool domain must never be touched (tools live in the MCP server)');
      },
    },
    command: {
      transform: async (_fn: unknown) => {
        throw new Error('command domain must never be touched (commands out of scope)');
      },
    },
  };
  return { ctx, captured, toolTouches: () => toolTouches };
}

describe('plugin setup registration (built bundle)', () => {
  it('dist is built (run `pnpm build` first)', () => {
    expect(fs.existsSync(DIST_PLUGIN)).toBe(true);
  });

  it('registers the 7 bundled agents and 17 skills only (hard cut)', async () => {
    const { default: plugin } = (await import(DIST_PLUGIN)) as {
      default: { id: string; setup: (ctx: ReturnType<typeof createStubContext>['ctx']) => Promise<void> };
    };
    expect(plugin.id).toBe('dev-harness-skills');
    expect(typeof plugin.setup).toBe('function');

    const { ctx, captured, toolTouches } = createStubContext();
    await plugin.setup(ctx);

    const agents = captured
      .filter((c) => c.domain === 'agent' && c.kind === 'update')
      .map((c) => c.name)
      .sort();
    const skills = captured
      .filter((c) => c.domain === 'skill' && c.kind === 'add')
      .map((c) => c.name)
      .sort();

    expect(agents).toHaveLength(7);
    expect(skills).toHaveLength(17);
    expect(toolTouches()).toBe(0);
  });
});

describe('domain guards (meta)', () => {
  it('the tool stub throws and counts when the tool domain is touched', async () => {
    const { ctx, toolTouches } = createStubContext();
    await expect(ctx.tool.transform(() => undefined)).rejects.toThrow(/tool domain/);
    expect(toolTouches()).toBe(1);
  });

  it('the command stub throws when the command domain is touched', async () => {
    const { ctx } = createStubContext();
    await expect(ctx.command.transform(() => undefined)).rejects.toThrow(/command domain/);
  });
});

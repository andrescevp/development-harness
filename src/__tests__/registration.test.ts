/**
 * registration.test.ts — integration-style check: run the REAL plugin setup
 * against a stub ctx and assert the registration contract (R7/AC6): the plugin
 * registers 6 agents, 27 skills, and EXACTLY TWO tool execute hooks
 * (`execute.after`, `execute.before`) that implement TOON compression and
 * restoration. Tools still live in the `dh` MCP server, so ANY tool, command,
 * or prompt TRANSFORM throws (same guard style as the command domain); the
 * guards themselves are meta-tested below.
 *
 * The plugin entry imports the BUILT dist/plugin.js so the whole pipeline
 * (tsdown bundle + dist/assets) is under test. Requires `pnpm build` first.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST_PLUGIN = path.join(REPO_ROOT, 'dist', 'plugin.js');

/** Plugin hook names the registration contract allows (TOON only). */
const EXPECTED_HOOKS = ['execute.after', 'execute.before'];

interface CapturedUpdate {
  domain: 'agent' | 'skill';
  kind: 'update' | 'add';
  name?: string;
}

/**
 * Minimal stub ctx capturing transform registrations and execute hooks
 * (mirrors the V2 contract: `tool.hook` returns `{ dispose(): Promise<void> }`).
 */
function createStubContext() {
  const captured: CapturedUpdate[] = [];
  const hooks: string[] = [];
  const callbacks = new Map<string, (event: unknown) => unknown>();
  const disposed: string[] = [];
  let toolTransforms = 0;

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
        toolTransforms += 1;
        throw new Error('tool domain must never be transformed (tools live in the MCP server)');
      },
      hook: async (name: string, callback: (event: unknown) => unknown) => {
        hooks.push(name);
        callbacks.set(name, callback);
        return {
          dispose: async () => {
            disposed.push(name);
          },
        };
      },
    },
    command: {
      transform: async (_fn: unknown) => {
        throw new Error('command domain must never be touched (commands out of scope)');
      },
    },
  };

  return { ctx, captured, hooks, callbacks, disposed, toolTransforms: () => toolTransforms };
}

describe('plugin setup registration (built bundle)', () => {
  it('dist is built (run `pnpm build` first)', () => {
    expect(fs.existsSync(DIST_PLUGIN)).toBe(true);
  });

  it('registers 6 agents, 27 skills, and exactly two tool execute hooks (hard cut)', async () => {
    const { default: plugin } = (await import(DIST_PLUGIN)) as {
      default: {
        id: string;
        setup: (ctx: ReturnType<typeof createStubContext>['ctx']) => Promise<() => Promise<void> | void>;
      };
    };
    expect(plugin.id).toBe('dev-harness-skills');
    expect(typeof plugin.setup).toBe('function');

    const { ctx, captured, hooks, disposed, toolTransforms } = createStubContext();
    const cleanup = await plugin.setup(ctx);

    const agents = captured
      .filter((c) => c.domain === 'agent' && c.kind === 'update')
      .map((c) => c.name)
      .sort();
    const skills = captured
      .filter((c) => c.domain === 'skill' && c.kind === 'add')
      .map((c) => c.name)
      .sort();

    expect(agents).toHaveLength(6);
    expect(skills).toHaveLength(27);
    expect(agents).toContain('dh-researcher');
    expect(skills).toContain('dh-research');

    // No tool/command/prompt transforms: the tool domain is only hooked.
    expect(toolTransforms()).toBe(0);
    expect(hooks).toEqual(EXPECTED_HOOKS);

    // Setup returns a cleanup that disposes both hook registrations.
    expect(typeof cleanup).toBe('function');
    expect(disposed).toEqual([]);
    await cleanup();

    expect([...disposed].sort()).toEqual([...EXPECTED_HOOKS].sort());
  });

  it('wires the TOON handlers into the captured execute hooks', async () => {
    const { default: plugin } = (await import(DIST_PLUGIN)) as {
      default: { setup: (ctx: ReturnType<typeof createStubContext>['ctx']) => Promise<unknown> };
    };
    // Eight rows keep the JSON form above the 256-character TOON threshold.
    const rows = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: `row-${i + 1}`,
      value: `value-${i + 1}`,
    }));
    const json = JSON.stringify(rows);
    const { ctx, callbacks } = createStubContext();
    await plugin.setup(ctx);

    const after = callbacks.get('execute.after');
    const before = callbacks.get('execute.before');
    expect(after).toBeTypeOf('function');
    expect(before).toBeTypeOf('function');

    // execute.after compresses a completed eligible tool and skips the rest.
    const completed = { tool: 'bash', status: 'completed', result: { content: json } };
    after!(completed);
    expect(completed.result.content).not.toBe(json);
    expect(completed.result.content.length).toBeLessThan(json.length);

    const failed = { tool: 'bash', status: 'error', result: { content: json } };
    after!(failed);
    expect(failed.result.content).toBe(json);

    const ineligible = { tool: 'shell', status: 'completed', result: { content: json } };
    after!(ineligible);
    expect(ineligible.result.content).toBe(json);

    // execute.before restores the compressed payload inside a quoted string and
    // leaves non-bash tools alone.
    const input: { command: string } = { command: `echo '${completed.result.content}'` };
    before!({ tool: 'bash', input });
    expect(input.command).toBe(`echo '${json}'`);

    const untouched: { command: string } = { command: `echo '${completed.result.content}'` };
    before!({ tool: 'shell', input: untouched });
    expect(untouched.command).toBe(`echo '${completed.result.content}'`);
  });
});

describe('domain guards (meta)', () => {
  it('the tool stub still throws on transform, while tool.hook is allowed', async () => {
    const { ctx, disposed, toolTransforms } = createStubContext();
    await expect(ctx.tool.transform(() => undefined)).rejects.toThrow(/tool domain/);
    expect(toolTransforms()).toBe(1);

    const registration = await ctx.tool.hook('execute.after', () => undefined);
    await registration.dispose();
    expect(disposed).toEqual(['execute.after']);
  });

  it('the command stub throws when the command domain is touched', async () => {
    const { ctx } = createStubContext();
    await expect(ctx.command.transform(() => undefined)).rejects.toThrow(/command domain/);
  });
});

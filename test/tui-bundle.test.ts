/**
 * tui-bundle.test.ts — the built dist/tui.js (the package `./tui` part).
 *
 * Unlike dist/plugin.js, the TUI artifact is NOT self-contained by design: it
 * runs inside the opencode host, which injects its own `@opencode/plugin/tui`,
 * `solid-js` and `@opentui/*` instances through its `opentui:runtime-module:*`
 * rewrite. Bundling them would split Solid reactivity/context and build
 * renderables outside the host renderer, so this test locks the opposite
 * contract: only host-provided bare imports plus node builtins, a valid
 * `Plugin.define` value, the 3.1/3.2 slot claims, the `/plan-progress` command
 * and a cleanup that detaches everything.
 *
 * `yaml` IS bundled (the managed install has no node_modules; contract §2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_TUI = path.join(REPO_ROOT, 'dist', 'tui.js');

/** Runtime modules the host rewrites at load time (see tui-api-notes §2). */
const HOST_PROVIDED = new Set([
  '@opencode/plugin/tui',
  '@opentui/core',
  '@opentui/solid',
  '@opentui/solid/jsx-runtime',
  '@opentui/solid/jsx-dev-runtime',
  'solid-js',
  'solid-js/store',
]);

const NODE_BUILTIN = /^(node:)?(fs|path|crypto|module|os|url|util|events|stream|buffer|assert|process)$/;

/** Bundled yaml (~290 kB artifact); a bundled Solid/OpenTUI copy would be far larger. */
const MAX_ARTIFACT_BYTES = 512 * 1024;

interface SlotClaimStub {
  append: string;
  render: (input: never) => unknown;
}

interface KeymapCommandStub {
  id: string;
  title?: string;
  palette?: boolean;
  slash?: { name: string };
  run: () => void;
}

interface PanelStub {
  opened: string[];
}

function stubContext() {
  const claims: SlotClaimStub[] = [];
  const removed: string[] = [];
  const panel: PanelStub = { opened: [] };
  let layerFactory: (() => { commands?: readonly KeymapCommandStub[] }) | null = null;

  const context = {
    options: {},
    location: undefined,
    app: { version: 'test', channel: 'test' },
    renderer: { width: 120, height: 40 },
    client: {},
    theme: { text: { base: undefined, muted: undefined } },
    themeMode: 'dark' as const,
    markdown: { registerCodeBlockRenderer: () => () => {} },
    attention: {},
    data: {
      session: {
        status: () => 'idle' as const,
        get: () => undefined,
      },
      on: () => () => {},
    },
    keymap: {
      layer: (factory: () => { commands?: readonly KeymapCommandStub[] }) => {
        layerFactory = factory;
      },
    },
    storage: {
      memory: <Value extends object>(_key: string, options: { readonly initial: Value }) => {
        const value = options.initial;
        const update = (mutation: (draft: Value) => void): void => {
          mutation(value);
        };
        return [value, update] as const;
      },
    },
    ui: {
      slot: (claim: SlotClaimStub) => {
        claims.push(claim);
        return () => removed.push(claim.append);
      },
      panel: {
        open: (name: string) => {
          panel.opened.push(name);
          return true;
        },
        close: () => {},
        current: () => undefined,
      },
      format: { path: (value: string) => value },
    },
  };

  return { context, claims, removed, panel, layer: () => layerFactory };
}

async function loadPlugin() {
  const mod = (await import(pathToFileURL(DIST_TUI).href)) as {
    default: { id: string; setup: (context: unknown) => (() => void) | undefined };
  };
  return mod.default;
}

describe('dist/tui.js host-module bundle', () => {
  it('dist is built (run `pnpm build` first)', () => {
    expect(fs.existsSync(DIST_TUI)).toBe(true);
  });

  it('imports only host-provided runtime modules and node builtins', () => {
    const source = fs.readFileSync(DIST_TUI, 'utf8');
    const specifiers = [...source.matchAll(/(?:^|\n)import[^;]*?from\s+"([^"]+)"/g)].map((m) => m[1]!);
    const relative = specifiers.filter((specifier) => specifier.startsWith('.') || specifier.startsWith('/'));
    const unexpected = specifiers.filter(
      (specifier) =>
        !specifier.startsWith('.') &&
        !specifier.startsWith('/') &&
        !HOST_PROVIDED.has(specifier) &&
        !NODE_BUILTIN.test(specifier)
    );
    // A single-file artifact cannot load sibling chunks from a managed install.
    expect(relative).toEqual([]);
    expect(unexpected).toEqual([]);
    expect(specifiers).toContain('@opencode/plugin/tui');
    expect(specifiers).toContain('solid-js');
  });

  it('bundles yaml instead of importing it (managed installs have no node_modules)', () => {
    const source = fs.readFileSync(DIST_TUI, 'utf8');
    expect(source).not.toMatch(/from\s+"yaml"/);
    expect(fs.statSync(DIST_TUI).size).toBeGreaterThan(100 * 1024);
    expect(fs.statSync(DIST_TUI).size).toBeLessThan(MAX_ARTIFACT_BYTES);
  });

  it('emits the declaration file the package ./tui types condition points at', () => {
    // `pnpm build` = tsdown (dist/tui.js) + `tsc --emitDeclarationOnly`
    // (dist/tui/index.d.ts); the published export must not dangle.
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
      exports: Record<string, { types?: string; import?: string }>;
    };
    const entry = manifest.exports['./tui'];
    expect(entry?.import).toBe('./dist/tui.js');
    if (entry?.types === undefined) throw new Error('the ./tui export must declare a types condition');
    const declarations = path.resolve(REPO_ROOT, entry.types);
    expect(fs.existsSync(declarations)).toBe(true);
    expect(fs.readFileSync(declarations, 'utf8')).toContain('Plugin.Definition');
  });

  it('exports a Plugin.define value with the prefixed id', async () => {
    const plugin = await loadPlugin();
    expect(plugin.id).toBe('dev-harness-skills.tui');
    expect(typeof plugin.setup).toBe('function');
  });

  it('resolves through the package ./tui export (self-reference)', async () => {
    // The host loads the part as `<name>/tui`; Node's self-reference resolution
    // exercises the same package.json export map the host uses.
    const mod = (await import('dev-harness-skills/tui')) as { default: { id: string; setup: unknown } };
    expect(mod.default.id).toBe('dev-harness-skills.tui');
    expect(typeof mod.default.setup).toBe('function');
  });

  it('claims sidebar.content and session.panel, registers /plan-progress and disposes', async () => {
    const plugin = await loadPlugin();
    const { context, claims, removed, panel, layer } = stubContext();
    const cleanup = plugin.setup(context);

    expect(claims.map((claim) => claim.append)).toEqual(['sidebar.content', 'session.panel']);
    expect(claims.every((claim) => typeof claim.render === 'function')).toBe(true);

    const factory = layer();
    expect(factory).not.toBeNull();
    const command = factory?.().commands?.[0];
    expect(command).toMatchObject({
      id: 'dev-harness-skills.plan-progress',
      palette: true,
      slash: { name: 'plan-progress' },
    });
    command?.run();
    expect(panel.opened).toEqual(['dev-harness-skills.plan']);

    expect(typeof cleanup).toBe('function');
    cleanup?.();
    expect(removed).toEqual(['sidebar.content', 'session.panel']);
  });

  it('tolerates a session with no local workspace (empty state, no watcher)', async () => {
    const plugin = await loadPlugin();
    const { context, claims } = stubContext();
    const cleanup = plugin.setup(context);
    // Rendering stays manual (OpenTUI FFI is unavailable under Node); the slot
    // render functions must at least be callable objects.
    expect(claims).toHaveLength(2);
    expect(() => cleanup?.()).not.toThrow();
    expect(() => cleanup?.()).not.toThrow();
  });
});

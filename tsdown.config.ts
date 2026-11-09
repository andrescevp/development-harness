import path from 'node:path';
import { defineConfig, type UserConfig } from 'tsdown';

/**
 * Dev Harness Skills — V2 plugin bundle, MCP stdio bin, and installer CLI.
 *
 * - Three ESM entries: `dist/plugin.js` (opencode plugin loader),
 *   `dist/mcp/stdio.js` (npx `dev-harness-mcp` bin), and `dist/cli.js`
 *   (npx `dev-harness` / `dev-harness-skills` installer bin).
 * - `@opencode/plugin`, `yaml`, and `jsonc-parser` are BUNDLED IN so the
 *   built plugin is self-contained: opencode's global-plugin loader cannot
 *   resolve bare imports from the ~/.config/opencode/plugins directory, so
 *   the bundle must not evaluate any bare specifier at load time. The MCP
 *   bundle runs with a real node_modules (npx cache) and keeps its SDK deps
 *   external instead.
 * - `duckdb` (CJS-only native module) stays external and is lazy-required
 *   inside sheet-tools, so it is only evaluated when a sheet tool runs.
 * - Each entry gets its OWN single-entry build: Rolldown rejects
 *   `codeSplitting: false` with multiple inputs, and the managed installer
 *   copies only `dist/plugin.js` while rejecting relative imports it cannot
 *   see — so every artifact must stay one self-contained file.
 * - `clean` is disabled in every config because the single-entry builds run
 *   concurrently; `npm run clean` (and `prepare.mjs`) wipe dist/ first.
 * - `dts: false` keeps declarations on `tsc --emitDeclarationOnly` (emit
 *   `dist/**` types + declaration maps exactly as before) instead of a second
 *   declaration pipeline.
 * - The shebang banner makes `dist/mcp/stdio.js` and `dist/cli.js` directly
 *   executable; it is harmless in the ESM plugin bundle (Node strips shebangs
 *   in ESM).
 */
const base = {
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: false,
  // Keep the published artifact names (dist/plugin.js, dist/cli.js,
  // dist/mcp/stdio.js): tsdown defaults to .mjs here.
  outExtensions: () => ({ js: '.js' }),
  sourcemap: false,
  dts: false,
  banner: { js: '#!/usr/bin/env node' },
  deps: {
    neverBundle: ['duckdb'],
    alwaysBundle: [/^@opencode\/plugin/, 'yaml', 'jsonc-parser'],
    // Bundling node_modules packages is intentional here; suppress the hint.
    onlyBundle: false,
  },
  // The node build's CJS interop (require("process")) breaks a pure-ESM
  // bundle under real Node — the browser build is require-free and exposes
  // the same parse API we use. jsonc-parser's UMD main keeps relative
  // require() calls that cannot be bundled, so point at its ESM build.
  alias: {
    yaml: path.resolve('node_modules/yaml/browser/dist/index.js'),
    'jsonc-parser': path.resolve('node_modules/jsonc-parser/lib/esm/main.js'),
  },
  outputOptions: { codeSplitting: false },
} satisfies UserConfig;

export default defineConfig([
  { ...base, entry: { plugin: 'src/plugin.ts' } },
  { ...base, entry: { 'mcp/stdio': 'src/mcp/stdio.ts' } },
  { ...base, entry: { cli: 'src/cli/main.ts' } },
]);

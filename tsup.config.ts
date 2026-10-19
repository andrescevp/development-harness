import { defineConfig } from "tsup"
import path from "node:path"

/**
 * Dev Harness Skills — V2 plugin bundle + MCP stdio bin.
 *
 * - Two ESM entries: `dist/plugin.js` (opencode plugin loader) and
 *   `dist/mcp/stdio.js` (npx `dev-harness-mcp` bin).
 * - `@opencode/plugin` and `yaml` are BUNDLED IN so the built plugin is
 *   self-contained: opencode v2.0.18's global-plugin loader cannot resolve
 *   bare imports from the ~/.config/opencode/plugins directory, so the
 *   bundle must not evaluate any bare specifier at load time. The MCP bundle
 *   runs with a real node_modules (npx cache) and keeps its SDK deps
 *   external instead.
 * - `duckdb` (CJS-only native module) stays external and is lazy-required
 *   inside sheet-tools, so it is only evaluated when a sheet tool runs.
 * - The shebang banner makes `dist/mcp/stdio.js` directly executable; it is
 *   harmless in the ESM plugin bundle (Node strips shebangs in ESM).
 * - `clean: true` wipes dist/ before bundling; the npm `build` script then
 *   emits declarations (`tsc --emitDeclarationOnly`) and re-copies
 *   `agents/` + `skills/` into `dist/assets/` (see copy-assets.mjs).
 * - Declarations come from tsc, not tsup: tsup's rollup-plugin-dts pipeline
 *   requires the classic TypeScript 5.x compiler API and crashes with the
 *   native TypeScript 7 compiler (tsgo).
 */
export default defineConfig({
  entry: { plugin: 'src/plugin.ts', 'mcp/stdio': 'src/mcp/stdio.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  external: ['duckdb'],
  noExternal: ['@opencode/plugin', 'yaml'],
  outDir: "dist",
  clean: true,
  sourcemap: false,
  splitting: false,
  // yaml aliased to its browser build: the node build's CJS interop
  // (require("process")) breaks a pure-ESM bundle under real Node — the
  // browser build is require-free and exposes the same parse API we use.
  esbuildOptions(options) {
    options.alias = { yaml: path.resolve("node_modules/yaml/browser/dist/index.js") }
  },
})
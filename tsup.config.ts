import { defineConfig } from "tsup"
import path from "node:path"

/**
 * Dev Harness Skills — V2 plugin bundle.
 *
 * - Single ESM entry (`dist/plugin.js`) consumed by the opencode plugin loader.
 * - `@opencode/plugin` and `yaml` are BUNDLED IN so the built plugin is
 *   self-contained: opencode v2.0.18's global-plugin loader cannot resolve
 *   bare imports from the ~/.config/opencode/plugins directory, so the
 *   bundle must not evaluate any bare specifier at load time.
 * - `duckdb` (CJS-only native module) stays external and is lazy-required
 *   inside sheet-tools, so it is only evaluated when a sheet tool runs.
 * - `clean: true` wipes dist/ before bundling; the npm `build` script then
 *   emits declarations (`tsc --emitDeclarationOnly`) and re-copies
 *   `agents/` + `skills/` into `dist/assets/` (see copy-assets.mjs).
 * - Declarations come from tsc, not tsup: tsup's rollup-plugin-dts pipeline
 *   requires the classic TypeScript 5.x compiler API and crashes with the
 *   native TypeScript 7 compiler (tsgo).
 */
export default defineConfig({
  entry: ["src/plugin.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  external: ["duckdb"],
  noExternal: ["@opencode/plugin", "yaml", /^effect(?:\/|$)/],
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
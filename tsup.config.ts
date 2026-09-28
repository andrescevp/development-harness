import { defineConfig } from "tsup"

/**
 * Dev Harness Skills — V2 plugin bundle.
 *
 * - Single ESM entry (`dist/plugin.js`) consumed by the opencode plugin loader.
 * - `@opencode/plugin` and `yaml` are external: opencode resolves
 *   `@opencode/plugin` at runtime, and `yaml`'s CJS interop shims break a
 *   pure-ESM bundle (dynamic `require("process")`). Both resolve from the
 *   plugin package's node_modules at load time.
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
  external: ["@opencode/plugin", "yaml"],
  outDir: "dist",
  clean: true,
  sourcemap: false,
  splitting: false,
})
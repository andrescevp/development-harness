/**
 * Root plugin entry for opencode plugin-directory discovery.
 *
 * When this repo is cloned into a plugin directory — `~/.config/opencode/plugins/<name>/`
 * (global) or `<project>/.opencode/plugins/<name>/` — opencode discovers the
 * directory and loads its `index.ts` directly from SOURCE. No build step is
 * needed for this load form; `pnpm install` in the clone is enough (the
 * plugin resolves `@opencode/plugin` from its own node_modules, and
 * loadHarnessAssets falls back to the repo-root agents/ + skills/ when
 * dist/assets is absent).
 *
 * The built form (dist/plugin.js, package.json main) remains available for
 * package-style installs (`opencode plugin add`, npm/git dependencies).
 */
export { default } from './src/plugin.js';
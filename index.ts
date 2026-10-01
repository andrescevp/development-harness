/**
 * Root plugin entry for opencode plugin-directory discovery.
 *
 * When this repo is cloned into a plugin directory — `~/.config/opencode/plugins/<name>/`
 * (global) or `<project>/.opencode/plugins/<name>/` — opencode discovers the
 * directory and, via package.json exports ("." -> "./index.ts"), loads this
 * entry directly from SOURCE. No build step is needed: `pnpm install` in the
 * clone provides @opencode/plugin (>= 2.0.20), and loadHarnessAssets falls
 * back to the repo-root agents/ + skills/ when dist/assets is absent.
 */
export { default } from './src/plugin.js';
#!/usr/bin/env node
/**
 * smoke-load.mjs — verify the built bundle exports a valid plugin definition.
 *
 * Imports dist/plugin.js exactly like the opencode plugin loader would and
 * asserts:
 *   - the module has a default export,
 *   - it is an object with a non-empty `id`,
 *   - `setup` is a function (Promise API).
 *
 * It does NOT run setup() — full registration is exercised by the unit suite
 * (ST6) and the real-session check. Exit 0 on success, 1 on failure.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = path.join(REPO_ROOT, 'dist', 'plugin.js');

const failures = [];
const check = (ok, label) => {
  if (!ok) failures.push(label);
  else console.log(`  ok — ${label}`);
};

try {
  const mod = await import(`${BUNDLE}?smoke=${Date.now()}`);
  const plugin = mod.default;
  check(mod !== null && typeof mod === 'object', 'module exports an object');
  check(plugin !== undefined && plugin !== null, 'default export present');
  check(typeof plugin?.id === 'string' && plugin.id.length > 0, `plugin id "${plugin?.id}"`);
  check(typeof plugin?.setup === 'function', 'setup is a function');
} catch (err) {
  console.error(`[smoke-load] failed to import ${BUNDLE}:`);
  console.error(err);
  process.exit(1);
}

if (failures.length) {
  console.error('[smoke-load] FAIL — invalid plugin definition:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('[smoke-load] OK — dist/plugin.js is a valid Plugin.define value');

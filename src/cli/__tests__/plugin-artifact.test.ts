/**
 * plugin-artifact.test.ts — managed plugin materialization and integrity (2.3).
 *
 * Every case builds a fixture package root in a temp directory (package.json,
 * dist/plugin.js, dist/assets), runs the materializer, and removes the temp
 * tree in `finally`. The staged bundle is imported exactly like OpenCode would
 * import the managed layout; no real home, network, or repo artifact is used.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { rejectionOf } from '../../__tests__/helpers/errors.js';
import { withTempDir } from '../../__tests__/helpers/temp-dir.js';
import type { OperationalError } from '../errors.js';
import { createManifest, type InstallManifest, manifestPathFor } from '../manifest.js';
import {
  type BuildStagedPluginInput,
  buildStagedPlugin,
  EXPECTED_AGENT_COUNT,
  EXPECTED_SKILL_COUNT,
  scanBareSpecifiers,
} from '../plugin-artifact.js';

const VALID_BUNDLE = "export default { id: 'fixture-plugin', setup() {} };\n";

interface FixtureOptions {
  readonly withBundle?: boolean;
  readonly withAssets?: boolean;
  readonly agents?: number;
  readonly skills?: number;
  readonly pluginSource?: string;
}

function writeFile(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, 'utf8');
}

/** Build a fixture package root with `dist/plugin.js` and `dist/assets`. */
function createFixture(root: string, options: FixtureOptions = {}): string {
  const packageRoot = path.join(root, 'package');
  writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: 'dev-harness-skills', version: '0.4.0' }));

  const dist = path.join(packageRoot, 'dist');
  if (options.withBundle !== false) {
    writeFile(path.join(dist, 'plugin.js'), options.pluginSource ?? VALID_BUNDLE);
  }
  if (options.withAssets !== false) {
    const agentCount = options.agents ?? EXPECTED_AGENT_COUNT;
    const skillCount = options.skills ?? EXPECTED_SKILL_COUNT;
    for (let index = 0; index < agentCount; index += 1) {
      writeFile(path.join(dist, 'assets', 'agents', `agent-${index}.md`), `# agent ${index}\n`);
    }
    for (let index = 0; index < skillCount; index += 1) {
      writeFile(path.join(dist, 'assets', 'skills', `skill-${index}`, 'SKILL.md'), `# skill ${index}\n`);
    }
  }
  return packageRoot;
}

function buildInput(
  dir: string,
  packageRoot: string,
  overrides: Partial<BuildStagedPluginInput> = {}
): BuildStagedPluginInput {
  return {
    targetDir: path.join(dir, 'config', 'plugins', 'dev-harness-skills'),
    version: '0.4.0',
    source: 'dev-harness-skills',
    scope: 'global',
    config: {
      path: path.join(dir, 'config', 'opencode.jsonc'),
      fingerprint: { type: 'local', command: ['npx', '-y', 'dev-harness-mcp'] },
    },
    packageRoot,
    ...overrides,
  };
}

/** Staging siblings left behind next to the final target. */
async function stagingResidue(targetDir: string): Promise<string[]> {
  const parent = path.dirname(targetDir);
  if (!fs.existsSync(parent)) return [];
  return (await fs.promises.readdir(parent)).filter((name) => name.includes('.tmp-'));
}

async function entries(dir: string): Promise<string[]> {
  return (await fs.promises.readdir(dir)).sort();
}

/** Run a failure case and assert neither the target nor staging residue remains. */
async function buildFailure(dir: string, options: FixtureOptions = {}): Promise<OperationalError> {
  const packageRoot = createFixture(dir, options);
  const input = buildInput(dir, packageRoot);
  const error = await rejectionOf(buildStagedPlugin(input));
  expect(fs.existsSync(input.targetDir)).toBe(false);
  expect(await stagingResidue(input.targetDir)).toEqual([]);
  return error;
}

describe('buildStagedPlugin', () => {
  it('stages the complete managed layout without touching the final target', async () => {
    await withTempDir(async (dir) => {
      const packageRoot = createFixture(dir);
      const input = buildInput(dir, packageRoot);
      const staged = await buildStagedPlugin(input);

      expect(staged.stagingDir).not.toBe(staged.targetDir);
      expect(staged.targetDir).toBe(input.targetDir);
      expect(fs.existsSync(staged.targetDir)).toBe(false);
      expect(await entries(staged.stagingDir)).toEqual([
        '.dev-harness-install.json',
        'dist',
        'index.ts',
        'package.json',
      ]);

      expect(fs.readFileSync(path.join(staged.stagingDir, 'index.ts'), 'utf8')).toBe(
        "// Managed by dev-harness-skills; regenerated on install.\nexport { default } from './dist/plugin.js';\n"
      );
      expect(JSON.parse(fs.readFileSync(path.join(staged.stagingDir, 'package.json'), 'utf8'))).toEqual({
        name: 'dev-harness-skills',
        version: '0.4.0',
        private: true,
        type: 'module',
        main: './dist/plugin.js',
        exports: { '.': './dist/plugin.js' },
      });

      expect(fs.readFileSync(path.join(staged.stagingDir, 'dist', 'plugin.js'), 'utf8')).toBe(VALID_BUNDLE);
      expect(await entries(path.join(staged.stagingDir, 'dist', 'assets', 'agents'))).toHaveLength(
        EXPECTED_AGENT_COUNT
      );
      expect(await entries(path.join(staged.stagingDir, 'dist', 'assets', 'skills'))).toHaveLength(
        EXPECTED_SKILL_COUNT
      );
      // Only the staging sibling exists; the final target was not created.
      expect(await entries(path.dirname(input.targetDir))).toEqual([path.basename(staged.stagingDir)]);

      const mod = await import(`${pathToFileURL(path.join(staged.stagingDir, 'dist', 'plugin.js')).href}?test=1`);
      expect((mod.default as { id: string }).id).toBe('fixture-plugin');
    });
  });

  it('writes a manifest whose target is the final path and whose files match the layout', async () => {
    await withTempDir(async (dir) => {
      const packageRoot = createFixture(dir);
      const input = buildInput(dir, packageRoot, { version: '1.2.3', scope: 'project', source: 'github:org/repo' });
      const staged = await buildStagedPlugin(input);

      const raw = JSON.parse(fs.readFileSync(manifestPathFor(staged.stagingDir), 'utf8')) as InstallManifest;
      const expected = createManifest({
        package: 'dev-harness-skills',
        version: '1.2.3',
        source: 'github:org/repo',
        scope: 'project',
        target: input.targetDir,
        config: input.config,
        files: staged.files,
        installedAt: raw.installedAt,
      });

      expect(raw).toEqual(expected);
      expect(raw.target).toBe(input.targetDir);
      expect(raw.config.fingerprint).toEqual(input.config.fingerprint);
      expect(staged.manifest).toEqual(expected);
      expect(staged.files).toEqual([...staged.files].sort());
      expect(staged.files).toEqual(
        expect.arrayContaining([
          'index.ts',
          'package.json',
          'dist/plugin.js',
          'dist/assets/agents/agent-0.md',
          'dist/assets/skills/skill-0/SKILL.md',
        ])
      );
      expect(staged.files).not.toContain('.dev-harness-install.json');
      expect(staged.files.every((file) => !path.isAbsolute(file) && !file.includes('\\'))).toBe(true);
      expect(readRawManifest(staged.stagingDir)).toEqual(raw);
    });
  });

  const LAYOUT_CASES: ReadonlyArray<{ name: string; options: FixtureOptions; pattern: RegExp }> = [
    { name: 'a missing bundle', options: { withBundle: false }, pattern: /dist\/plugin\.js is missing.*pnpm build/ },
    { name: 'missing assets', options: { withAssets: false }, pattern: /dist\/assets is missing/ },
    { name: 'too few agents', options: { agents: 6 }, pattern: /expected 7 agent files.*found 6 agents and 17 skills/ },
    {
      name: 'too few skills',
      options: { skills: 16 },
      pattern: /expected 7 agent files and 17 skill directories.*found 7 agents and 16 skills/,
    },
  ];

  it.each(LAYOUT_CASES)('rejects $name with an actionable error', async ({ options, pattern }) => {
    await withTempDir(async (dir) => {
      expect((await buildFailure(dir, options)).message).toMatch(pattern);
    });
  });

  it('rejects a bundle with bare package imports', async () => {
    await withTempDir(async (dir) => {
      const source = "import lodash from 'lodash';\nexport default { id: 'fixture-plugin', setup() {} };\n";
      const error = await buildFailure(dir, { pluginSource: source });

      expect(error.message).toMatch(/not self-contained/);
      expect(error.message).toContain('lodash');
    });
  });

  const INVALID_EXPORTS: ReadonlyArray<{ name: string; source: string; pattern: RegExp }> = [
    { name: 'a missing setup function', source: "export default { id: 'x' };\n", pattern: /setup/ },
    { name: 'an empty id', source: "export default { id: '', setup() {} };\n", pattern: /non-empty id/ },
    {
      name: 'a throwing module',
      source: "throw new Error('boom');\n",
      pattern: /cannot import the staged plugin bundle/,
    },
  ];

  it.each(INVALID_EXPORTS)('cleans staging when the bundle has $name', async ({ source, pattern }) => {
    await withTempDir(async (dir) => {
      expect((await buildFailure(dir, { pluginSource: source })).message).toMatch(pattern);
    });
  });
});

/** Raw manifest JSON in staging (readManifest would reject the staging path by design). */
function readRawManifest(stagingDir: string): InstallManifest {
  return JSON.parse(fs.readFileSync(manifestPathFor(stagingDir), 'utf8')) as InstallManifest;
}

describe('scanBareSpecifiers', () => {
  it('allows node builtins (with or without the node: prefix), relative, and absolute specifiers', () => {
    const source = [
      "import fs from 'node:fs';",
      "import path from 'path';",
      "import { x } from './relative.js';",
      "export { y } from '../parent.js';",
      "export * from '/absolute/module.js';",
      "const lazy = import('node:path');",
      "import './side-effect.js';",
    ].join('\n');

    expect(scanBareSpecifiers(source)).toEqual([]);
  });

  it('reports static, re-exported, side-effect, and dynamic bare imports', () => {
    const source = [
      "import lodash from 'lodash';",
      "export { helper } from '@scope/pkg';",
      "import 'side-effect-pkg';",
      "const lazy = import('dynamic-pkg');",
    ].join('\n');

    expect(scanBareSpecifiers(source)).toEqual(['lodash', '@scope/pkg', 'side-effect-pkg', 'dynamic-pkg']);
  });

  it('ignores commented and quoted import-like text and deduplicates', () => {
    const source = [
      "// import commented from 'commented';",
      "/* export { x } from 'blocked'; */",
      'const message = "import stringy from \'stringy\'";',
      "const template = `import templated from 'templated'`;",
      "import a from 'duplicate';",
      "import b from 'duplicate';",
    ].join('\n');

    expect(scanBareSpecifiers(source)).toEqual(['duplicate']);
  });
});

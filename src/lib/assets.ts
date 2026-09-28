/**
 * assets.ts — load the bundled harness assets (dist/assets/{agents,skills})
 * into structured registration records.
 *
 * - Paths resolve from the module location (`import.meta.dirname`), NOT from
 *   `process.cwd()`, so the plugin finds its assets no matter where opencode
 *   launches it. In the tsup bundle the module lives at dist/plugin.js, so
 *   the default root is `<dist>/assets`.
 * - `loadHarnessAssets(root?)` accepts an explicit root for fixtures/tests.
 * - Per-file parse failures are collected, never thrown, so one bad asset
 *   cannot take the whole plugin down; `errors` entries carry the reason.
 */

import fs from "node:fs"
import path from "node:path"
import { parseFrontmatter } from "./frontmatter.js"
import { buildAgentRecord, buildSkillRecord } from "./records.js"
import type { AgentRecord, SkillRecord } from "./records.js"

export interface LoadError {
  file: string
  reason: string
}

export interface HarnessAssets {
  agents: AgentRecord[]
  skills: SkillRecord[]
  /** Raw content of skills/index.md, or undefined when absent. */
  index: string | undefined
  errors: LoadError[]
}

/** Absolute path of the assets directory next to this module (dist/assets in the bundle). */
export function defaultAssetsRoot(): string {
  return path.join(import.meta.dirname, "assets")
}

function readFileSafe(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8")
  } catch {
    return undefined
  }
}

/** All *.md files directly inside rootDir (non-recursive — agents is flat). */
function listMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.join(dir, e.name))
    .sort()
}

/** The SKILL.md of every direct subdirectory of rootDir. */
function listSkillFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(dir, e.name, "SKILL.md"))
    .filter((f) => fs.existsSync(f))
    .sort()
}

/**
 * Load and parse the scoped manifest. Root layout:
 *   <root>/agents/*.md                     → AgentRecord (name = filename stem)
 *   <root>/skills/<name>/SKILL.md          → SkillRecord (frontmatter name)
 *   <root>/skills/index.md                 → raw index content
 * Invalid files land in `errors` and are excluded from the records.
 */
export function loadHarnessAssets(assetsRoot?: string): HarnessAssets {
  const root = assetsRoot ?? defaultAssetsRoot()
  const errors: LoadError[] = []
  const agents: AgentRecord[] = []
  const skills: SkillRecord[] = []

  for (const file of listMarkdownFiles(path.join(root, "agents"))) {
    const contents = readFileSafe(file)
    if (contents === undefined) { errors.push({ file, reason: "unreadable" }); continue }
    try {
      agents.push(buildAgentRecord(parseFrontmatter(contents), path.basename(file)))
    } catch (err) {
      errors.push({ file, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  for (const file of listSkillFiles(path.join(root, "skills"))) {
    const contents = readFileSafe(file)
    if (contents === undefined) { errors.push({ file, reason: "unreadable" }); continue }
    try {
      skills.push(buildSkillRecord(parseFrontmatter(contents), file, path.basename(path.dirname(file))))
    } catch (err) {
      errors.push({ file, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  return { agents, skills, index: readFileSafe(path.join(root, "skills", "index.md")), errors }
}
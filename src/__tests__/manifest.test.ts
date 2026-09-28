/**
 * manifest.test.ts — name-regex + corpus/manifest consistency checks (R2/R6).
 *
 * Every manifest agent (+6) and skill (+12) name must match the skill-name
 * regex `^[a-z0-9]+(-[a-z0-9]+)*$`, the frontmatter `name` must equal the
 * manifest name, and the on-disk corpus must equal the manifest exactly.
 */
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseFrontmatter } from "../lib/frontmatter.js"
import { MANIFEST_AGENTS, MANIFEST_SKILLS, NAME_REGEX } from "./manifest-fixture.js"

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

describe("name regex", () => {
  it("matches every manifest agent name", () => {
    for (const name of MANIFEST_AGENTS) {
      expect(name, name).toMatch(NAME_REGEX)
    }
  })

  it("matches every manifest skill name", () => {
    for (const name of MANIFEST_SKILLS) {
      expect(name, name).toMatch(NAME_REGEX)
    }
  })
})

describe("frontmatter names equal manifest names", () => {
  it("agents: frontmatter name === manifest name", () => {
    for (const name of MANIFEST_AGENTS) {
      const doc = parseFrontmatter(fs.readFileSync(path.join(REPO_ROOT, "agents", `${name}.md`), "utf8"))
      expect(doc.data.name, name).toBe(name)
      expect(doc.data.name, name).toMatch(NAME_REGEX)
    }
  })

  it("skills: frontmatter name === directory name === manifest name", () => {
    for (const name of MANIFEST_SKILLS) {
      const doc = parseFrontmatter(fs.readFileSync(path.join(REPO_ROOT, "skills", name, "SKILL.md"), "utf8"))
      expect(doc.data.name, name).toBe(name)
      expect(doc.data.name, name).toMatch(NAME_REGEX)
    }
  })
})

describe("on-disk corpus matches the manifest", () => {
  it("agents/ contains exactly the 6 manifest agents", () => {
    const agentFiles = fs
      .readdirSync(path.join(REPO_ROOT, "agents"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""))
      .sort()
    expect(agentFiles).toEqual([...MANIFEST_AGENTS].sort())
  })

  it("skills/ contains exactly the 12 manifest skill directories", () => {
    const skillDirs = fs
      .readdirSync(path.join(REPO_ROOT, "skills"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
    expect(skillDirs).toEqual([...MANIFEST_SKILLS].sort())
  })
})
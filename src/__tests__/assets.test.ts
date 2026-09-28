/**
 * assets.test.ts — loadHarnessAssets against the real repo layout (agents/ +
 * skills/ mirror the dist/assets layout) and against temp fixtures for error
 * handling. loadHarnessAssets(root) is CWD-independent (root injectable).
 */
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadHarnessAssets } from "../lib/assets.js"

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

const MANIFEST_AGENTS = ["software-architect", "software-engineer", "reviewer", "final-reviewer", "executor", "explorer"].sort()
const MANIFEST_SKILLS = [
  "artifact-check",
  "simplify",
  "domain-check",
  "coding",
  "code-review",
  "execute-plan",
  "execute-plan-task",
  "final-review",
  "planning",
  "preflight",
  "review",
  "create-documentation",
].sort()

describe("loadHarnessAssets on the real repo layout", () => {
  const assets = loadHarnessAssets(REPO_ROOT)

  it("loads exactly the 6 manifest agents", () => {
    expect(assets.agents.map((a) => a.name).sort()).toEqual(MANIFEST_AGENTS)
  })

  it("loads exactly the 12 manifest skills including coding", () => {
    expect(assets.skills.map((s) => s.name).sort()).toEqual(MANIFEST_SKILLS)
    expect(assets.skills.some((s) => s.name === "coding")).toBe(true)
  })

  it("captures the index and reports zero errors on the clean corpus", () => {
    expect(assets.index).toBeDefined()
    expect(typeof assets.index).toBe("string")
    expect(assets.errors).toEqual([])
  })

  it("every agent record carries an executable body (system prompt) and a mode", () => {
    for (const a of assets.agents) {
      expect(a.body.trim().length).toBeGreaterThan(0)
      expect(["all", "subagent", "primary"]).toContain(a.mode)
    }
  })
})

describe("loadHarnessAssets error handling", () => {
  it("collects per-file errors instead of throwing, and excludes bad files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dhs-assets-"))
    try {
      fs.mkdirSync(path.join(tmp, "agents"), { recursive: true })
      fs.mkdirSync(path.join(tmp, "skills", "good"), { recursive: true })
      fs.writeFileSync(path.join(tmp, "agents", "bad.md"), "no frontmatter here\n", "utf8")
      fs.writeFileSync(
        path.join(tmp, "skills", "good", "SKILL.md"),
        "---\nname: good\ndescription: A good skill.\n---\nbody\n",
        "utf8",
      )
      const assets = loadHarnessAssets(tmp)
      expect(assets.agents).toHaveLength(0)
      expect(assets.skills.map((s) => s.name)).toEqual(["good"])
      expect(assets.errors).toHaveLength(1)
      expect(assets.errors[0]!.reason).toMatch(/missing leading ---/)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it("returns empty sets for a missing root (never throws)", () => {
    const assets = loadHarnessAssets("/tmp/opencode/definitely-missing-dhs-root")
    expect(assets.agents).toHaveLength(0)
    expect(assets.skills).toHaveLength(0)
    expect(assets.index).toBeUndefined()
    expect(assets.errors).toEqual([])
  })
})
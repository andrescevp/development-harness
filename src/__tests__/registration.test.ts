/**
 * registration.test.ts — integration-style check: run the REAL plugin setup
 * against a stub ctx and assert the manifest registers exactly 6 agents,
 * 12 skills, and ZERO commands.
 *
 * The plugin entry imports the BUILT dist/plugin.js so the whole pipeline
 * (tsup bundle + dist/assets) is under test. Requires `pnpm build` first.
 */
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const DIST_PLUGIN = path.join(REPO_ROOT, "dist", "plugin.js")

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

interface CapturedUpdate {
  domain: "agent" | "skill"
  kind: "update" | "add"
  name: string
}

/** Minimal stub ctx capturing transform registrations (mirrors the V2 contract). */
function createStubContext() {
  const captured: CapturedUpdate[] = []
  const ctx = {
    agent: {
      transform: async (fn: (editor: { update: (id: string, mutate: (agent: Record<string, unknown>) => void) => void }) => void) => {
        fn({
          update: (id, mutate) => {
            const agent: Record<string, unknown> = {}
            mutate(agent)
            captured.push({ domain: "agent", kind: "update", name: id })
          },
        })
      },
    },
    skill: {
      transform: async (fn: (editor: { add: (info: { name: string }) => void }) => void) => {
        fn({
          add: (info) => captured.push({ domain: "skill", kind: "add", name: info.name }),
        })
      },
    },
  }
  return { ctx, captured }
}

describe("plugin setup registration (built bundle)", () => {
  it("dist is built (run `pnpm build` first)", () => {
    expect(fs.existsSync(DIST_PLUGIN)).toBe(true)
  })

  it("registers exactly the 6 manifest agents and 12 skills, zero commands", async () => {
    const { default: plugin } = (await import(DIST_PLUGIN)) as {
      default: { id: string; setup: (ctx: ReturnType<typeof createStubContext>["ctx"]) => Promise<void> }
    }
    expect(plugin.id).toBe("dev-harness-skills")
    expect(typeof plugin.setup).toBe("function")

    const { ctx, captured } = createStubContext()
    await plugin.setup(ctx)

    const agents = captured.filter((c) => c.domain === "agent" && c.kind === "update").map((c) => c.name).sort()
    const skills = captured.filter((c) => c.domain === "skill" && c.kind === "add").map((c) => c.name).sort()

    expect(agents).toEqual(MANIFEST_AGENTS)
    expect(skills).toEqual(MANIFEST_SKILLS)
    // No command domain exists in the stub → every capture must be agent/skill.
    expect(captured.every((c) => c.domain === "agent" || c.domain === "skill")).toBe(true)
  })
})
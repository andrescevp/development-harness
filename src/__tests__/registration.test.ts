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
  domain: "agent" | "skill" | "tool" | "command"
  kind: "update" | "add" | "namespace"
  name?: string
  namespace?: string
  codemode?: boolean
}

/** Minimal stub ctx capturing transform registrations (mirrors the V2 contract). */
function createStubContext() {
  const captured: CapturedUpdate[] = []
  const ctx = {
    location: { directory: process.cwd() },
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
    tool: {
      transform: async (fn: (editor: { namespace: (ns: { name: string }) => void; add: (info: { name: string; options?: { namespace?: string; codemode?: boolean }; execute?: unknown }) => void }) => void) => {
        fn({
          namespace: (ns) => captured.push({ domain: "tool", kind: "namespace", name: ns.name, namespace: ns.name }),
          add: (info) => captured.push({ domain: "tool", kind: "add", name: info.name, namespace: info.options?.namespace, codemode: info.options?.codemode ?? false }),
        })
      },
    },
    command: {
      transform: async () => {
        throw new Error("command domain must never be touched (commands out of scope)")
      },
    },
  }
  return { ctx, captured }
}

const MANIFEST_TOOLS = ["plan_read", "plan_update_status", "plan_create"].sort()

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
    const tools = captured.filter((c) => c.domain === "tool" && c.kind === "add").map((c) => c.name).sort()

    expect(agents).toEqual(MANIFEST_AGENTS)
    expect(skills).toEqual(MANIFEST_SKILLS)
    expect(tools).toEqual(MANIFEST_TOOLS)
    // One harness namespace registered; all 3 tools are codemode.
    const namespaces = captured.filter((c) => c.domain === "tool" && c.kind === "namespace")
    expect(namespaces.map((c) => c.name)).toEqual(["harness"])
    const toolAdds = captured.filter((c) => c.domain === "tool" && c.kind === "add")
    expect(toolAdds.every((c) => c.codemode === true)).toBe(true)
    expect(toolAdds.every((c) => c.namespace === "harness")).toBe(true)
    // No command domain is ever touched (stub throws if invoked).
    expect(captured.some((c) => c.domain === "command")).toBe(false)
    expect(captured.every((c) => c.domain === "agent" || c.domain === "skill" || c.domain === "tool")).toBe(true)
  })
})
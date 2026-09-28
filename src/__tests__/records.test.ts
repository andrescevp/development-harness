/**
 * records.test.ts — record builders: model split, V1→V2 permissions mapping,
 * skill record shape. All inputs synthetic; no repo I/O.
 */
import { describe, expect, it } from "vitest"
import { parseFrontmatter } from "../lib/frontmatter.js"
import { buildAgentRecord, buildPermissions, buildSkillRecord } from "../lib/records.js"

function parse(doc: string) {
  return parseFrontmatter(doc)
}

describe("buildPermissions (V1 tools + permission → V2 ruleset)", () => {
  it("maps tools booleans to allow/deny wildcard rules and normalizes write/patch → edit", () => {
    const rules = buildPermissions({ bash: true, read: false, write: true }, {})
    expect(rules).toEqual([
      { action: "bash", resource: "*", effect: "allow" },
      { action: "read", resource: "*", effect: "deny" },
      { action: "edit", resource: "*", effect: "allow" }, // write → edit
    ])
  })

  it("maps string permission entries to wildcard rules", () => {
    const rules = buildPermissions({}, { task: "allow", edit: "ask" })
    expect(rules).toEqual([
      { action: "task", resource: "*", effect: "allow" },
      { action: "edit", resource: "*", effect: "ask" },
    ])
  })

  it("maps nested permission maps to per-resource rules", () => {
    const rules = buildPermissions({}, { external_directory: { "/tmp": "allow", "/tmp/**": "allow" } })
    expect(rules).toEqual([
      { action: "external_directory", resource: "/tmp", effect: "allow" },
      { action: "external_directory", resource: "/tmp/**", effect: "allow" },
    ])
  })

  it("orders tools first, then permission (explicit permission wins for the same action)", () => {
    const rules = buildPermissions({ task: true }, { task: "deny" })
    expect(rules).toHaveLength(2)
    expect(rules[0]).toEqual({ action: "task", resource: "*", effect: "allow" })
    expect(rules[1]).toEqual({ action: "task", resource: "*", effect: "deny" })
  })

  it("ignores malformed entries (non-boolean tools, unknown effects)", () => {
    const rules = buildPermissions({ bash: "yes" as unknown as boolean }, { edit: "nope" as never })
    expect(rules).toEqual([])
  })
})

describe("buildAgentRecord", () => {
  it("splits model at the last slash into providerId/modelId and keeps variant", () => {
    const rec = buildAgentRecord(
      parse(`---
name: software-engineer
description: Main builder agent
mode: all
model: opencode-go/deepseek-v4-flash
variant: max
---
Body text`),
    )
    expect(rec.name).toBe("software-engineer")
    expect(rec.mode).toBe("all")
    expect(rec.providerId).toBe("opencode-go")
    expect(rec.modelId).toBe("deepseek-v4-flash")
    expect(rec.variant).toBe("max")
    expect(rec.body).toContain("Body text")
  })

  it("defaults mode to subagent when absent", () => {
    const rec = buildAgentRecord(parse("---\nname: x\ndescription: y\n---\n"))
    expect(rec.mode).toBe("subagent")
  })

  it("supports a bare model id (no slash)", () => {
    const rec = buildAgentRecord(parse("---\nname: x\ndescription: y\nmodel: my-model\n---\n"))
    expect(rec.providerId).toBeUndefined()
    expect(rec.modelId).toBe("my-model")
  })

  it("throws on a missing name/description and on invalid mode", () => {
    expect(() => buildAgentRecord(parse("---\ndescription: y\n---\n"), "a.md")).toThrow(/name/)
    expect(() => buildAgentRecord(parse("---\nname: x\n---\n"), "b.md")).toThrow(/description/)
    expect(() => buildAgentRecord(parse("---\nname: x\ndescription: y\nmode: hybrid\n---\n"), "c.md")).toThrow(/mode/)
  })
})

describe("buildSkillRecord", () => {
  it("builds the full Skill.Info shape {name, description, path, content}", () => {
    const rec = buildSkillRecord(
      parse(`---
name: coding
description: TDD coding best practices; reads CODE_RULES.md at project root.
---
Do the work.`),
      "/abs/skills/coding/SKILL.md",
      "coding",
    )
    // splitFrontmatter keeps the single newline that follows the closing `---`;
    // the record builder passes body through unchanged (matches the plugin's
    // agent.system behavior — a leading newline is harmless in content).
    expect(rec).toEqual({
      name: "coding",
      description: "TDD coding best practices; reads CODE_RULES.md at project root.",
      path: "/abs/skills/coding/SKILL.md",
      content: "\nDo the work.",
    })
  })

  it("throws when name or description is missing", () => {
    expect(() => buildSkillRecord(parse("---\ndescription: only-desc\n---\n"), "/p", "s")).toThrow(/name/)
    expect(() => buildSkillRecord(parse("---\nname: only-name\n---\n"), "/p", "s")).toThrow(/description/)
  })
})
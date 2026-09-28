/**
 * dev-harness-skills — OpenCode V2 plugin.
 *
 * Registers the scoped dev harness manifest (6 agents, 12 skills) via
 * synchronous domain transforms. Assets are loaded BEFORE the transforms run
 * (transforms are synchronous; external data must be pre-loaded), resolved
 * from the bundle location (`import.meta.dirname` → dist/assets), NOT from
 * the process CWD.
 *
 * Semantics verified against @opencode/plugin@2.0.18 typings + host source:
 *   - `ctx.agent.transform(editor)`: `editor.update(id, (agent) => void)`
 *     UPSERTS — the host creates plugin-scope agents that do not exist yet
 *     (the built-in agent plugin registers `plan`/`explore`/... the same way)
 *     and mutates existing ones. Frontmatter `tools`/`permission` fold into
 *     the V2 `permissions` ruleset, `model` splits into {id, providerID},
 *     `prompt`/body becomes `system`.
 *   - `ctx.skill.transform(editor)`: `editor.add(skill)` needs the full
 *     Skill.Info shape { id, name, description, path, content }.
 *
 * NO command transforms, NO prompt registration (user-mandated scope).
 */
import { Plugin } from "@opencode/plugin"
import type { Agent, Skill } from "@opencode/plugin"
import { loadHarnessAssets } from "./lib/assets.js"
import type { AgentRecord, SkillRecord } from "./lib/records.js"

const PLUGIN_ID = "dev-harness-skills"
const LOG_PREFIX = "[dev-harness-skills]"

function logSummary(agents: AgentRecord[], skills: SkillRecord[], skipped: number): void {
  console.log(`${LOG_PREFIX} registered ${agents.length} agents, ${skills.length} skills${skipped ? ` (${skipped} invalid assets skipped)` : ""}`)
}

/** Register the 6 manifest agents (upsert via the mutator editor). */
export default Plugin.define({
  id: PLUGIN_ID,
  async setup(ctx: Plugin.Context): Promise<void> {
    // 1. Load ALL assets BEFORE any transform (async setup body, sync reads).
    const { agents, skills, errors } = loadHarnessAssets()
    if (errors.length > 0) {
      console.warn(`${LOG_PREFIX} ${errors.length} asset(s) skipped:`)
      for (const e of errors) console.warn(`  - ${e.file}: ${e.reason}`)
    }

    // 2. Synchronous transforms — registration order: agents, then skills.
    await ctx.agent.transform((editor) => {
      for (const record of agents) {
        editor.update(record.name, (agent) => {
          agent.description = record.description
          agent.mode = record.mode
          agent.hidden = false
          agent.system = record.body
          agent.permissions = record.permissions
          if (record.modelId !== undefined) {
            agent.model = {
              id: record.modelId,
              providerID: record.providerId ?? record.modelId,
              ...(record.variant !== undefined ? { variant: record.variant } : {}),
            } as Agent.Info["model"]
          }
        })
      }
    })

    await ctx.skill.transform((editor) => {
      for (const record of skills) {
        editor.add({
          id: record.name,
          name: record.name,
          description: record.description,
          path: record.path,
          content: record.content,
        } as Skill.Info)
      }
    })

    logSummary(agents, skills, errors.length)
  },
})
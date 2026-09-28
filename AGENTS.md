# AGENTS.md — dev-harness V2 plugin (harness runtime contract)

Role summary, provenance, plugin registration, the 5-step skills loop that
every agent executing plans inside this plugin must follow, and the
agent-name normalization required for runtime delegation.

## Role summary

The `dev-harness-skills` OpenCode V2 plugin bundles a scoped dev harness for
plan-driven development: **6 agents** — `software-architect`,
`software-engineer`, `reviewer`, `final-reviewer`, `executor`, `explorer` —
and **12 skills** — `planning`, `domain-check`, `execute-plan`,
`execute-plan-task`, `coding`, `simplify`, `review`, `code-review`, `preflight`,
`artifact-check`, `final-review`, `create-documentation`. The plugin registers
agents and skills only; **no commands, no prompts** are bundled or registered.
All plan execution inside the plugin runs the skills loop below.

## The skills loop (harness runtime contract)

Plans are **phased**: a plan is an ordered set of phases, each containing
sub-tasks, with status markers at BOTH levels (Pending | In Progress |
Completed). The loop:

1. `planning` → use `domain-check` while planning (creates phased plans)
2. `execute-plan` (iterates phases in order → their sub-tasks)
   2.1 `execute-plan-task` → use `coding`
   2.2 `simplify`
   2.3 `review` + `code-review`
   2.4 IF hard blockers → stop and ask guidance; otherwise keep `execute-plan-task` loop
3. `preflight` + `artifact-check`
4. `final-review` (reports per-phase completion)
5. `create-documentation`

**Phase lifecycle:** a phase becomes `In Progress` when its first sub-task
starts and `Completed` only when ALL its sub-tasks are `Completed`. Resume
mode continues the first `In Progress` phase → its first `In Progress` /
`Pending` sub-task.

**Step 2.4 halts automation.** When `execute-plan-task` (or any loop step)
hits a hard blocker — repeated validation failures (3 consecutive strikes),
unresolved P0/P1 review findings, or missing preconditions that cannot be
worked around — the loop STOPS: report the blocker and ask the user for
guidance. Never silently continue, never skip the blocked step, and never mark
sub-tasks Complete around a blocker. The rule applies at phase boundaries too:
a blocked sub-task blocks its phase — do not mark the phase `Completed` around
a blocker.

**Plan lifecycle tools (bundled harness namespace):** `harness_plan_read`,
`harness_plan_update_status`, `harness_plan_create` — read/parse phased plans,
update phase/sub-task status markers, and scaffold new phased plans from
`docs/plans`. Loop skills and the planner agents prefer these tools over
manual plan.md edits (fall back to manual edits only when the tools are
unavailable). Format contract:
`skills/planning/references/phased-plan-template.md`.

## Agent-name normalization (runtime delegation)

**Single task executor:** ALL sub-task implementation in this harness is
delegated to `@senior-engineer` (registered in the plugin as
`software-engineer` — same agent). There is no complexity- or type-based
builder split; `execute-plan-task` and `coding` route every task there.

`@build`, `@senior-engineer`, `@senior-architect`, and `@plan` do NOT resolve
in the plugin runtime — only the 6 manifest agents exist. Normalize every
delegation with this mapping:

| Reference (does not resolve) | Runtime agent to use |
|---|---|
| `@build` | `@software-engineer` |
| `@senior-engineer` | `@software-engineer` |
| `@senior-architect` | `@software-architect` |
| `@plan` (planning role) | `@software-architect` |
| `@reviewer` | `@reviewer` (as-is) |
| `@final-reviewer` | `@final-reviewer` (as-is) |
| `@executor` | `@executor` (as-is) |
| `@explorer` | `@explorer` (as-is) |

## Provenance

- Harness content is extracted from `~/.agents` (read-only source; nothing
  there is modified). OpenCode-only — no copilot/gemini variants.
- Alias mapping on copy: `senior-architect` → `software-architect`,
  `senior-engineer` → `software-engineer` (frontmatter `name` only; bodies
  byte-identical).
- User-mandated scoped manifest: exactly 6 agents + 12 skills. Commands,
  prompts, and all other harness content are intentionally NOT bundled.
- Full extraction record, exclusions, and copy rules:
  [`docs/EXTRACTION.md`](docs/EXTRACTION.md).

## Plugin registration and loading

- The V2 plugin (`Plugin.define`) registers the 6 agents and 12 skills via
  synchronous domain transforms (`ctx.agent.transform`, `ctx.skill.transform`)
  from frontmatter-parsed assets in `dist/assets/`. Zero command transforms
  (commands are out of scope).
- **Loading:** add the built plugin to `opencode.jsonc`. In opencode v2, a
  `file://` plugins entry must point to a **directory** (the package dir), not
  a `plugin.js` file:
  `"plugins": ["file:///home/andres/workspace/dev-harness-skills"]`.
  See [`docs/LOADING.md`](docs/LOADING.md) for alternatives + verification.
- **Verify:** launch opencode and confirm the 6 agents and 12 skills appear
  (including `coding`) and no commands are registered.
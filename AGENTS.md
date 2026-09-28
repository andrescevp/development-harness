# AGENTS.md — dev-harness V2 plugin (harness runtime contract)

Role summary, provenance, plugin registration, the 5-step skills loop that
every agent executing plans inside this plugin must follow, and the
agent-name normalization required for runtime delegation.

## Role summary

The `dev-harness-skills` OpenCode V2 plugin bundles a scoped dev harness for
plan-driven development: **6 agents** — `dh-software-architect`,
`dh-software-engineer`, `dh-reviewer`, `dh-final-reviewer`, `dh-executor`, `dh-explorer` —
and **14 skills** — `dh-planning`, `dh-domain-check`, `dh-execute-plan`,
`dh-execute-plan-task`, `dh-coding`, `dh-simplify`, `dh-review`, `dh-code-review`, `dh-preflight`,
`dh-artifact-check`, `dh-final-review`, `dh-create-documentation`, `dh-grill-sdd`, `dh-setup`. The plugin registers
agents and skills only; **no commands, no prompts** are bundled or registered.
All plan execution inside the plugin runs the skills loop below.

## The skills loop (harness runtime contract)

Plans are **phased**: a plan is an ordered set of phases, each containing
sub-tasks, with status markers at BOTH levels (Pending | In Progress |
Completed). The loop:

1. `dh-planning` → use `dh-domain-check` while planning (creates phased plans)
2. `dh-execute-plan` (iterates phases in order → their sub-tasks)
   2.1 `dh-execute-plan-task` → use `dh-coding`
   2.2 `dh-simplify`
   2.3 `dh-review` + `dh-code-review`
   2.4 IF hard blockers → stop and ask guidance; otherwise keep `dh-execute-plan-task` loop
3. `dh-preflight` + `dh-artifact-check`
4. `dh-final-review` (reports per-phase completion)
5. `dh-create-documentation`

**Phase lifecycle:** a phase becomes `In Progress` when its first sub-task
starts and `Completed` only when ALL its sub-tasks are `Completed`. Resume
mode continues the first `In Progress` phase → its first `In Progress` /
`Pending` sub-task.

**Step 2.4 halts automation.** When `dh-execute-plan-task` (or any loop step)
hits a hard blocker — repeated validation failures (3 consecutive strikes),
unresolved P0/P1 review findings, or missing preconditions that cannot be
worked around — the loop STOPS: report the blocker and ask the user for
guidance. Never silently continue, never skip the blocked step, and never mark
sub-tasks Complete around a blocker. The rule applies at phase boundaries too:
a blocked sub-task blocks its phase — do not mark the phase `Completed` around
a blocker.

**Plan lifecycle tools (bundled harness namespace):** `dh_plan_read`,
`dh_plan_update_status`, `dh_plan_create` — read/parse phased plans,
update phase/sub-task status markers, and scaffold new phased plans from
`docs/plans`. Loop skills and the planner agents prefer these tools over
manual plan.md edits (fall back to manual edits only when the tools are
unavailable). Format contract:
`skills/planning/references/phased-plan-template.md`.

## Agent-name normalization (runtime delegation)

**Single task executor:** ALL sub-task implementation in this harness is
delegated to `@senior-engineer` (registered in the plugin as
`dh-software-engineer` — same agent). There is no complexity- or type-based
builder split; `dh-execute-plan-task` and `dh-coding` route every task there.

`@build`, `@senior-engineer`, `@senior-architect`, and `@plan` do NOT resolve
in the plugin runtime — only the 6 manifest agents exist. Normalize every
delegation with this mapping:

| Reference (does not resolve) | Runtime agent to use |
|---|---|
| `@build` | `@dh-software-engineer` |
| `@senior-engineer` | `@dh-software-engineer` |
| `@senior-architect` | `@dh-software-architect` |
| `@plan` (planning role) | `@dh-software-architect` |
| `@dh-reviewer` | `@dh-reviewer` (as-is) |
| `@dh-final-reviewer` | `@dh-final-reviewer` (as-is) |
| `@dh-executor` | `@dh-executor` (as-is) |
| `@dh-explorer` | `@dh-explorer` (as-is) |

## Provenance

- Harness content is extracted from `~/.agents` (read-only source; nothing
  there is modified). OpenCode-only — no copilot/gemini variants.
- Alias mapping on copy: `senior-architect` → `dh-software-architect`,
  `senior-engineer` → `dh-software-engineer` (frontmatter `name` only; bodies
  byte-identical).
- User-mandated scoped manifest: exactly 6 agents + 14 skills. Commands,
  prompts, and all other harness content are intentionally NOT bundled.
- Full extraction record, exclusions, and copy rules:
  [`docs/EXTRACTION.md`](docs/EXTRACTION.md).

## Plugin registration and loading

- The V2 plugin (`Plugin.define`) registers the 6 agents and 14 skills via
  synchronous domain transforms (`ctx.agent.transform`, `ctx.skill.transform`)
  from frontmatter-parsed assets in `dist/assets/`. Zero command transforms
  (commands are out of scope).
- **Loading:** add the built plugin to `opencode.jsonc`. In opencode v2, a
  `file://` plugins entry must point to a **directory** (the package dir), not
  a `plugin.js` file:
  `"plugins": ["file:///home/andres/workspace/dev-harness-skills"]`.
  See [`docs/LOADING.md`](docs/LOADING.md) for alternatives + verification.
- **Verify:** launch opencode and confirm the 6 agents and 14 skills appear
  (including `dh-coding`) and no commands are registered.
## QA tooling

Full QA stack wired through `pnpm qa:check` (fails on any finding):

| Tool | Script | Scope |
|---|---|---|
| Biome | `pnpm lint:biome` / `pnpm format:biome` | lint + format of `src/` `scripts/` |
| Knip | `pnpm lint:knip` | unused exports/deps/binaries |
| jscpd | `pnpm lint:dup` | duplicate code detection (config `.jscpd.json`) |
| dependency-cruiser | `pnpm lint:depcruise` (`.dependency-cruiser.json`) | import-graph rules: no-circular, no-duplicates, no-orphans, no node builtins in lib code; tsconfig-aware, cruises `src/` |
| OSV-Scanner | `pnpm scan:deps` (docker) | dependency vulnerabilities |
| Semgrep | `pnpm scan:code` (docker) | security patterns |
| TypeScript | `tsc -b` (in `pnpm build`) | strict typecheck (typescript 6.x — dependency-cruiser requires <7) |
| Vitest | `pnpm test` | unit tests |

Full gate: `pnpm qa:check:full` = qa:check + test + typecheck + audit + build + smoke-load.
Note: `pnpm audit` collides with pnpm's security audit — the harness audit is `pnpm run audit`.

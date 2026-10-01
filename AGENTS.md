# AGENTS.md — dev-harness V2 plugin (harness runtime contract)

Role summary, provenance, plugin registration, the 5-step skills loop that
every agent executing plans inside this plugin must follow, and the
runtime delegation routing.

## Role summary

The `dev-harness-skills` OpenCode V2 plugin bundles a self-contained dev harness for
plan-driven development: **7 agents** — `dh-software-architect`,
`dh-software-engineer`, `dh-reviewer`, `dh-final-reviewer`, `dh-executor`, `dh-explorer`, `dh-documentor` —
and **15 skills** — `dh-planning`, `dh-domain-check`, `dh-execute-plan`,
`dh-execute-plan-task`, `dh-coding`, `dh-simplify`, `dh-review`, `dh-code-review`, `dh-preflight`,
`dh-artifact-check`, `dh-final-review`, `dh-create-documentation`, `dh-grill-sdd`, `dh-setup`, `dh-code-ruler`. The plugin registers
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
`skills/dh-planning/references/phased-plan-template.md`.

## Runtime delegation

**Single task executor:** ALL sub-task implementation in this harness is
delegated to `@dh-software-engineer`. There is no complexity- or type-based
builder split; `dh-execute-plan-task` and `dh-coding` route every task there.
Architectural guidance comes from `@dh-software-architect`. These are the
bundled agent names — no mapping is needed.

## Provenance

- Harness content is **fully repo-authored**: `agents/` and `skills/` are
  owned by this repository — the repo is self-contained and independent
  (no external source, no extraction step).
- OpenCode-only — no copilot/gemini variants.
- Exactly **7 agents + 15 skills** are bundled. Commands, prompts, and all
  other non-bundled harness content are intentionally NOT bundled.
- The `dh-` names are canonical in the repo files; bundled agents ship
  without the `permission` and `tools` frontmatter keys.

## Plugin registration and loading

- The V2 plugin (`Plugin.define`) registers the 7 agents and 15 skills via
  synchronous domain transforms (`ctx.agent.transform`, `ctx.skill.transform`)
  from frontmatter-parsed assets (repo `agents/` + `skills/` in source mode,
  `dist/assets/` in the bundle). Zero command transforms (commands are out
  of scope). The root `index.ts` is the plugin-directory discovery entry:
  cloning this repo into `~/.config/opencode/plugins/` (global) or
  `<project>/.opencode/plugins/` loads the plugin from source — no build or
  config entry needed.
- **Loading alternatives:** `opencode plugin add github:andrescevp/development-harness`
  (managed install, private-repo friendly), a `file://`/relative entry in
  `opencode.json(c)` pointing at a built clone (`pnpm build` first), or the
  installed package name. See [`docs/LOADING.md`](docs/LOADING.md).
- **Verify:** launch opencode and confirm the 7 agents and 15 skills appear
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

## Git Flow (repository workflow)

This repository is managed with **Git Flow**:

- `main` — production branch; every commit is releasable. Accepts ONLY
  merges from `release/*` and `hotfix/*` (no direct feature merges).
- `develop` — integration branch; the default base for all new work.
- `feature/*` — branched from `develop` for planned work
  (`feat`/`fix`/`refactor`/`docs` commits); merged back with `--no-ff`.
- `bugfix/*` — branched from `develop` for fixes to in-development work.
- `release/*` — branched from `develop` when a release is cut; merged to
  `main` AND back to `develop`; tagged on `main`.
- `hotfix/*` — branched from `main` for production fixes; merged to `main`
  AND `develop`; tagged on `main`.
- Tags: semver (`vX.Y.Z`) on `main` only (see dh-semver guidance).

Local config already set (`git config gitflow.*`): main/develop + the
prefixes above.

## Generated documentation search

Search generated documentation (vault = project root; docs under
`{project_root}/docs`) quickly with the Obsidian CLI or notesmd-cli:

```bash
# notesmd-cli (works without Obsidian running; vault = project folder name)
notesmd-cli search-content "search term" --vault "<project-name>"
# Obsidian CLI (requires the Obsidian app running)
obsidian search query="search term"
# Fallback when neither is installed
rg --glob '*.md' "search term" docs/
```

Use the first available tool (notesmd-cli preferred, then obsidian, then
`rg`). The project root is an Obsidian vault when it contains `.obsidian/`;
`dh-setup` checks and initializes it.

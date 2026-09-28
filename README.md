# dev-harness-skills

**OpenCode V2 plugin** that bundles a scoped personal dev harness for
plan-driven development: **6 agents** and **12 skills** wired into a
planning → execution → review → release loop.

| | |
|---|---|
| Platform | OpenCode V2 (`@opencode/plugin`, `Plugin.define`) |
| Source harness | `~/.agents` (read-only; opencode-only) |
| Manifest | 6 agents · 12 skills · **no commands/prompts** (user-mandated scope) |
| Toolchain | TypeScript + tsup + vitest (pnpm) |

## Manifest

**Agents (6):** `dh-software-architect` (planning, execute-plan,
create-documentation), `dh-software-engineer` (execute-plan-task, coding),
`dh-reviewer` (simplify, review, code-review), `dh-final-reviewer` (final-review),
`dh-executor`, `dh-explorer`.

**Skills (12):** `dh-artifact-check`, `dh-simplify`, `dh-domain-check`, `dh-coding`,
`dh-code-review`, `dh-execute-plan`, `dh-execute-plan-task`, `dh-final-review`,
`dh-planning`, `dh-preflight`, `dh-review`, `dh-create-documentation`.
`dh-coding` is the NEW skill — TDD coding best practices that reads project
rules from `CODE_RULES.md` at the project root when present.

**The skills loop** (see [`AGENTS.md`](AGENTS.md)) — plans are **phased**
(phases → sub-tasks with dual status markers; format contract in
`skills/planning/references/phased-plan-template.md`):

1. `dh-planning` → use `dh-domain-check` while planning
2. `dh-execute-plan` → 2.1 `dh-execute-plan-task` (uses `dh-coding`) · 2.2 `dh-simplify`
   · 2.3 `dh-review` + `dh-code-review` · 2.4 hard blockers → stop and ask guidance
   (otherwise loop back to 2.1)
3. `dh-preflight` + `dh-artifact-check`
4. `dh-final-review`
5. `dh-create-documentation`

## Plan lifecycle tools (bundled)

The plugin registers a `harness` namespace with three V2 custom tools
(codemode) for managing phased plans under `docs/plans`:

| Tool | Purpose |
|---|---|
| `dh_plan_read` | Parse a phased plan into structured JSON (meta, phases, sub-tasks with statuses) |
| `dh_plan_update_status` | Update a phase or sub-task status marker (phase → Completed only when all its sub-tasks are Completed) |
| `dh_plan_create` | Scaffold a new phased plan from a title + objective + phases/sub-tasks |
| `dh_logged_command` | Run a command with its log in the OS temp dir, returning head/tail + log path (executor strategy) |

The loop skills (`dh-planning`, `dh-execute-plan`, `dh-execute-plan-task`, `dh-review`,
`dh-final-review`) and the `dh-software-architect` / `dh-software-engineer` agents use
these tools instead of manual plan.md edits (fallback to manual edits when the
tools are unavailable).

## Provenance

- Harness content is extracted from `~/.agents` (read-only source; nothing
  there is modified). See [`docs/EXTRACTION.md`](docs/EXTRACTION.md).
- Alias mapping on copy: `senior-architect` → `dh-software-architect`,
  `senior-engineer` → `dh-software-engineer` (frontmatter `name` only; bodies
  byte-identical modulo the sanctioned plan-tools note).
- Bundled agents ship **without the `permission` frontmatter key** (M3
  mandate) — permission rules derive from `tools` only; the strip is a
  declarative patch applied on extraction and verified by `extract --check`.
- Runtime delegation normalization (the plugin registers only the 6 manifest
  agents): `@build`/`@senior-engineer` → `@dh-software-engineer`,
  `@senior-architect`/`@plan` → `@dh-software-architect` — see AGENTS.md table.

## Quickstart

```sh
# install deps + build + audit
pnpm install
pnpm run audit      # harness manifest audit (FAIL findings must be 0)
pnpm build      # tsup ESM bundle + declarations + dist/assets copy
pnpm test       # vitest suite (51 tests): parser, builders, registration

# load into opencode: add to opencode.jsonc
#   "plugins": ["file:///home/andres/workspace/dev-harness-skills"]
# see docs/LOADING.md for alternatives + verification + troubleshooting
```

Gate command set (release readiness):

```sh
pnpm typecheck && pnpm run audit && pnpm test && pnpm build && node scripts/smoke-load.mjs
```

## Repository layout

```
agents/          bundled agent markdown (6) — frontmatter + system prompt body
skills/          bundled skills (12) + index.md
src/             plugin entry + lib (assets loader, records, frontmatter)
scripts/         extract.mjs, audit.mjs, copy-assets.mjs, smoke-load.mjs, manifest.json
docs/            EXTRACTION.md, LOADING.md, plans/
dist/            build output (plugin.js + assets) — generated, git-ignored
```

## Documentation

- [`AGENTS.md`](AGENTS.md) — harness runtime contract: loop, provenance,
  agent-name normalization, loading.
- [`docs/EXTRACTION.md`](docs/EXTRACTION.md) — extraction record + exclusions.
- [`docs/LOADING.md`](docs/LOADING.md) — how to load the plugin, verification,
  troubleshooting.
- [`docs/plans/dev-harness-v2-plugin/`](docs/plans/dev-harness-v2-plugin/) —
  the implementation plan, audit report, reviews, verification report.
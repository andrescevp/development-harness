# dev-harness-skills

> **Git Flow:** managed with `main` (production) + `develop` (integration) and `feature/`, `bugfix/`, `release/`, `hotfix/` branches — see `AGENTS.md` → Git Flow.

**OpenCode V2 plugin** that bundles a self-contained dev harness for
plan-driven development: **7 agents** and **15 skills** wired into a
planning → execution → review → release loop.

| | |
|---|---|
| Platform | OpenCode V2 (`@opencode/plugin`, `Plugin.define`) |
| Source | Fully repo-authored (agents/ + skills/ owned by this repo — independent, nothing external) |
| Surface | 7 agents · 15 skills · **no commands/prompts** |
| Toolchain | TypeScript + tsup + vitest (pnpm) |

## Agents & skills

**Agents (7):** `dh-software-architect` (planning, execute-plan,
create-documentation), `dh-software-engineer` (execute-plan-task, coding),
`dh-reviewer` (simplify, review, code-review), `dh-final-reviewer` (final-review),
`dh-executor`, `dh-explorer`, `dh-documentor`.

**Skills (15):** `dh-artifact-check`, `dh-simplify`, `dh-domain-check`, `dh-coding`,
`dh-code-review`, `dh-execute-plan`, `dh-execute-plan-task`, `dh-final-review`,
`dh-planning`, `dh-preflight`, `dh-review`, `dh-create-documentation`, `dh-grill-sdd`, `dh-setup`, `dh-code-ruler`.
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
| `dh_read_sheet` / `dh_update_sheet` / `dh_sheet_schema` | DuckDB-backed csv/xlsx management (read, update, describe) |

The loop skills (`dh-planning`, `dh-execute-plan`, `dh-execute-plan-task`, `dh-review`,
`dh-final-review`) and the `dh-software-architect` / `dh-software-engineer` agents use
these tools instead of manual plan.md edits (fallback to manual edits when the
tools are unavailable).

## Provenance

- Harness content is **fully repo-authored**: `agents/` and `skills/` are
  owned by this repository — the repo is self-contained and independent
  (no external source, no extraction step).
- The `dh-` names are canonical in the repo files. Bundled agents ship
  **without the `permission` and `tools` frontmatter keys** — registration
  carries no static tool rules; enforced by the audit.
- Runtime delegation uses the bundled agent names directly:
  `@dh-software-engineer` for implementation, `@dh-software-architect` for
  architecture — see AGENTS.md → Runtime delegation.

## Quickstart

```sh
# INSTALL (global, all projects) — clone into the plugin folder; opencode
# auto-discovers the root index.ts entry (no config, no build):
git clone https://github.com/andrescevp/development-harness.git \
  ~/.config/opencode/plugins/dev-harness-skills
cd ~/.config/opencode/plugins/dev-harness-skills && pnpm install

# or as a managed package (private repo works via your git credentials):
opencode plugin add github:andrescevp/development-harness

# DEVELOP (inside the repo):
pnpm install
pnpm run audit      # harness audit (FAIL findings must be 0)
pnpm build      # tsup ESM bundle + declarations + dist/assets copy (package installs)
pnpm test       # vitest suite: parser, builders, plan tools, registration, root entry

# see docs/LOADING.md for alternatives + verification + troubleshooting
```

QA command set (mirrors the libresurvey frontend stack):

```sh
pnpm qa:check        # biome + knip + jscpd + dependency-cruiser + osv/semgrep (docker)
pnpm qa:check:full   # qa:check + test + typecheck + audit + build + smoke-load
pnpm format:biome   # apply biome formatting
```

Gate command set (release readiness):

```sh
pnpm typecheck && pnpm run audit && pnpm test && pnpm build && node scripts/smoke-load.mjs
```

## Repository layout

```
index.ts         root plugin entry — opencode plugin-directory discovery (loads from source)
agents/          bundled agent markdown (7) — frontmatter + system prompt body
skills/          bundled skills (15) + index.md
src/             plugin entry + lib (assets loader, records, frontmatter)
scripts/         audit.mjs, copy-assets.mjs, smoke-load.mjs
test/            root-entry test (vitest)
docs/            LOADING.md, plans/
dist/            build output (plugin.js + assets) — generated, git-ignored
```

## Documentation

- [`AGENTS.md`](AGENTS.md) — harness runtime contract: loop, provenance,
  runtime delegation, loading.
- [`docs/LOADING.md`](docs/LOADING.md) — how to load the plugin, verification,
  troubleshooting.
- [`docs/plans/dev-harness-v2-plugin/`](docs/plans/dev-harness-v2-plugin/) —
  the implementation plan, audit report, reviews, verification report.
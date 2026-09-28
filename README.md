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

**Agents (6):** `software-architect` (planning, execute-plan,
create-documentation), `software-engineer` (execute-plan-task, coding),
`reviewer` (simplify, review, code-review), `final-reviewer` (final-review),
`executor`, `explorer`.

**Skills (12):** `artifact-check`, `simplify`, `domain-check`, `coding`,
`code-review`, `execute-plan`, `execute-plan-task`, `final-review`,
`planning`, `preflight`, `review`, `create-documentation`.
`coding` is the NEW skill — TDD coding best practices that reads project
rules from `CODE_RULES.md` at the project root when present.

**The skills loop** (see [`AGENTS.md`](AGENTS.md)):

1. `planning` → use `domain-check` while planning
2. `execute-plan` → 2.1 `execute-plan-task` (uses `coding`) · 2.2 `simplify`
   · 2.3 `review` + `code-review` · 2.4 hard blockers → stop and ask guidance
   (otherwise loop back to 2.1)
3. `preflight` + `artifact-check`
4. `final-review`
5. `create-documentation`

## Provenance

- Harness content is extracted from `~/.agents` (read-only source; nothing
  there is modified). See [`docs/EXTRACTION.md`](docs/EXTRACTION.md).
- Alias mapping on copy: `senior-architect` → `software-architect`,
  `senior-engineer` → `software-engineer` (frontmatter `name` only; bodies
  byte-identical).
- Runtime delegation normalization (the plugin registers only the 6 manifest
  agents): `@build`/`@senior-engineer` → `@software-engineer`,
  `@senior-architect`/`@plan` → `@software-architect` — see AGENTS.md table.

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
# Extraction Provenance — Dev Harness V2 Plugin

Documentation of how the opencode-only dev harness was extracted from `~/.agents`
into this repository (Sub-Task 1 of `docs/plans/dev-harness-v2-plugin/plan.md`).
The source `~/.agents` is **read-only** — nothing there was modified.

## Scope revision (user-mandated, 2026-09-27)

The plugin scope is **limited by user mandate** to exactly **6 agents** and
**12 skills** (11 existing + the NEW `dh-coding` skill created later in ST3).
**No commands, no prompts, no other agents/skills, no multi-CLI variants**.

The initial extraction in ST1 copied the **full harness** (14 agents, 37 skill
dirs + index.md, 11 commands, 9 prompts). Per the user's scope decision that
full extraction was **pruned** to the scoped manifest: the repo tree was
re-extracted with `scripts/extract.mjs` (which now enforces the include lists
in `scripts/manifest.json`), `commands/` and `prompts/` were removed from the
repo (they remain available in `~/.agents`), and both `--check` and the audit
were re-run against the scoped set (6 agents, 11 skill dirs + index.md).
This file documents the scoped state only.

## Source and destination

| Content | Source (read-only) | Destination (this repo) |
|---|---|---|
| Agents | `<home>/.agents/agents/` (6 scoped `.md`) | `agents/` |
| Skills | `<home>/.agents/skills/` (11 scoped dirs + `index.md`) | `skills/` |
| Commands | — **out of scope** (kept in `~/.agents` only) | — |
| Prompts | — **out of scope** (kept in `~/.agents` only) | — |

Scoped inventory verified on 2026-09-27: **6 agents, 11 skill dirs +
`skills/index.md`. No `commands/`, no `prompts/` directories in the repo.**

Scoped agents: `senior-architect.md`, `senior-engineer.md` (renamed, see
below), `reviewer.md`, `final-reviewer.md`, `executor.md`, `explorer.md`.
Scoped skills: `dh-artifact-check`, `dh-simplify`, `dh-domain-check`, `dh-code-review`,
`dh-execute-plan`, `dh-execute-plan-task`, `dh-final-review`, `dh-planning`, `dh-preflight`,
`dh-review`, `dh-create-documentation` — plus the NEW `dh-coding` skill authored in ST3
(`skills/index.md` is the source copy; it is adapted to the 12-skill manifest
in ST7).

> **Count deviation vs earlier plan text:** earlier plan drafts stated "38
> skills" / "39 SKILL.md". The scoped manifest supersedes those numbers: **11
> extracted SKILL.md now, 12 after ST3** (11 + `dh-coding`). `scripts/extract.mjs
> --check` and `scripts/audit.mjs` enforce the scoped inventory.

## Agent alias mapping

Plugin manifest names differ from the source file names, so two agents were
renamed on copy — **frontmatter `name` field only; body byte-identical** to the
source (verified by `--check`).

| Source file | Copied as | Frontmatter `name` |
|---|---|---|
| `agents/senior-architect.md` | `agents/dh-software-architect.md` | `senior-architect` → `dh-software-architect` |
| `agents/senior-engineer.md` | `agents/dh-software-engineer.md` | `senior-engineer` → `dh-software-engineer` |

**Rationale:** the user's plugin manifest calls the primary agents
`dh-software-architect` and `dh-software-engineer` (see plan.md "Primary agent
manifest"), so the bundled files carry those names. The source files keep their
original names in `~/.agents`. The body text of both files may still reference
`senior-architect` / `senior-engineer` internally — those occurrences are
left as-is (only the frontmatter `name` was changed) and are explained by this
mapping.

## Exclusion list

Top-level items in `~/.agents` that were **not** copied — the scoped manifest
(`scripts/manifest.json` `include` lists) is the allowlist; everything else is
excluded:

| Excluded | Why |
|---|---|
| `agents/` — other 8 agents: `build.md`, `evolver.md`, `fryday.md`, `general.md`, `jetson-nano.md`, `lil-jarvis.md`, `observer.md`, `plan.md` | Out of scope (user-mandated manifest). |
| `skills/` — other 26 skills (autoskills, backmerge, bug-isolate, comfyui-server, commit-changes, contingency, create-agent, create-skill, create-update-*-plugin, directing-stickman-videos, evolve, fire-service-advisor, image-analysis, ocr, pixel-art-creation, playwright-python, run-antigravity-cli, run-copilot-cli, run-jq, run-notesmd-cli, semver, speak, state-sync, …) | Out of scope (user-mandated manifest). |
| `commands/` (11 `.md`) | **Entirely out of scope** — no commands registered by the plugin; directory removed from the repo. |
| `prompts/` (9 files) | **Entirely out of scope** — directory removed from the repo. |
| `.env` | **Never extract secrets.** |
| `opencode.jsonc`, `agents.config.json`, `opencode copy.jsonc` | Machine-specific configs; `copy.jsonc` is a backup of the live config. |
| `askpass.sh`, `askpass.py`, `install.sh`, `link_agents.sh`, `assemble-agents.sh`, `speak.sh`, `scripts/` | Machine setup/shell scripts — not harness content; the repo has its own `scripts/`. |
| `docs/` (incl. `docs/plans/`) | Source-side plan history/reference; this repo's `docs/plans/` holds *this* plan only. |
| `opencode-plugin/` (V1), `opencode-free-harness/`, `plugins/damm-devit-plugin/` | V1 plugin source and variants — this is a from-scratch V2 build. |
| `agents-copilot/`, `agents-gemini/` | Multi-CLI variants — extraction is opencode-only. |
| `.opencode/` | Local opencode workspace config. |
| `agent-bodies/`, `agent-frontmatter/` | Source-side split tooling output, not standalone content. |

The extractor records every excluded item as `skipped ... [out of scope
(user-mandated manifest)]` on each run, so the pruning is transparent and
reproducible.

## Copy rule (junk exclusion)

Everything inside the scoped directories is copied **except**:

- `*.bak`, `*.bak.*` — backup files (excluded: `code-review/SKILL.md.bak`, `planning/SKILL.md.bak`)
- `node_modules/`, `.git/` — dependency/junk dirs (none present in scoped set)
- `__pycache__/`, `.pytest_cache/` — Python caches (none present in scoped set)
- `*.swp`, `*.swo`, `*~` — editor swap files (none present)
- `.DS_Store` — OS junk (none present)
- `org.SKILL.md` — source-side leftover backup pattern (none present in scoped set)

`references/` subdirectories, skill scripts (`.py`, `.sh`, `.js`), and skill
data files are **part of the skills** and are copied (present in
`create-documentation/references/`). Files are copied byte-identical
(`fs.copyFileSync`); the two renamed agents are the only files whose bytes
differ from source (frontmatter `name` only).

**Symlinks:** none of the 11 scoped skill dirs is a symlink in the source (the
previously-dereferenced `directing-stickman-videos` symlink is out of scope),
so the repo is self-contained with zero symlinks; `--check` verifies this on
every run.

## Secret scan

`grep -rEni 'api[_-]?key|secret|token|password' agents skills`
→ 11 line hits across the scoped set — all low-signature prose (env-var
**names** like `NVIDIA_API_KEY`/`GEMINI_API_KEY`, `max_tokens`-style LLM token
references, "never expose" rules) with **0 high-signature matches**. Every hit
was reviewed — no real credentials. No `.env` content, real keys, or personal
endpoints were copied.

## Re-running the extraction

```bash
node scripts/extract.mjs            # copy scoped manifest from <home>/.agents → agents/ skills/; removes commands/ prompts/ from the repo
node scripts/extract.mjs --check    # verify 6 agents, 11 skill dirs + index.md, no commands/, no prompts/, junk-free, alias body integrity (exit 1 on failure)
AGENTS_HOME=/some/other/root node scripts/extract.mjs   # override source root
```

The script is idempotent: it clears and re-mirrors the two destination
directories from the source and removes any stale `commands/`/`prompts/`
directories, so it can be re-run at any time. `--check` enforces the scoped
manifest from `scripts/manifest.json` (6 agents, 11 skill dirs + `index.md`,
no commands/prompts dirs, zero junk, zero symlinks, and byte-identical alias
bodies).
## Patch: phased plan format + repo-authored skills (2026-09-28)

The bundled `skills/planning` copy is **patched**: it creates **phased plans**
(`## Phases` → `### Phase N` → `#### Sub-Task N.M` with dual status markers)
per the new harness format contract; the canonical template lives in
`skills/planning/references/phased-plan-template.md` and the canonical fixture
in `src/__tests__/fixtures/plans/phased-plan.md`.

**Repo-authored preservation:** the bundled skill set is this repo's
distribution — `scripts/manifest.json` `repoAuthored.skills` lists every
bundled skill dir (incl. `dh-coding`, `dh-planning`, and the loop skills that are
patched in dev-harness-phases-and-tools). `extract.mjs` merge-preserves them:
re-running extraction never wipes these dirs, never overwrites the adapted
`skills/index.md`, and keeps dest-only files such as `planning/references/`.
Source `~/.agents` stays untouched and read-only.

**Patch: permission strip (M3, user mandate):** `scripts/manifest.json`
`patches` carries a declarative `strip-frontmatter-key` entry for `permission`;
`extract.mjs` applies it post-copy to every bundled agent (idempotent — the
same script's `--check` fails if `^permission:` reappears in `agents/`). The
source agent files still carry `permission`; bundled agents register with
`tools`-derived permission rules only.

**Manual removal: `tools` frontmatter (2026-09-28, user edit):** the `tools:`
blocks were removed from all 6 bundled agents directly in the repo (they now
ship with no `tools` and no `permission` — registration carries no static
tool rules). This removal is NOT part of the extraction pipeline: re-running
`node scripts/extract.mjs` restores the source `tools` blocks (the `permission`
strip still applies). Promote to a declarative patch if persistence is wanted.

**Patch: executor command-logging strategy (2026-09-28, user mandate):**
`agents/executor.md` carries a mandatory "Command Execution Strategy": every
command runs with a log file in the SYSTEM TEMP directory, reporting
`head`/`tail` windows + the log path. The directive is (a) edited into the
bundled copy in-repo AND (b) guarded by an `append-body-note` patch entry in
`scripts/manifest.json` (`> Command execution strategy (bundled):`), so a
re-extract re-applies it idempotently. The plugin also registers
`dh_logged_command` which implements the same strategy (see
`src/tools/logged-command.ts`).

## Patch: SDD requirements contract + dh-grill-sdd (2026-09-28, user mandate)

- `./docs/plans/<plan-slug>/task.md` (legacy requirements contract) is
  replaced by `./docs/plans/<plan-slug>/sdd.md` across the bundled loop
  skills and agents (dh-planning, dh-execute-plan, dh-execute-plan-task,
  dh-final-review, dh-review, dh-domain-check, dh-code-review,
  dh-final-reviewer, dh-reviewer).
- NEW bundled skill `dh-grill-sdd`: interviews the user and produces
  `./docs/plans/<plan-slug>/sdd.md` (requirements contract with stable IDs).
  `dh-planning` runs the **SDD gate** (invoke dh-grill-sdd) when the SDD does
  not exist before creating the plan. It is the 13th bundled skill
  (repo-authored; preserved by extraction).

## Patch: dh-setup skill (2026-09-28, user mandate)

NEW 14th bundled skill `dh-setup`: verifies harness prerequisites —
system software (chrome, uv, nvm, osv-scanner, docker, jq, xq, yq, graphify,
optional phpenv), user-level integrations (chrome-devtools-mcp, playwright
MCP, android-remote-control-mcp, opencode-rules >= v2 plugin, graphify),
and project-level quality gates (pre-commit/husky hooks with clear rules +
stack QA tools matrix). Repo-authored (preserved by extraction).

## Patch: dh-code-ruler skill (2026-09-28, user mandate)

NEW 15th bundled skill `dh-code-ruler` (executed by `dh-software-architect`):
grills the user and analyzes the code to generate strict rules at
`{project_root}/CODE_RULES.md` — code style guide, design patterns, security
constraints and checks, performance constraints and checks, stack best
practices (websearch when possible). `dh-coding` now delegates CODE_RULES.md
creation to it when the file is absent. Repo-authored (preserved).

## Patch: all agents repo-authored (2026-09-28, user edit)

ALL bundled agents (dh-executor, dh-explorer, dh-final-reviewer, dh-reviewer,
dh-software-architect, dh-software-engineer, dh-documentor) are now
repo-authored (manifest repoAuthoredAgents): extraction preserves them
verbatim and the alias-body verify skips them. The previous pipeline
append-body-note blocks were hand-edited into normal sections (## Headers +
plain text) by the user; dormant pipeline patch entries remain for
documentation only.

## Patch: dh-documentor agent + doc contract + DuckDB sheet tools (2026-09-28)

- NEW repo-authored agent `dh-documentor` (7th agent): main and ONLY owner
  of generated documentation outside docs/plans (create/update/delete/
  retrieve). Extraction preserves it (manifest repoAuthoredAgents).
- Documentation contract (dh-create-documentation + all skills/agents):
  markdown primary; csv/xml/yaml/json complementary; mermaid for complex
  workflows; ASCII wireframes for UI; obsidian frontmatter mandatory;
  retrieval via notesmd-cli/obsidian; parsing via jq/yq/xq/DuckDB.
- All skills + agents delegate doc work to @dh-documentor (skills carry the
  directive in Doc search; agents via sanitized append-body-note patch).
- NEW plugin tools: dh_read_sheet, dh_update_sheet, dh_sheet_schema
  (DuckDB npm backend; tsup-external; BigInt-normalized JSON output).

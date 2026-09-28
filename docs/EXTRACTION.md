# Extraction Provenance — Dev Harness V2 Plugin

Documentation of how the opencode-only dev harness was extracted from `~/.agents`
into this repository (Sub-Task 1 of `docs/plans/dev-harness-v2-plugin/plan.md`).
The source `~/.agents` is **read-only** — nothing there was modified.

## Scope revision (user-mandated, 2026-09-27)

The plugin scope is **limited by user mandate** to exactly **6 agents** and
**12 skills** (11 existing + the NEW `coding` skill created later in ST3).
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
Scoped skills: `artifact-check`, `simplify`, `domain-check`, `code-review`,
`execute-plan`, `execute-plan-task`, `final-review`, `planning`, `preflight`,
`review`, `create-documentation` — plus the NEW `coding` skill authored in ST3
(`skills/index.md` is the source copy; it is adapted to the 12-skill manifest
in ST7).

> **Count deviation vs earlier plan text:** earlier plan drafts stated "38
> skills" / "39 SKILL.md". The scoped manifest supersedes those numbers: **11
> extracted SKILL.md now, 12 after ST3** (11 + `coding`). `scripts/extract.mjs
> --check` and `scripts/audit.mjs` enforce the scoped inventory.

## Agent alias mapping

Plugin manifest names differ from the source file names, so two agents were
renamed on copy — **frontmatter `name` field only; body byte-identical** to the
source (verified by `--check`).

| Source file | Copied as | Frontmatter `name` |
|---|---|---|
| `agents/senior-architect.md` | `agents/software-architect.md` | `senior-architect` → `software-architect` |
| `agents/senior-engineer.md` | `agents/software-engineer.md` | `senior-engineer` → `software-engineer` |

**Rationale:** the user's plugin manifest calls the primary agents
`software-architect` and `software-engineer` (see plan.md "Primary agent
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
## Patch: phased plan format (2026-09-28)

The bundled `skills/planning` copy is a **patched** version of the source
skill: it now creates **phased plans** (`## Phases` → `### Phase N` →
`#### Sub-Task N.M` with dual status markers) per the new harness format
contract. The canonical template lives in
`skills/planning/references/phased-plan-template.md`; the canonical fixture in
`src/__tests__/fixtures/plans/phased-plan.md`. The source `~/.agents` skill is
untouched — re-extraction re-applies this patch via the pipeline (see
`scripts/manifest.json` PATCHES when implemented).

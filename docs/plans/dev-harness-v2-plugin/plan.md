---
title: Dev Harness V2 Plugin
slug: dev-harness-v2-plugin
description: >-
  Build a brand-new standalone OpenCode V2 plugin in the fresh repo
  dev-harness-skills — extract and audit the scoped dev harness (6 agents,
  12 skills) from ~/.agents, extend it with the new coding skill plus the
  skills-loop workflow, and package it as a V2 plugin (@opencode/plugin,
  Plugin.define) registering agents and skills via domain transforms.
created: 2026-09-27
updated: 2026-09-28
status: Completed
active: false
tags:
  - plan
  - plugin
  - opencode
  - v2
  - harness
  - skills
  - tdd
project: dev-harness-skills
stack:
  - typescript
  - opencode-plugin
  - tsup
  - vitest
  - node
---

# Plan: Dev Harness V2 Plugin

## Objective

Build a **brand-new, standalone OpenCode V2 plugin** in the fresh repo `/home/andres/workspace/dev-harness-skills` (currently an empty git repo). The plugin ships a **strictly scoped manifest** extracted (copied) from the personal dev harness `~/.agents`:

- **Agents (6):** `software-architect`, `software-engineer`, `reviewer`, `final-reviewer`, `executor`, `explorer`
- **Skills (12):** `artifact-check`, `simplify`, `domain-check`, `coding` (NEW — does not exist yet), `code-review`, `execute-plan`, `execute-plan-task`, `final-review`, `planning`, `preflight`, `review`, `create-documentation`
- **Skills-loop workflow** encoding the exact loop below (planning → execute-plan → execute-plan-task/coding → simplify → review+code-review → hard-blocker stop; preflight+artifact-check; final-review; create-documentation)

Everything else in `~/.agents` (other agents, other skills, commands, prompts, v1 plugin, multi-CLI variants) is **out of scope** for this plugin.

The plugin is a **V2 plugin** using `@opencode/plugin` (Promise API, `Plugin.define`) registering the scoped agents and skills via domain transforms (`ctx.agent.transform`, `ctx.skill.transform`).

This is explicitly **NOT a migration** of the existing V1 plugin at `~/.agents/opencode-plugin` (which uses `@opencode-ai/plugin` ^1.0.0 with hooks: askpass, identity, models-cascade, evolve). That V1 plugin stays untouched as a separate thing; the new plugin is built from scratch. It is **opencode-only**.

## Requirements Snapshot

- **R1 — Scoped extraction:** Extract ONLY the scoped manifest from `~/.agents` into this repo: **6 agents** (`software-architect` = rename of `senior-architect`, `software-engineer` = rename of `senior-engineer`, `reviewer`, `final-reviewer`, `executor`, `explorer`) and **11 existing scoped skills** (`artifact-check`, `simplify`, `domain-check`, `code-review`, `execute-plan`, `execute-plan-task`, `final-review`, `planning`, `preflight`, `review`, `create-documentation`), plus `skills/index.md` (adapted later in ST7) and the NEW `coding` skill (ST3). **No commands, no prompts, no other agents, no other skills** are bundled or registered. Machine-specific configs must NOT be copied: `opencode.jsonc`, `agents.config.json`, `.env*` (NEVER extract secrets), `askpass.*`, `opencode copy.jsonc`, `install.sh`, `link_agents.sh`, `assemble-agents.sh`, `speak.sh`, v1 `opencode-plugin/`, `opencode-free-harness/`, `plugins/damm-devit-plugin/`, `agents-copilot/`, `agents-gemini/`, `.opencode/`, `~/.agents/docs/plans/` history.
- **R2 — Audit:** Validate the scoped extracted artifacts: YAML frontmatter parses for every agent and `skills/*/SKILL.md`; skill name regex `^[a-z0-9]+(-[a-z0-9]+)*$`; SKILL.md files under 250 lines, agents under 300 lines (global rule); cross-references resolve (mentions of `@agent` / skill names in skill text point to bundled items); the skills loop's referenced skills/agents all exist after extraction; no secrets (grep for `.env*`, api-key patterns must be clean); no `.bak`/`node_modules` junk copied from skills dirs.
- **R3 — NEW `coding` skill:** Create `skills/coding/SKILL.md` — "TDD coding best practices approach reads project specific from `CODE_RULES.md` at project root". Must enforce test-first workflow, be project-type aware, load and respect `CODE_RULES.md` at project root when present, and reference the global coding guidelines from the harness (`prompts/coding-guideline.md`). It is the skill that `execute-plan-task` delegates to (sub-task 2.1 of the loop).
- **R4 — Skills-loop embedding:** Bundle the documented skills loop into the plugin so agents executing plans use it: 1. `planning` → use `domain-check` while planning; 2. `execute-plan` [2.1 `execute-plan-task` → use `coding`; 2.2 `simplify`; 2.3 `review` + `code-review`; 2.4 IF hard blockers → stop and ask guidance, otherwise keep `execute-plan-task` loop]; 3. `preflight` + `artifact-check`; 4. `final-review`; 5. `create-documentation` (full loop in § Core concepts).
- **R5 — V2 plugin build:** Package at repo root (package name e.g. `dev-harness-skills`, entry `src/plugin.ts`) using `@opencode/plugin` Promise API — `Plugin.define({ id, async setup(ctx) { ... } })`. Setup performs domain transforms to register ONLY the scoped manifest (agents + skills; NO commands). Content provenance must be concrete (asset bundling mechanism, build tool, tsconfig, package.json exports, test setup, load/validation check). Provide a CLI-compatible load path via `"plugins": [...]` in `opencode.jsonc` and a verification step that launches opencode and asserts registered agents/skills.
- **R6 — Validation/verification:** Unit tests pass; the built plugin loads in a real opencode session and all manifest agents (6) and skills (12 incl. `coding`) appear; audit findings resolved.
- **R7 — Documentation:** README + loader guide produced via `create-documentation`, and `skills/index.md` reproduced/adapted for the scoped 12-skill manifest.

**Primary agent manifest for this plugin (guaranteed to register, exactly 6):** `software-architect` (= senior-architect), `software-engineer` (= senior-engineer), `reviewer`, `final-reviewer`, `executor`, `explorer`.

**Primary skill manifest (exactly 12, incl. NEW `coding`):** `artifact-check`, `simplify`, `domain-check`, `coding`, `code-review`, `execute-plan`, `execute-plan-task`, `final-review`, `planning`, `preflight`, `review`, `create-documentation`.

## Scope

- **In scope:** scoped extraction (6 agents + 12 skills, opencode-only) into this repo; full audit of the scoped set; new `coding` skill; skills-loop embedding; V2 plugin build (tsup/vitest, agent+skill transforms); unit tests + load/verification; documentation (README, loader guide, skills index adaptation for 12 skills).
- **Out of scope:** everything outside the user-mandated manifest — the other 8 agents, other 26 skills, all commands (11), all prompts (9), `skills/index.md` beyond the 12-skill adaptation; the V1 plugin at `~/.agents/opencode-plugin` (stays untouched); copilot/gemini client variants; damm-devit-plugin; machine-specific configs/secrets listed in R1; copying `~/.agents/docs/plans/` history; modifying any file under `~/.agents` (read-only source of truth); writing implementation code beyond this plan.

## Assumptions and Constraints

- Repo `/home/andres/workspace/dev-harness-skills` is empty (git initialized, no commits, no files).
- Source of truth is `~/.agents` (read-only). Extraction copies; nothing in `~/.agents` is edited. The repo-level copies may be patched (e.g., loop notes, agent alias renaming) — those changes never propagate back.
- Machine toolchain: Node v24.18.0 via nvm, pnpm 11.9.0 available; `bun` is NOT installed globally and `tsc` is not global. → Recommend **tsup** (esbuild-based bundles) + vitest, run via pnpm. Bun remains an acceptable alternative if installed with corepack (placed in Implementation Suggestions, not a hard requirement).
- OpenCode installed locally (v1.15.7) — assumed V2-compatible for plugin loading. The real-session verification step must confirm plugin loading works; if the installed opencode cannot load V2 plugins, verification falls back to an `@opencode/sdk` embedded integration test (documented in ST6).
- **Scope decision — user-mandated manifest (flagged):** the user explicitly limited the plugin scope to 6 agents (software-architect, software-engineer, reviewer, final-reviewer, executor, explorer) and 12 skills (the 11 existing loop skills + NEW `coding`), wired into the 5-step skills loop. This overrides the earlier draft decision to extract ALL 37 skill dirs / 14 agents. The repo tree is pruned to the scoped set: `agents/` = 6 files, `skills/` = 11 dirs + NEW `coding` (ST3) + adapted `index.md`; NO `commands/`, NO `prompts/` directories in the repo (their content remains available in `~/.agents`). Count facts: **6 agents**, **12 skills** (11 extracted + coding); the earlier audit counts (14/37/11/9) no longer apply.
- **Decision — planning-time domain-check (flagged):** the repo is empty (no code/architecture exists yet), so running `domain-check` now yields no signal. Instead, domain-check is embedded as the loop's first step (sub-task 2 of the loop) and its skill is bundled; ST4's acceptance criteria verify the loop step is present. `contingency` was not run for the same reason; the architecture section below is a single clear approach that follows the create-update-opencode-plugin skill contract.
- Frontmatter in extracted files uses the source format (`name`, `description`, `mode`, `model`, optional `variant`/`tools`/`permission`, plus extended fields like `license`/`compatibility` in skills). Parsing must tolerate multi-line `>` descriptions.

## Risks and Areas Requiring Care

- **Secret leakage:** `.env`, API keys, tokens, personal endpoints could be copied accidentally. Mitigation: ST1 exclusion list + ST2 secret grep gates; never extract `.env*`.
- **Frontmatter edge cases:** multi-line YAML descriptions, trailing `---`, non-ASCII (`á` in senior-architect description), missing fields. Audit parser must be lenient and report field-level errors, not crash.
- **Synchronous transform constraint:** V2 transforms are synchronous — external data must be loaded BEFORE the `transform` callback runs. `setup` is async; load assets first, then call transforms. Getting this wrong produces empty registrations.
- **Asset bundling correctness:** `import.meta.dirname`/`__dirname` resolution differs across ESM/CJS bundlers. Use `import.meta.dirname` (Node ≥20) with tsup `format: ['esm']`, or `?raw`/`?inline` imports; verify in the smoke-load test that assets resolve from `dist/`.
- **Loop references after extraction:** skills/agents referenced by the loop (planning, domain-check, execute-plan, execute-plan-task, coding, simplify, review, code-review, preflight, artifact-check, final-review, create-documentation, and agents software-architect/software-engineer/reviewer/final-reviewer/executor/explorer) must all exist in the bundled set — ST2 cross-reference check enforces this.
- **Agent alias ambiguity:** source files are `senior-architect.md`/`senior-engineer.md`; the plugin manifest names are `software-architect`/`software-engineer`. Decide the mapping in ST1 (file rename + frontmatter `name`) and document it in README/AGENTS.md so registered names are unambiguous.
- **Size-limit violations:** any SKILL.md > 250 lines or agent > 300 lines gets flagged; do not silently truncate source content — record the deviation in the audit report and, if needed, split the bundled copy only (never the source).
- **Junk copy:** skills dirs contain `.bak` files and possibly `references/` subdirs and scripts; define the copy rule (all files except junk patterns; keep `references/` and scripts, they are part of the skill).
- **V2 compat assumption:** if the local opencode version cannot load V2 plugins, the verification step degrades to an SDK-based integration test (ST6).

## Core concepts

**V2 plugin contract (Promise API).** A plugin is `Plugin.define({ id, async setup(ctx) { ... } })`. `setup` may return a cleanup function. Registrations happen through **synchronous domain transforms**; each domain editor exposes essentials:

| Domain | Editor essentials | Reload |
|---|---|---|
| agent | `list/get/update/remove/default(id)` | `ctx.agent.reload()` |
| skill | `add/update/remove` | `ctx.skill.reload()` |
| command | `add({ name, description?, execute })` | `ctx.command.reload()` |

Transforms are applied in registration order and may read earlier registrations. External data (markdown assets) must be loaded before the callback. Minimal shape:

```ts
import { Plugin } from "@opencode/plugin"

export default Plugin.define({
  id: "dev-harness-skills",
  async setup(ctx) {
    // 1. Load ALL assets BEFORE any transform (async fs reads)
    const { agents, skills, commands } = await loadHarnessAssets() // from dist/assets/*

    // 2. Synchronous transforms
    await ctx.agent.transform((editor) => {
      for (const a of agents) editor.update(a.name, {
        description: a.description,
        mode: a.mode,
        model: a.model,
        tools: a.tools,
        prompt: a.body, // markdown body from frontmatter-stripped file
      })
    })
    await ctx.skill.transform((editor) => {
      for (const s of skills) editor.add({ name: s.name, description: s.description, content: s.body })
    })
    await ctx.command.transform((editor) => {
      for (const c of commands) editor.add({ name: c.name, description: c.description, execute: () => c.body })
    })
  },
})
```

**Loading the plugin:** local directory plugins in `.opencode/plugins/` load automatically; for a repo-root package use `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["file:///home/andres/workspace/dev-harness-skills/dist/plugin.js"]
}
```

**Content provenance:** the repo keeps the harness as plain markdown under `agents/`, `skills/`, `commands/`, `prompts/` (single source of truth for audit + runtime). The build copies them into `dist/assets/` via `scripts/copy-assets.mjs`; `plugin.ts` reads and parses them at setup. This keeps data out of the bundle and makes the audit scripting trivial.

**The skills loop (to embed):**

1. `planning` → use `domain-check` while planning
2. `execute-plan`
   2.1 `execute-plan-task` → use `coding`
   2.2 `simplify`
   2.3 `review` + `code-review`
   2.4 IF hard blockers → stop and ask guidance; otherwise keep `execute-plan-task` loop
3. `preflight` + `artifact-check`
4. `final-review`
5. `create-documentation`

## Sub-Tasks

### Sub-Task 1: Scaffold repo and extract scoped harness content (R1)

> **Scope revision (user-mandated):** the manifest is limited to 6 agents + 12 skills (11 existing + NEW `coding` in ST3); NO commands, NO prompts, NO other agents/skills. The initial full extraction was pruned during review; this sub-task's final state reflects the scoped set: `agents/` = 6 files, `skills/` = 11 dirs + `index.md` (coding added in ST3), no `commands/`, no `prompts/`.

- **Status:** Completed
- **Objective:** Turn the empty repo into a structured project and copy the scoped opencode-only manifest from `~/.agents` (6 agents + 11 existing loop skills incl. `skills/index.md`) into version-controlled directories, applying the agent alias decision and the junk/exclusion rules.
- **Related Requirements:** R1 (extraction, exclusions); supports R2/R4/R5.
- **Dependencies and Preconditions:** None (first sub-task). Repo exists, `~/.agents` read access verified.
- **In Scope for This Sub-Task:**
  - Create repo structure: `agents/`, `skills/`, `src/`, `scripts/`, `docs/plans/`, `AGENTS.md` placeholder (filled in ST4).
  - Copy the 6 manifest agents → `agents/`: `senior-architect.md` → `software-architect.md` and `senior-engineer.md` → `software-engineer.md` (frontmatter `name` only, body byte-identical) plus `reviewer.md`, `final-reviewer.md`, `executor.md`, `explorer.md` (byte-identical).
  - Copy the 11 existing loop skill directories → `skills/` (SKILL.md + `references/` + scripts; exclude `.bak*`, `node_modules`, `.git`, editor swap files, OS junk): `artifact-check`, `simplify`, `domain-check`, `code-review`, `execute-plan`, `execute-plan-task`, `final-review`, `planning`, `preflight`, `review`, `create-documentation`. Copy `skills/index.md` → `skills/index.md`.
  - NO `commands/` and NO `prompts/` directories (out of scope).
  - Keep provenance: `AGENTS.md` (or `docs/EXTRACTION.md`) documents source paths, alias mapping, and copy rule.
- **Out of Scope for This Sub-Task:** auditing (ST2); creating `coding` skill (ST3); loop text (ST4); plugin build (ST5); modifying anything under `~/.agents`; copying `~/.agents/docs/plans`, machine configs, secrets, askpass/install/link/assemble scripts, `copy.jsonc`, `speak.sh`.
- **Instructions:**
  1. `git init` already done; create the directory skeleton and a `.gitignore` (node_modules, dist, .env*, *.bak).
  2. Copy per the copy rule above using `cp -r` then remove junk, or a small `scripts/extract.sh`/`extract.mjs` that reads a manifest list — prefer a script so it is reproducible and rerunnable.
  3. Apply the two agent renames with frontmatter `name` update only; verify bodies match the source (`diff` or `cmp` after stripping frontmatter).
  4. Write provenance notes (where each directory came from, what was excluded and why).
- **Acceptance Criteria:**
  - `agents/` contains 6 files; `skills/` contains 11 dirs + `index.md`; no `commands/`, no `prompts/`.
  - `software-architect.md`/`software-engineer.md` exist with body identical to `senior-architect.md`/`senior-engineer.md` (frontmatter `name` differs only).
  - No file contains `.env*`, `api_key`, `token`, or personal endpoint strings from `~/.agents` configs.
  - No `.bak`, `node_modules`, or junk files under `agents/`/`skills/`.
- **Cautionary Points (Risks & Edge Cases):** accidental secret copy (use `grep -rEi 'api[_-]?key|secret|token|password'` over copied dirs); junk hidden files; the rename must not alter body text (the `senior-architect` body references its own name internally — acceptable, provenance note explains the alias).
- **Implementation Suggestions:** write `scripts/extract.mjs` using only Node built-ins (`fs`, `path`); keep a `manifest.json`-style list of include/exclude globs so ST2's audit script can reuse it. Verify counts programmatically (`node scripts/extract.mjs --check`).
- **Testing Suggestions:** `node scripts/extract.mjs --check` passes; `find agents skills commands prompts -name '*.bak' -o -name 'node_modules'` empty; `grep -rEi 'api[_-]?key|secret|token|password' agents skills commands prompts` returns only harmless matches (describe/match skill content), reviewed manually.
- **Done When:** directory counts match the verified inventory, no junk/secrets present, alias files correct, provenance documented, and the extraction script is rerunnable.

### Sub-Task 2: Audit extracted artifacts (R2)

- **Status:** Completed
- **Objective:** Programmatically validate the scoped extracted set (6 agents, 11 loop skills + `index.md`) against the audit dimensions: frontmatter parse, name regex, size limits, cross-reference resolution, loop-completeness, secret scan, junk detection. Produce an audit report.
- **Related Requirements:** R2 (audit); gates R4 (loop references exist) and R5 (clean assets).
- **Dependencies and Preconditions:** ST1 complete (content present).
- **In Scope for This Sub-Task:**
  - `scripts/audit.mjs` covering: YAML frontmatter parse for all `.md` under `agents/` and `skills/*/SKILL.md`; skill name regex `^[a-z0-9]+(-[a-z0-9]+)*$`; line limits (SKILL.md < 250, agents < 300); cross-reference check (`@agent` mentions and skill-name mentions resolve to bundled items); loop skill/agent existence (the 12-skill/6-agent manifest below); secret scan; junk scan. NO commands/prompts auditing (not in scope).
  - `docs/plans/dev-harness-v2-plugin/tasks/audit-report.md` (or `reports/audit.md`) with per-file results and any flagged deviations.
  - Fix only mechanical, safe issues in the extracted copies (e.g., trailing whitespace, name regex violations) — record anything content-related as a deviation instead of rewriting content.
- **Out of Scope for This Sub-Task:** writing the `coding` skill (ST3); loop embedding (ST4); plugin build (ST5); changing source content `~/.agents`; auditing non-manifest artifacts.
- **Instructions:**
  1. Build `scripts/audit.mjs` (node). Reuse a tiny frontmatter parser (split on `---`, `yaml.parse` via a small dependency like `yaml` package, or a hand-rolled parser tolerant of multi-line descriptions).
  2. For cross-references: collect the set of bundled agent names and skill names; regex skill text for `@<agent>` and for known skill names; report any mention that does not resolve.
  3. For the loop: assert each loop entry (planning, domain-check, execute-plan, execute-plan-task, coding [expected in ST3], simplify, review, code-review, preflight, artifact-check, final-review, create-documentation) has a SKILL.md in the bundled set, and each of the 6 manifest agents exists (software-architect, software-engineer, reviewer, final-reviewer, executor, explorer).
  4. Emit a machine-readable JSON + human-readable markdown report; exit non-zero on FAIL for secrets/junk/parse errors, warn-only for size deviations.
- **Acceptance Criteria:**
  - Audit script exits 0 with zero FAIL-level findings.
  - 100% of frontmatter parses; all skill names match the regex; no secret/junk matches.
  - All cross-references and loop references resolve (coding expected-pending in ST3, recorded).
  - Size deviations (if any) are documented as deviations with rationale, not silently changed.
- **Cautionary Points (Risks & Edge Cases):** multi-line `>` descriptions break naive parsers; skill text legitimately contains words like "code-review" inside prose (use word-boundary matching and a curated allowlist of false positives); the extracted skills reference agents/skills NOT in the scoped bundle (e.g., `execute-plan` may mention `evolve`/`state-sync`/`semver`/`final-reviewer`/`plan`); treat out-of-bundle mentions as warn-only references-to-external-harness (documented), NOT failures.
- **Implementation Suggestions:** mirror the source inventory counts; use `agrep` for quick greps; keep the audit reusable as the plugin's `npm run audit` so it runs in CI later.
- **Testing Suggestions:** `node scripts/audit.mjs` passes; spot-check 3 random skills and 2 agents parsing; run `node scripts/audit.mjs --json` and inspect the JSON for completeness.
- **Done When:** audit report generated and clean; FAIL findings zero; deviations documented; loop membership confirmed for the 12-skill/6-agent manifest.

### Sub-Task 3: Create the NEW `coding` skill (R3)

- **Status:** Completed
- **Objective:** Author `skills/coding/SKILL.md` — the TDD coding best-practices skill that reads project-specific rules from `CODE_RULES.md` at project root when present, is project-type aware, enforces test-first workflow, and references the harness's global coding guidelines (`prompts/coding-guideline.md`). This is the skill `execute-plan-task` delegates to (loop 2.1).
- **Related Requirements:** R3 (coding skill); R4 (loop 2.1 depends on it).
- **Dependencies and Preconditions:** ST1 (prompts/coding-guideline.md available for reference).
- **In Scope for This Sub-Task:**
  - `skills/coding/SKILL.md` with valid frontmatter (`name: coding`, trigger-optimized `description`, extended fields consistent with sibling skills) and body covering: test-first workflow (write the test first, then implement, then refactor); project-type awareness (software vs non-software, language/toolkit detection — use `package.json`/`pyproject.toml`/`pyproject`/`composer.json` markers, uv/pnpm tooling); reading and respecting `CODE_RULES.md` at project root when present (project-specific coding rules override generic defaults for naming, structure, style); referencing the harness's global coding guidelines by convention (the source lives at `~/.agents/prompts/coding-guideline.md` — NOT bundled; the skill states the principle, not the file path as a dependency) and the 300-line file limit and SOLID rules.
  - Ensure ≤ 250 lines (global rule).
- **Out of Scope for This Sub-Task:** writing generic code templates; modifying other skills; the loop wiring itself (ST4).
- **Instructions:**
  1. Use the `create-skill` methodology: interview-driven lean SKILL.md, trigger-optimized description compressing capabilities ("TDD coding best practices; reads CODE_RULES.md at project root").
  2. Align frontmatter with sibling skills (`license: MIT`, `compatibility: opencode`, `metadata.workflow: development`, `allowed-tools`).
  3. Define the behavior contract clearly: if `CODE_RULES.md` exists at project root → load and enforce its rules first; else fall back to global guidelines; always test-first regardless.
- **Acceptance Criteria:**
  - `skills/coding/SKILL.md` exists, parses, name matches regex, ≤ 250 lines.
  - Description explicitly encodes TDD + `CODE_RULES.md` project-root lookup so the skill trigger works.
  - Body references `prompts/coding-guideline.md` and states the test-first + project-type-aware workflow; CODE_RULES.md precedence rule present.
  - Audit (ST2 script) passes on the new file (add it to the loop membership list for code-review/execute-plan-task references).
- **Cautionary Points (Risks & Edge Cases):** do not duplicate content from `prompts/coding-guideline.md` — reference it; keep the skill generic enough for any software project; decide default behavior when `CODE_RULES.md` is absent (fall back to global guidelines, don't invent project rules).
- **Implementation Suggestions:** model the structure after `execute-plan-task`/`review` skills; put a short "CODE_RULES.md resolution order" bullet list; keep the body actionable prose, not a tutorial.
- **Testing Suggestions:** `node scripts/audit.mjs` passes for the new file; verify word-boundary regex `^coding$`; manual review of description against the trigger list.
- **Done When:** the skill file exists, passes audit, and its description/body unambiguously encode TDD, project-type awareness, `CODE_RULES.md` precedence, and the coding-guideline reference.

### Sub-Task 4: Embed the skills loop (R4)

- **Status:** Completed
- **Objective:** Ensure agents executing plans inside the plugin use the documented skills loop. Placement: (a) repo-root `AGENTS.md` carrying the full loop as the harness runtime contract; (b) small "Loop Integration" patches to the bundled copies of `execute-plan` and `execute-plan-task` SKILL.md so the loop survives independent extraction.
- **Related Requirements:** R4 (loop embedding); depends on R3 (coding exists).
- **Dependencies and Preconditions:** ST1 (extracted skills), ST3 (coding skill exists).
- **In Scope for This Sub-Task:**
  - Repo-root `AGENTS.md`: role summary, the loop (1. planning→domain-check; 2. execute-plan [2.1 execute-plan-task→coding; 2.2 simplify; 2.3 review+code-review; 2.4 hard blockers→stop and ask guidance, else back to 2.1]; 3. preflight+artifact-check; 4. final-review; 5. create-documentation), provenance notes (source `~/.agents`, alias mapping, opencode-only), and the plugin registration summary (agents/skills/commands).
  - Patch `skills/execute-plan/SKILL.md` copy: add a "Loop Integration" section listing the loop and the coding delegation (sub-task 2.1 uses `coding`).
  - Patch `skills/execute-plan-task/SKILL.md` copy: add the coding delegation rule (for software work, delegate code implementation through the `coding` skill; domain-check gate before complex implementation) and the hard-blocker rule.
- **Out of Scope for This Sub-Task:** plugin build (ST5); editing `~/.agents` sources; writing other skills' content.
- **Instructions:**
  1. Draft `AGENTS.md`; keep it ≤ 120 lines; make the loop explicit with numbered steps so an executing agent cannot miss 2.4's stop-and-ask behavior.
  2. Apply patch sections to the two skill copies (append a clearly-delimited `## Loop Integration (bundled)` section — do not rewrite the rest).
  3. Cross-check the loop names against ST2's audit membership list.
- **Acceptance Criteria:**
  - `AGENTS.md` exists, contains the full 5-step loop with 2.1–2.4, and provenance notes.
  - Both bundled skills contain the Loop Integration section referencing `coding` (2.1) and the hard-blocker stop rule (2.4).
  - All loop skill/agent names match bundled items (audit passes).
- **Cautionary Points (Risks & Edge Cases):** keep the patches additive so diffs against source `~/.agents` remain reviewable; the loop says "stop and ask guidance" — make clear it halts automation (no silent continuation); avoid duplicating conflicting rules already in execute-plan (e.g., its P0/P1 stop rule) — reconcile wording, don't contradict.
- **Implementation Suggestions:** reuse the exact loop text from this plan's Core concepts; add `@executor` delegation note for validation; keep it readable prose + a compact numbered list.
- **Testing Suggestions:** `node scripts/audit.mjs` still passes; grep `AGENTS.md` and both skills for `coding`, `domain-check`, `simplify`, `preflight`, `artifact-check`, `final-review`, `create-documentation`.
- **Done When:** loop embedded at both levels (AGENTS.md + skill copies), names resolve, hard-blocker behavior explicit.

### Sub-Task 5: Build the V2 plugin package (R5)

- **Status:** Completed
- **Objective:** Create the plugin package at repo root: `package.json` (name `dev-harness-skills`, exports for main/types, `@opencode/plugin` dependency), `tsconfig.json`, tsup build (`src/plugin.ts` → `dist/plugin.js` ESM), `scripts/copy-assets.mjs` (agent+skill assets → `dist/assets/`), and `src/plugin.ts` implementing `Plugin.define` with agent and skill transforms driven by parsed assets. NO command transforms (commands out of scope).
- **Related Requirements:** R5 (build); consumes R1/R2/R4 assets.
- **Dependencies and Preconditions:** ST1–ST4 complete; audit clean; node/pnpm available.
- **In Scope for This Sub-Task:**
  - `package.json`: `name: dev-harness-skills`, `type: module`, `main`/`exports` → `./dist/plugin.js`, `types` → `./dist/plugin.d.ts`, scripts (`build`, `copy-assets`, `audit`, `test`, `typecheck`), devDeps (`typescript`, `tsup`, `vitest`, `yaml`, `@types/node`), dep (`@opencode/plugin`).
  - `tsconfig.json` (strict, ESNext, moduleResolution bundler, outDir dist, declaration).
  - `tsup.config.ts` — entry `src/plugin.ts`, `format: ['esm']`, platform node, external `@opencode/plugin`, outDir `dist`, plus the assets copied by a prebuild `copy-assets` step (add `onSuccess` or run `node scripts/copy-assets.mjs` before/after build).
  - `scripts/copy-assets.mjs` — copies `agents/` and `skills/` into `dist/assets/` (excluding junk), preserves relative layout. NO commands/prompts assets.
  - `src/plugin.ts` — `Plugin.define({ id: "dev-harness-skills", async setup(ctx) { ... } })`: load assets from `dist/assets/**` (resolve via `import.meta.dirname`), parse frontmatter + body; `ctx.agent.transform` registers the 6 manifest agents (frontmatter fields `mode`, `model`, `variant`, `tools`, `permission` → agent record, body → prompt); `ctx.skill.transform` registers the 12 skills from SKILL.md frontmatter (`name` + trigger-optimized `description` + body).
  - A smoke-load script `scripts/smoke-load.mjs` that imports `dist/plugin.js` (or runs the loadedModule check) to verify it exports a valid plugin definition.
- **Out of Scope for This Sub-Task:** writing unit tests (ST6); real-session verification (ST6); docs (ST7); command registration; bun-specific config unless the implementer opts in (assumption says tsup).
- **Instructions:**
  1. `pnpm init` then add deps: `pnpm add @opencode/plugin` and `pnpm add -D typescript tsup vitest yaml @types/node`.
  2. Follow the create-update-opencode-plugin contract: transforms synchronous; load assets before callbacks; use `editor.update`/`add` semantics per domain table above.
  3. Ensure the build output is self-contained (only `@opencode/plugin` externalized) and assets resolve at runtime regardless of CWD (use paths relative to the module, not `process.cwd()`).
  4. Add an `opencode.example.jsonc` documenting the `"plugins"` entry (repo-root or dist path).
- **Acceptance Criteria:**
  - `pnpm build` produces `dist/plugin.js` (ESM) + `dist/assets/**` populated with the scoped audited content (6 agents + 12 skills incl. coding).
  - `pnpm typecheck` passes; `dist/plugin.js` imports without error in smoke-load.
  - `dist/assets` contains exactly the audited scoped file set (agents: 6 files; skills: 12 SKILL.md + index.md).
  - Source `~/.agents` untouched; repo assets remain the single source for the build.
- **Cautionary Points (Risks & Edge Cases):** ESM path resolution (`import.meta.dirname` requires Node ≥20 — fine on Node 24) vs `__dirname`; syncing assets on every build (stale dist hides missing files — clean `dist` before build); `@opencode/plugin` version alignment with the installed opencode; do not bundle `@opencode/plugin` itself (external).
- **Implementation Suggestions:** `tsup` with `clean: true`; run `node scripts/copy-assets.mjs` as the first build step (e.g., npm script `"build": "npm run copy-assets && tsup"`); keep a `loadHarnessAssets()` helper that walks `dist/assets` and returns structured `{agents, skills, commands, prompts}`; unit-testable pure functions: `parseFrontmatter(contents)`, `buildAgentRecord(parsed)`, `buildSkillRecord(parsed)`, `buildCommandRecord(parsed)`.
- **Testing Suggestions:** `pnpm typecheck`, `pnpm build`, `node scripts/smoke-load.mjs`; verify `dist/assets` contact counts with a one-liner (`find dist/assets/skills -name 'SKILL.md' | wc -l` == 12).
- **Done When:** clean build, types pass, assets bundled, smoke-load succeeds, plugin definition exports a valid `Plugin.define` value.

### Sub-Task 6: Unit tests + load/validation checks (R6)

- **Status:** Completed
- **Objective:** Add vitest unit tests for all pure helpers and registration builders; add an integration/load check that lands the plugin into a scratch opencode config and asserts manifest agents/skills appear. This is the verification backbone for the Final Integration & Verification section.
- **Related Requirements:** R6 (validation/verification); R5 (unit under test).
- **Dependencies and Preconditions:** ST5 build output exists.
- **In Scope for This Sub-Task:**
  - `src/__tests__/` vitest suite: frontmatter parser (multi-line descriptions, missing fields, full corpus: every `agents/*.md`, `skills/*/SKILL.md` parses); name regex; record builders map frontmatter correctly; asset loader finds files in fixtures mirroring dist layout.
  - Integration-style test (if feasible): load the built plugin module and, using `@opencode/sdk` (embedded client) or a minimal harness, run `setup(ctx)` against a stub `ctx` recording transform registrations; assert the manifest: 6 agents (software-architect, software-engineer, reviewer, final-reviewer, executor, explorer); 12 skills (the 12 loop skills incl. coding); 0 commands.
  - Real-session verification procedure documented (see Final Integration & Verification), executed manually in this sub-task: add `"plugins": ["file:///.../dist/plugin.js"]` to a scratch `opencode.jsonc`, launch `opencode`, and list agents/skills.
- **Out of Scope for This Sub-Task:** full CLI automation of the TUI; documentation (ST7); modifying `~/.agents`; command registration assertions (commands are out of scope).
- **Instructions:**
  1. Write tests first (TDD): parser → builders → asset loader → transform registration.
  2. For the registration test, build a `createStubContext()` returning transform fns that capture `(domain, editorCallbacks)` and an editor stub implementing `update/add` lists; run `setup` with the real asset path; assert the captured registrations equal the manifest expectations.
  3. Run the manual real-session check with a scratch config; record results (agents list, `/skills`, `/commands` counts) in the verification report.
- **Acceptance Criteria:**
  - `pnpm test` green; coverage for parser+builders ≥ 80% (preferred, not mandatory).
  - Registration test asserts all 6 manifest agents, all 12 skills (incl. coding), and 0 commands are registered.
  - Real-session check (when the local opencode supports V2 plugins) shows the manifest entries; otherwise the SDK-based test substitutes and the limitation is documented.
- **Cautionary Points (Risks & Edge Cases):** stub context must mirror the transform contract (sync callbacks; external data pre-loaded); TUI-based checks are flaky in CI — keep them manual/optional, not part of `pnpm test`; version skew between `@opencode/plugin` typings and installed opencode can produce type errors — pin the plugin package to match.
- **Implementation Suggestions:** keep pure helpers exported for tests; use `node --test` as a cheap alternative if vitest setup is heavy, but vitest is preferred per assumptions; document `pnpm test`, `pnpm run audit`, `pnpm build` as the three gate commands.
- **Testing Suggestions:** `pnpm test`, `pnpm run audit`, `pnpm build && node scripts/smoke-load.mjs`, then the manual opencode session check.
- **Done When:** suite green, manifest assertions pass, real-session (or SDK) verification recorded, gates documented.

### Sub-Task 7: Documentation: README + loader guide + skills index (R7)

- **Status:** Completed
- **Objective:** Produce project documentation via the `create-documentation` methodology: `README.md` (what the plugin is, provenance, manifest, how to build/test/install), a loader guide (how to enable in `opencode.jsonc`, troubleshooting), and an adapted `skills/index.md` for the 12-skill manifest (mermaid loop graph).
- **Related Requirements:** R7 (documentation); references R1/R4/R5 facts.
- **Dependencies and Preconditions:** ST5/ST6 complete (names, counts, load path known).
- **In Scope for This Sub-Task:**
  - `README.md`: overview, provenance (source `~/.agents`, opencode-only, alias mapping), plugin manifest (6 agents, 12 skills with coding callout, no commands), build/test/install commands, `docs/plans/` pointer.
  - Loader guide (e.g., `docs/LOADING.md` or README section): `opencode.jsonc` plugins entry (repo-root package or `file://` dist path), options, verification steps, troubleshooting (empty registrations → check dist/assets, version skew).
  - `skills/index.md`: adapt for the bundled 12 skills (add `coding`, keep the mermaid graph updated to include the coding node and the 2.1 edge).
- **Out of Scope for This Sub-Task:** upstreaming docs to `~/.agents`; writing user manuals beyond README/loading; API reference for `src/` internals beyond a short module map.
- **Instructions:**
  1. Use `create-documentation` skill for structure (single-file README + optional docs/ set; mermaid diagrams).
  2. Derive all counts from the actual audited set (ST2 report) — no invented numbers.
  3. Include a "From this repo" flowchart image or mermaid reproducing the skills loop from ST4.
- **Acceptance Criteria:**
  - `README.md` documents provenance, manifest (6 agents / 12 skills), quickstart (build, test, load), and troubleshooting.
  - Loader guide shows the exact `"plugins"` entry and a verification checklist (agents list, skills list).
  - `skills/index.md` is adapted and accurate (12 skills; `coding` present; loop graph includes coding + 2.4 stop-and-ask edge).
  - All doc claims match reality (spot-check counts and file names).
- **Cautionary Points (Risks & Edge Cases):** stale counts after later edits (regenerate from audit output); mermaid syntax errors break rendering (validate locally); keep secrets out of examples.
- **Implementation Suggestions:** generate counts from the audit JSON (`node scripts/audit.mjs --json` → numbers into README); store the loop as a mermaid snippet in both AGENTS.md and skills/index.md.
- **Testing Suggestions:** re-run `pnpm run audit`; open README and skills/index.md in a markdown preview; check the mermaid graph renders.
- **Done When:** README, loader guide, and skills index exist, accurate, and cross-checked against the audit report and build outputs.

## Final Integration & Verification

End-to-end validation that the built plugin behaves as a real OpenCode V2 plugin in a live session:

1. **Gate commands:** `pnpm typecheck && pnpm run audit && pnpm test && pnpm build && node scripts/smoke-load.mjs` all pass.
2. **Real-session load:** in a scratch directory, create `opencode.jsonc` containing `"plugins": ["file:///home/andres/workspace/dev-harness-skills/dist/plugin.js"]`, launch `opencode`, and verify:
   - **Agents:** exactly `software-architect`, `software-engineer`, `reviewer`, `final-reviewer`, `executor`, `explorer` appear.
   - **Skills:** all 12 skills appear, including `coding`; loading `execute-plan` shows the Loop Integration section.
   - **Commands:** none registered (out of scope).
3. **Loop sanity:** with the plugin loaded, verify `coding` is discoverable from `execute-plan-task`'s text (2.1) and the hard-blocker stop rule (2.4) is present in `execute-plan`/`AGENTS.md`.
4. **Degradation path:** if the installed opencode cannot load V2 plugins, run the SDK-based registration test (ST6) and document the limitation in README troubleshooting; the plugin contract itself remains valid per the create-update-opencode-plugin skill.
5. **Record results:** append the observed agent/skill/command lists to the ST6 verification report; resolve any gaps before marking the plan Complete (update `docs/plans/index.md` status to Completed + set active No at that point, per execute-plan conventions).
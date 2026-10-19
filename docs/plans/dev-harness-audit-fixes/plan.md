---
title: Dev Harness Audit Fixes (points 1, 2, 3, 4, 7)
slug: dev-harness-audit-fixes
description: >
  Close the 2026-10-11 audit gaps: bundled dh-semver skill (global semver
  adapted), dot-namespace tool references, truthful counts and checklists
  (7 agents + 17 skills), @opencode/plugin version consistency, and the
  stale scripts/audit.mjs comment.
created: 2026-10-18
updated: 2026-10-19
status: Completed
active: false
tags: [plan]
project: dev-harness-skills
---

# Plan: Dev Harness Audit Fixes (points 1, 2, 3, 4, 7)

## Objective

Eliminate the five audit gaps selected by the requester from the 2026-10-11
audit, keeping the harness corpus, tests, and documentation mutually
consistent:

1. Dangling `dh-semver` reference → ship a bundled `dh-semver` skill adapted
   from the global `semver` skill.
2. Tool-name mismatch (40 underscore refs) → normalize docs/skills/agents to
   the registered dot namespace (`dh.plan_read`, …).
3. Stale counts/checklists → `7 agents + 17 skills` everywhere, complete
   LOADING verification checklist.
4. `@opencode/plugin` version contradiction in `docs/LOADING.md` → `^2.0.20`.
5. Stale `scripts/audit.mjs` header comment → real output paths
   (`reports/audit.md`).

The work is docs/skill/count-contract only — no plugin runtime behavior
changes. See [`sdd.md`](sdd.md) for the implementation-agnostic requirements
contract.

## Requirements Snapshot

- **R1:** Bundle a `dh-semver` skill (global `semver` adapted to the harness);
  every bundled reference that points to the versioning *skill* points to
  `dh-semver`; the `AGENTS.md` "(see dh-semver guidance)" reference resolves.
- **R2:** All tool references in `README.md`, `AGENTS.md`, `docs/LOADING.md`,
  `skills/`, `agents/` use registered dot names (`dh.plan_read`,
  `dh.plan_update_status`, `dh.plan_create`, `dh.logged_command`,
  `dh.read_sheet`, `dh.update_sheet`, `dh.sheet_schema`); zero underscore
  aliases remain.
- **R3:** Skill/agent counts read `7 agents + 17 skills` in the active
  surface; the LOADING checklist enumerates all 7 agents (`dh-` prefixed)
  and all 17 skills (including `dh-contingency`, `dh-semver`).
- **R4:** `docs/LOADING.md` version statements are consistent at
  `@opencode/plugin@^2.0.20` (historical v2.0.18 limitation notes stay).
- **R5:** `scripts/audit.mjs` header comment names its real outputs
  (`reports/audit.md`, `reports/audit.json`).

Acceptance criteria **AC1–AC5** are defined in [`sdd.md`](sdd.md) and
repeated per relevant sub-task.

## Scope

- **In scope:** the five fix areas; count/test contracts forced by the new
  skill (`scripts/lib/shared.mjs` loop list, `assets.test.ts`,
  `frontmatter.test.ts`, `registration.test.ts`, `src/plugin.ts` comment);
  regenerated `reports/audit.md` + `reports/audit.json`;
  `docs/plans/index.md` row for this plan.
- **Out of scope:** audit points 5 (stale config assets:
  `scripts/link-dh-global.sh`, `opencode.example.jsonc`, `demo-project/*`)
  and 6 ("Bundled scope" note); `demo-project/` counts and underscore refs;
  runtime tool aliasing (R2 is a docs fix only); plugin behavior changes.

## Assumptions and Constraints

- **Decision (from the SDD):** R2 is fixed by normalizing docs to the
  registered names; no underscore aliases are added to the plugin.
- Adding one skill moves the corpus from 16 → 17 skills: **all** count
  contracts (tests, loop list, docs) must move in the same change set or
  `pnpm test` / `pnpm run audit` fail.
- `registration.test.ts` runs against the **built** `dist/plugin.js`:
  run `pnpm build` (which runs `copy-assets`) before the test suite after
  the corpus change. `assets.test.ts` and `frontmatter.test.ts` read the
  **source** tree.
- Bundled skill conventions: frontmatter with `name` + `description`
  (`license: MIT`, `compatibility: opencode`, `allowed-tools`, `metadata`
  mirroring the corpus style); SKILL.md < 250 lines; `dh-<kebab>` name
  regex; no `permission` key on agents (handled by the audit).
- Repo QA gate: `pnpm run audit` (not `pnpm audit`),
  `node scripts/check-links.mjs`, `pnpm test`, `pnpm build`; Git Flow branch
  off `develop` (suggested `bugfix/audit-fixes`).
- **Amendment 2026-10-19 (user-approved, Plan A):** Sub-Task 5.1 additionally
  applies the pre-existing `source-map-js` OSV fix (override + lockfile
  refresh) discovered during validation — required for `scan:deps` to pass.

## Risks and Areas Requiring Care

- **"semver" is overloaded:** only rename references that mean the *skill*;
  keep generic prose ("semver version bump: [major/minor/patch]" output
  labels, README/package tooling mentions).
- **Count sites are scattered:** comments, test titles, assertions, docs.
  Use grep-driven checklists; miss one and the gate fails.
- **Global skill references are not harness-valid:** the source skill says
  `/release` (commands are NOT bundled) and `@executor` (harness agent is
  `@dh-executor`). The adaptation must rewire both, or the audit flags an
  unresolved `@mention`.
- **Stale dist:** tests import `dist/plugin.js`; forgetting `pnpm build`
  after adding the skill yields a stale 16-skill registration failure.
- **Archives stay untouched:** `docs/plans/dev-*` and `docs/evolve/` are
  historical records — do not "fix" their counts or tool names.

## Core concepts

**Tool identity:** the plugin registers namespace `dh` with tool names
`plan_read`, `plan_update_status`, `plan_create`, `logged_command`,
`read_sheet`, `update_sheet`, `sheet_schema`. The host exposes the combined
IDs as `dh.plan_read`, `dh.logged_command`, `dh.read_sheet`, … — docs must
use those IDs. Underscore spellings (`dh_plan_read`) resolve to nothing.

```md
<!-- correct --> `dh.plan_read` parses phased plans into structured JSON.
<!-- wrong   --> `dh_plan_read` parses phased plans into structured JSON.
```

**dh-semver adaptation:** same algorithm as the global `semver` skill (last
tag → commits since tag → conventional-commit bump mapping → grouped
changelog → local tag, never pushed without confirmation), re-localized for
the harness: git commands run via `@dh-executor`; invocation sources are
`dh-execute-plan` (after plan completion, software projects),
`dh-final-review` (release readiness), and direct user requests; no
`/release` command dependency; bundled frontmatter conventions.

## Phases

### Phase 1: Bundled dh-semver skill (R1)

- **Status:** Completed

#### Sub-Task 1.1: Author skills/dh-semver/SKILL.md (global semver adapted to the harness)

- **Status:** Completed
- **Objective:** Create `skills/dh-semver/SKILL.md` as the harness-localized adaptation of `~/.agents/skills/semver/SKILL.md` (70 lines) so the harness is self-contained for versioning.
- **Related Requirements:** R1 · AC1
- **Dependencies and Preconditions:** None (new file). Must land together with 1.2 (count contracts) to keep the suite green.
- **In Scope for This Sub-Task:** The new `skills/dh-semver/SKILL.md` only.
- **Out of Scope for This Sub-Task:** Count/test updates (1.2); reference updates (1.3); any other skill or doc.
- **Instructions:**
  - Frontmatter: `name: dh-semver` + a trigger-rich `description` (Semantic Versioning; analyze commits since the last tag; bump type major/minor/patch from conventional commit prefixes; changelog grouped into breaking/features/fixes/chores; create a local tag, never push until confirmed; invoked by `dh-execute-plan` after plan completion and `dh-final-review` for release readiness, or when the user asks "what version is next?", "bump version", "generate changelog", "tag release", "what changed since last release?").
  - Keep the corpus convention: `license: MIT`, `compatibility: opencode`, `allowed-tools: bash, read`, `metadata` (audience/workflow) — mirroring the global skill and bundled examples (`dh-simplify`, `dh-coding`).
  - Body — adapt, don't copy verbatim:
    - Core algorithm: last tag via `git describe --tags --abbrev=0` (default `v0.0.0`); `git log <tag>..HEAD --oneline`; conventional-commit mapping (`BREAKING CHANGE:`/`!:` → MAJOR, `feat:` → MINOR, `fix:`/`chore:`/`docs:`/`style:`/`refactor:`/`perf:`/`test:`/`ci:`/`build:` → PATCH); no conventional format → ask the user; no commits since tag → "no bump needed"; no tags → treat all commits from `v0.0.0`.
    - Changelog groups: Breaking Changes / Features / Fixes / Chores & Maintenance with short hashes.
    - Replacement: use the **`@dh-executor`** subagent for all git commands (NOT `@executor`).
    - Replacement: remove all `/release` command references — state the harness invocation sources instead (`dh-execute-plan`, `dh-final-review`, user request).
    - Keep the "Version Decision" + "Changelog" output template; keep the Safety rules (no push without confirmation, never delete/modify tags).
  - Target < 250 lines (audit warn threshold).
- **Acceptance Criteria:** File exists; frontmatter parses (`name`, `description`); body contains the algorithm, output template, and safety sections with `@dh-executor` and no `/release`; under 250 lines.
- **Cautionary Points (Risks & Edge Cases):** Do not import references that don't exist in the bundle; do not mention `/release` (commands are out of scope); do not leave `@executor` (audit flags unresolved mentions); keep the algorithm output deterministic; no secrets.
- **Implementation Suggestions:** Start from `~/.agents/skills/semver/SKILL.md`; rewrite header comment to identify it as the harness adaptation; keep sentences short and instructional.
- **Testing Suggestions:** `wc -l skills/dh-semver/SKILL.md` (< 250); `node scripts/audit.mjs` after 1.2 lands (name regex, loop membership).
- **Done When:** `skills/dh-semver/SKILL.md` exists with valid, harness-adapted content.

#### Sub-Task 1.2: Wire count/test contracts for the new skill

- **Status:** Completed
- **Objective:** Move every corpus count contract from 16 → 17 skills (7 agents unchanged; 23 → 24 bundled names) so the test suite and audit reflect the new bundle.
- **Related Requirements:** R1 · R3 · AC1 · AC3
- **Dependencies and Preconditions:** 1.1 (skill file) exists.
- **In Scope for This Sub-Task:**
  - `scripts/lib/shared.mjs`: add `'dh-semver'` to `LOOP.skills` (alphabetical: between `'dh-review'` and `'dh-setup'`).
  - `src/__tests__/registration.test.ts`: header comment, test title `…7 bundled agents and 16 skills…` → 17, and `expect(skills).toHaveLength(16)` → `17` (line ~123).
  - `src/__tests__/assets.test.ts`: header comment `(7 agents, 16 skills)`, `expect(assets.skills).toHaveLength(16)` → 17, and `expect(new Set(names).size).toBe(23)` → `24` (line ~77).
  - `src/__tests__/frontmatter.test.ts`: test title `(7 agents + 16 skills)`, `SKILL_FILES).toHaveLength(16)` → 17, `expect(new Set(names)).toHaveLength(23)` → `24` (lines ~40–62).
  - `src/plugin.ts`: header comment `(7 agents, 16 skills)` → 17.
- **Out of Scope for This Sub-Task:** Docs counts (Phase 3); `dist/` (regenerated by `pnpm build`); demo-project.
- **Instructions:** Grep the surface first — `rg -n "16|23" src/__tests__ scripts/lib/shared.mjs src/plugin.ts` — and update every site that encodes the corpus size (comments included, so they stay truthful). Do not change unrelated numeric literals.
- **Acceptance Criteria:** `rg -n "7 agents(,| and) 16|16 skills|toHaveLength\\(16\\)|toBe\\(23\\)" src scripts` returns no stale corpus-size references.
- **Cautionary Points (Risks & Edge Cases):** `registration.test.ts` reads the built bundle — rebuild before running it; `assets`/`frontmatter` tests read the source tree. `frontmatter.test.ts` may enumerate `SKILL_FILES` dynamically — update the expectation, not the collection logic.
- **Implementation Suggestions:** Keep edits mechanical; one commit-sized change.
- **Testing Suggestions:** `pnpm build && pnpm vitest run src/__tests__/assets.test.ts src/__tests__/frontmatter.test.ts src/__tests__/registration.test.ts` → all green.
- **Done When:** Focused tests pass with 17 skills / 24 names; loop list contains `dh-semver`.

#### Sub-Task 1.3: Point bundled skill/agent references at dh-semver

- **Status:** Completed
- **Objective:** Replace references that invoke or point to the versioning *skill* with `dh-semver` so the bundled harness is self-contained; sharpen the AGENTS.md pointer.
- **Related Requirements:** R1 · AC1
- **Dependencies and Preconditions:** 1.1 (skill exists so renames resolve).
- **In Scope for This Sub-Task:**
  - `skills/dh-execute-plan/SKILL.md` (~lines 34, 84): "and `semver` for determining the next version bump" → `dh-semver`; "Invoke the `semver` skill" → `dh-semver`.
  - `skills/dh-final-review/SKILL.md` (~lines 27, 78, 126): "recommend a `semver` version bump" → `dh-semver`; "Determine the appropriate `semver` version bump" → `dh-semver`. Keep the report label `- Recommended \`semver\` bump:` if it reads as a generic field — decide by context; if it means the skill, use `dh-semver`.
  - `agents/dh-software-architect.md` (~line 59): "`semver` — ensure versioning is automated in the pipeline" → `dh-semver`.
  - `AGENTS.md` (~line 123): sharpen "(see dh-semver guidance)" → "(see the bundled `dh-semver` skill)".
- **Out of Scope for This Sub-Task:** `skills/index.md` and README skill tables (Phase 3 adds `dh-semver` rows); generic prose "semver" (concept); archives.
- **Instructions:** Grep `rg -n "\`semver\`" skills agents AGENTS.md README.md docs/LOADING.md` and treat each hit by meaning: skill invocation/pointer → `dh-semver`; concept/output label → leave. Do not touch `package.json`/tooling mentions.
- **Acceptance Criteria:** No bundled file invokes a bare `semver` skill; `rg -n "\`semver\`" skills agents` returns only concept/label hits (if any).
- **Cautionary Points (Risks & Edge Cases):** Over-renaming concept prose degrades readability ("semver bump" is the standard term); under-renaming leaves agents chasing an unbundled skill.
- **Implementation Suggestions:** Edit sentence by sentence; keep line lengths reasonable.
- **Testing Suggestions:** `rg` checks above; full suite in Phase 5.
- **Done When:** All skill-pointer references resolve to `dh-semver`; concept prose intact.

### Phase 2: Tool-name normalization to the registered dh namespace (R2)

- **Status:** Completed

#### Sub-Task 2.1: Normalize root docs (README.md, AGENTS.md, docs/LOADING.md)

- **Status:** Completed
- **Objective:** Replace all underscore tool names with the registered dot names in the three root docs.
- **Related Requirements:** R2 · AC2
- **Dependencies and Preconditions:** None.
- **In Scope for This Sub-Task:**
  - `README.md`: features bullets (~lines 10–12: `dh_plan_read`/`dh_plan_update_status`/`dh_plan_create`, `dh_read_sheet`/`dh_update_sheet`/`dh_sheet_schema`, `dh_logged_command`) and "Bundled tools" section (~lines 119–121, same set).
  - `AGENTS.md`: plan-lifecycle tools paragraph (~lines 48–49).
  - `docs/LOADING.md`: tool table (~lines 93–96: all four rows); AND fix the intro sentence (~line 89) "registers three V2 custom tools … for phased plans" to match the 4-row table (e.g. "registers V2 custom tools (codemode) under the `dh` namespace: three plan-lifecycle tools plus the logged-command tool").
- **Out of Scope for This Sub-Task:** `skills/` + `agents/` (2.2); counts (Phase 3); version bullet (Phase 4); historical notes/archives.
- **Instructions:** Replace only the tool identifiers: `dh_plan_read` → `dh.plan_read`, `dh_plan_update_status` → `dh.plan_update_status`, `dh_plan_create` → `dh.plan_create`, `dh_logged_command` → `dh.logged_command`, `dh_read_sheet` → `dh.read_sheet`, `dh_update_sheet` → `dh.update_sheet`, `dh_sheet_schema` → `dh.sheet_schema`. Keep namespace prose ("under the `dh` namespace") intact.
- **Acceptance Criteria:** `rg -n "dh_plan_|dh_logged_command|dh_read_sheet|dh_update_sheet|dh_sheet_schema" README.md AGENTS.md docs/LOADING.md` → 0 matches; dot names present.
- **Cautionary Points (Risks & Edge Cases):** Do not touch `demo-project/docs/index.md` (out of scope); do not rewrite `dh-` skill names (`dh-planning`) — different separator.
- **Implementation Suggestions:** One careful pass per file; run the rg check after each.
- **Testing Suggestions:** The rg check above; `node scripts/check-links.mjs` (no dead refs introduced).
- **Done When:** Zero underscore tool refs in the three docs; LOADING table intro consistent with its rows.

#### Sub-Task 2.2: Normalize skills/ and agents/ tool references

- **Status:** Completed
- **Objective:** Replace underscore tool names with dot names across all bundled skills and agents.
- **Related Requirements:** R2 · AC2
- **Dependencies and Preconditions:** None.
- **In Scope for This Sub-Task:**
  - `skills/index.md` (~lines 8, 70–72).
  - `skills/dh-execute-plan/SKILL.md` (6 refs), `skills/dh-execute-plan-task/SKILL.md` (6), `skills/dh-setup/SKILL.md` (3), `skills/dh-final-review/SKILL.md` (2), `skills/dh-review/SKILL.md` (2), `skills/dh-create-documentation/SKILL.md` (1), `skills/dh-planning/SKILL.md` (1).
  - `agents/dh-documentor.md` (2 refs, `dh_read_sheet`/`dh_update_sheet`/`dh_sheet_schema`), `agents/dh-executor.md` (1 ref, `dh_logged_command`).
- **Out of Scope for This Sub-Task:** Counts/tables (Phase 3); root docs (2.1); archives.
- **Instructions:** Run `rg -n "dh_plan_read|dh_plan_update_status|dh_plan_create|dh_logged_command|dh_read_sheet|dh_update_sheet|dh_sheet_schema" skills agents` and fix every hit with the dot form (same mapping as 2.1). Then re-run to confirm 0.
- **Acceptance Criteria:** The rg above returns 0 matches over `skills/` + `agents/`.
- **Cautionary Points (Risks & Edge Cases):** Some refs sit inside backticks mid-sentence and tables — preserve surrounding prose; `dh-planning`-style skill names are NOT tool refs.
- **Implementation Suggestions:** Per-file edits; verify per file with rg.
- **Testing Suggestions:** rg check; full suite in Phase 5.
- **Done When:** Zero underscore tool refs in `skills/` and `agents/`.

### Phase 3: Counts and verification checklists (R3)

- **Status:** Completed

#### Sub-Task 3.1: README.md counts + dh-semver skill row

- **Status:** Completed
- **Objective:** Make README counts truthful (17 skills) and document the new skill.
- **Related Requirements:** R3 · AC3
- **Dependencies and Preconditions:** 1.1 landed (skill exists to document).
- **In Scope for This Sub-Task:**
  - Line ~27: "7 `dh-*` agents and 15 `dh-*` skills" → 17.
  - Line ~83: "7 `dh-` agents and 15 `dh-` skills" → 17.
  - Lines ~3, ~9, ~125: "16 skills" → 17.
  - Line ~183 (repository layout): "the 16 bundled skills" → 17.
  - Skills table (~lines 141–158): add a `dh-semver` row (e.g. "Analyzes commits since the last tag, determines the version bump, generates a changelog, and creates a local tag — harness adaptation of the global `semver` skill.").
- **Out of Scope for This Sub-Task:** LOADING (3.2); AGENTS.md + skills/index.md (3.3).
- **Instructions:** Grep `rg -n "15|16|23" README.md` and adjust only corpus-count references. Keep wording natural. Table order: append `dh-semver` as the last row.
- **Acceptance Criteria:** README contains no "15 `dh-*` skills"/"16 skills" corpus-count strings; table has 17 skill rows; `rg -n "17"` shows the new counts.
- **Cautionary Points (Risks & Edge Cases):** Don't touch version numbers (`^2.0.20`) or unrelated numerals; keep the table's role descriptions consistent with `skills/index.md`.
- **Implementation Suggestions:** Edit counts first, then insert the row.
- **Testing Suggestions:** Manual count of table rows = 17; rg checks.
- **Done When:** README states 7 agents / 17 skills consistently and lists `dh-semver`.

#### Sub-Task 3.2: docs/LOADING.md counts + complete verification checklists

- **Status:** Completed
- **Objective:** Make LOADING counts truthful and fix the incomplete verification checklist (missing `dh-contingency`, `dh-semver`, `dh-documentor`, missing `dh-` prefixes).
- **Related Requirements:** R3 · AC3
- **Dependencies and Preconditions:** 1.1 landed.
- **In Scope for This Sub-Task:**
  - Line ~107: "exactly 7 agents + 16 skills registered" → 17.
  - Line ~116: "15 `dh-*` skills appear" → 17.
  - Checklist agents line (~77–78): → `dh-software-architect, dh-software-engineer, dh-reviewer, dh-final-reviewer, dh-executor, dh-explorer, dh-documentor` (7, all prefixed).
  - Checklist skills lines (~79–83): → all 17, `dh-` prefixed: `dh-artifact-check, dh-code-review, dh-code-ruler, dh-coding, dh-contingency, dh-create-documentation, dh-domain-check, dh-execute-plan, dh-execute-plan-task, dh-final-review, dh-grill-sdd, dh-planning, dh-preflight, dh-review, dh-semver, dh-setup, dh-simplify`.
- **Out of Scope for This Sub-Task:** Version bullet (Phase 4); README (3.1); AGENTS.md (3.3).
- **Instructions:** Edit counts, then rewrite the two checklist lines as complete, prefixed lists (wrap naturally; keep the `opencode debug …` code block format).
- **Acceptance Criteria:** LOADING counts read 17; checklist enumerates 7 agents + 17 skills, all `dh-` prefixed; no "15" corpus mentions remain.
- **Cautionary Points (Risks & Edge Cases):** Count the adjusted checklist against the real corpus: `ls skills/*/SKILL.md | wc -l` → 17 and `ls agents/*.md | wc -l` → 7.
- **Implementation Suggestions:** Copy the canonical name list from `scripts/lib/shared.mjs` `LOOP` (post-1.2) to avoid typos; `diff` against it.
- **Testing Suggestions:** `diff <(ls skills) <(...)` mental check via `ls`; rg for "15".
- **Done When:** LOADING counts and checklists match the corpus exactly.

#### Sub-Task 3.3: AGENTS.md + skills/index.md counts and lists

- **Status:** Completed
- **Objective:** Update the runtime contract and the skills index to the 17-skill bundle.
- **Related Requirements:** R3 · AC3
- **Dependencies and Preconditions:** 1.1 landed; 1.2 updated the loop list.
- **In Scope for This Sub-Task:**
  - `AGENTS.md`: role summary (~line 12) "**16 skills**" → 17 and append `dh-semver` to the enumeration (~line 14); provenance (~line 70) "7 agents + 16 skills" → 17; registration paragraph (~line 77); verify bullet (~line 89).
  - `skills/index.md`: intro (~line 3) "bundles **16 skills**" → 17; heading (~line 75) "## The 16 bundled skills" → 17; skills table (~lines 77–94) add a `dh-semver` row (e.g. "Release — analyzes commits since the last tag, determines version bump, generates changelog, tags locally (harness adaptation of the global `semver` skill)").
- **Out of Scope for This Sub-Task:** README (3.1); LOADING (3.2); agents list in index.md (already complete).
- **Instructions:** After edits, re-grep the whole active surface: `rg -n "16 skills|16 bundled|7 agents \+ 16|15 \`dh" README.md AGENTS.md docs/LOADING.md skills/index.md` → 0.
- **Acceptance Criteria:** No active-surface file claims 15/16 skills; `dh-semver` listed in AGENTS.md enumeration and index table.
- **Cautionary Points (Risks & Edge Cases):** The AGENTS.md enumeration order is otherwise stable — append only; keep the index table's "Role in the loop" column style.
- **Implementation Suggestions:** Mirror the README row wording for consistency.
- **Testing Suggestions:** The rg check above; run after all Phase 3 edits.
- **Done When:** All count surfaces read 17 and list `dh-semver`.

### Phase 4: Version consistency and stale comment (R4, R5)

- **Status:** Completed

#### Sub-Task 4.1: Fix LOADING.md version-skew bullet

- **Status:** Completed
- **Objective:** Remove the `^2.0.18` / `^2.0.20` contradiction in `docs/LOADING.md` (R4).
- **Related Requirements:** R4 · AC4
- **Dependencies and Preconditions:** None.
- **In Scope for This Sub-Task:** `docs/LOADING.md` "Version skew" bullet (~line 143): "the plugin targets `@opencode/plugin@^2.0.18`" → `^2.0.20`, keeping the rest of the sentence meaningful.
- **Out of Scope for This Sub-Task:** Historical v2.0.18 notes (line ~42 tip, line ~134 "Real-session note (v2.0.18 observation)", `bundle.test.ts` comment) — keep as history. `package.json` (already `^2.0.20`).
- **Instructions:** Edit the one bullet; re-read it for internal grammar. Verify no other live (non-historical) `^2.0.18` claim remains: `rg -n "2\.0\.18" docs/LOADING.md` should show only the historical notes.
- **Acceptance Criteria:** "Version skew" bullet says `^2.0.20`; all other 2.0.18 mentions are clearly historical (limitation observations).
- **Cautionary Points (Risks & Edge Cases):** Don't rewrite history notes — they document a past host observation and remain accurate.
- **Implementation Suggestions:** Minimal one-line edit.
- **Testing Suggestions:** rg check above.
- **Done When:** LOADING states a single live target version (`^2.0.20`).

#### Sub-Task 4.2: Fix scripts/audit.mjs header comment

- **Status:** Completed
- **Objective:** Make the audit script header describe its actual outputs (R5).
- **Related Requirements:** R5 · AC5
- **Dependencies and Preconditions:** None.
- **In Scope for This Sub-Task:** `scripts/audit.mjs` header (~line 10): "writes reports/audit.json + tasks/audit-report.md" → "writes reports/audit.json + reports/audit.md".
- **Out of Scope for This Sub-Task:** Script behavior; `reports/` contents (regenerated in Phase 5).
- **Instructions:** One-line comment edit. Optionally verify the usage block matches `MD_TARGET`/`JSON_TARGET` constants.
- **Acceptance Criteria:** Header comment names `reports/audit.md` and `reports/audit.json`; `node scripts/audit.mjs` still exits 0.
- **Cautionary Points (Risks & Edge Cases):** Comment-only change — do not alter code paths.
- **Implementation Suggestions:** Keep the existing style of the usage block.
- **Testing Suggestions:** `node scripts/audit.mjs` → PASS (0 fails).
- **Done When:** Comment matches real outputs; audit still passes.

### Phase 5: Verification and closeout (AC1–AC5)

- **Status:** Completed

#### Sub-Task 5.1: Build + full gate validation (tests, audit, check-links, rg checks)

- **Status:** Completed
- **Objective:** Prove all five fix areas with the repo's gates and targeted greps, and regenerate the audit reports.
- **Related Requirements:** AC1–AC5
- **Dependencies and Preconditions:** Phases 1–4 complete.
- **In Scope for This Sub-Task:** Build + validation runs; regenerated `reports/audit.md` + `reports/audit.json` (tracked files — expect them modified); **PRE-STEP (added 2026-10-19, user-approved Plan A extension):** the `source-map-js` security override + lockfile refresh required to unblock `scan:deps`.
- **Out of Scope for This Sub-Task:** Fixing failures beyond scope — a failure here means re-opening the responsible sub-task first (blocker protocol).
- **Instructions:**
  0. **Dependency fix (added 2026-10-19, user-approved):** add `"source-map-js@<1.2.2": "^1.2.2"` to the `overrides:` block in `pnpm-workspace.yaml` (mirrors commit `e00711e`), run `pnpm install` to refresh `pnpm-lock.yaml`, and confirm `pnpm why source-map-js` resolves to ≥ 1.2.2. This clears OSV `GHSA-68fv-2mgg-jv7q` (High; dev-only transitive via postcss ← tsup/vitest), which halts the full gate at `scan:deps`.
  1. `pnpm build` — confirm `[copy-assets] agents 7 | skills 17 SKILL.md + index.md yes`.
  2. `pnpm test` — all suites green (registration asserts 17).
  3. `node scripts/audit.mjs` — PASS, 0 fail findings; loop membership `17/17 skills present; 7/7 agents present`.
  4. `node scripts/check-links.mjs` — 0 dead refs.
  5. Targeted greps:
     - `rg -n "dh_plan_|dh_logged_command|dh_read_sheet|dh_update_sheet|dh_sheet_schema" README.md AGENTS.md docs/LOADING.md skills agents` → 0.
     - `rg -n "15 \`dh|16 skills|16 bundled" README.md AGENTS.md docs/LOADING.md skills/index.md` → 0.
     - `rg -n "dh-semver" AGENTS.md README.md docs/LOADING.md skills/index.md skills/dh-semver/SKILL.md` → present in all.
  6. If Docker is available: `pnpm qa:check:full` or at least `pnpm qa:check`; otherwise document the skip (docker scans unchanged by this work).
- **Acceptance Criteria:** All gates pass **including `scan:deps` with 0 findings after the override**; greps return the expected results; reports regenerated.
- **Cautionary Points (Risks & Edge Cases):** `pnpm audit` is the wrong command (security audit) — use `pnpm run audit`. Rebuild before tests whenever the corpus changes. Audit warns (e.g. kebab prose tokens) are acceptable; fail findings are not. Lockfile churn from `pnpm install` is expected (cf. `e00711e`); inspect `git diff pnpm-lock.yaml` to confirm no unintended upgrades beyond `source-map-js`.
- **Implementation Suggestions:** Run in the order above; capture exact outputs for the review.
- **Testing Suggestions:** The commands are the tests.
- **Done When:** Gate outputs recorded; AC1–AC5 evidenced.

#### Sub-Task 5.2: Documentation completeness pass (dh-create-documentation)

- **Status:** Completed
- **Objective:** Confirm the new public interface (`dh-semver`) and all counts are fully documented across the repo's documentation surfaces, per `dh-create-documentation` guidance.
- **Related Requirements:** R1 · R3 · AC1 · AC3
- **Dependencies and Preconditions:** 5.1 green.
- **In Scope for This Sub-Task:** Verification (and any last gap fixes) across `README.md`, `AGENTS.md`, `docs/LOADING.md`, `skills/index.md`. In this repo the documentation surface IS the corpus, so no separate doc generation is needed — this pass proves completeness.
- **Out of Scope for This Sub-Task:** Generated docs under `docs/` outside the four surfaces; archives.
- **Instructions:** Walk each surface and confirm: `dh-semver` described (README + index tables; AGENTS enumeration; LOADING checklist), counts read 17, tool refs are dot-named, no stale "15". Fix any small gaps found (same style). Delegate to `@dh-documentor` only if a non-plan documentation artifact must change.
- **Acceptance Criteria:** All four surfaces describe `dh-semver` and the 17-skill corpus coherently.
- **Cautionary Points (Risks & Edge Cases):** Don't drift into point 5/6 territory (config assets, bundled-scope note) — record as follow-ups instead.
- **Implementation Suggestions:** Use a simple checklist per surface.
- **Testing Suggestions:** The 5.1 greps re-run clean.
- **Done When:** Documentation surfaces verified complete; gaps (if any) fixed and validated.

#### Sub-Task 5.3: Closeout: docs/plans/index.md row, plan statuses, follow-ups

- **Status:** Completed
- **Objective:** Close the plan properly and leave the deferred items recorded.
- **Related Requirements:** AC1–AC5 (process)
- **Dependencies and Preconditions:** 5.1 + 5.2 complete.
- **In Scope for This Sub-Task:** Add/update the `docs/plans/index.md` row for this plan (title, slug, description, created/updated dates, status); set all plan/phase/sub-task statuses to `Completed` (via `dh.plan_update_status` when available); record follow-ups in the plan's Open Questions if not already noted.
- **Out of Scope for This Sub-Task:** Starting follow-up work (points 5/6, demo-project).
- **Instructions:** Index row format (7 columns): `| Dev Harness Audit Fixes | dev-harness-audit-fixes | Close 2026-10-11 audit gaps (points 1,2,3,4,7): bundled dh-semver, dot tool refs, 7 agents + 17 skills counts, version consistency, audit comment | 2026-10-18 | <completion date> | Completed | No |`. Update plan frontmatter `updated` + `status: Completed` via the plan tools.
- **Acceptance Criteria:** Index row present and accurate; plan fully `Completed`; follow-ups recorded.
- **Cautionary Points (Risks & Edge Cases):** Do not mark the plan complete around any open failure (blocker protocol).
- **Implementation Suggestions:** Use `dh.plan_update_status` for status flips; manual edit only for the index row if the tool's `updateIndex` format doesn't fit.
- **Testing Suggestions:** `diff` index row against conventions of prior rows.
- **Done When:** Index + statuses updated; follow-ups listed.

## Final Integration & Verification

- **System-Wide Test:** Fresh-clone semantics — `pnpm install && pnpm build && pnpm test && pnpm run audit && node scripts/check-links.mjs` all pass; the LOADING verification checklist matches the real corpus (7 agents + 17 skills, all `dh-` prefixed); `rg` checks for underscore tool refs and "15 skills" return 0; audit loop membership `17/17`.
- **Completion Checklist:** AC1–AC5 evidenced in 5.1; `dh-semver` present in all five count surfaces; reports regenerated; index row added; follow-ups (points 5, 6, demo-project) recorded; no unrelated files touched.

## Open Questions

- **Deferred follow-ups (non-blocking):**
  - Audit point 5 — stale config assets: `scripts/link-dh-global.sh` (orphaned, disproven v2.0.18 rationale), `opencode.example.jsonc` (stale checklist), `demo-project/*` (native agent-map workaround, pinned model).
  - Audit point 6 — "Bundled scope" note in `skills/index.md` naming non-bundled dependencies (`evolve`, `state-sync`, `semver`, commands). Partially mitigated: versioning is now bundled as `dh-semver`.
  - `demo-project/docs/index.md` — counts (16 skills) and underscore tool refs (`dh_read_sheet` on line ~66).
  - Source-code comments — underscore tool names remain in `src/tools/sheet-tools.ts`, `src/tools/logged-command.ts`, and `src/__tests__/sheet-tools.test.ts` header comments (outside R2's documentation scope; cosmetic).
  - Tag lineage on `develop` — released tags `v0.2.x`–`v0.3.1` are unreachable from develop-based branches (`git describe` resolves `v0.1.0`), affecting `dh-semver`'s tag discovery there; preserve tag ancestry on release back-merges (P3 from the final review).

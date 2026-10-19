# Sub-Task Reviews — dev-harness-audit-fixes

Reviews produced by the `dh-review` skill during `dh-execute-plan` orchestration.
Format: one section per sub-task, findings P0–P3 with disposition.

---

## Sub-Task Review: 1.1 — Author skills/dh-semver/SKILL.md (global semver adapted to the harness)

**Reviewed against:** Sub-Task 1.1 (plan.md, Phase 1) · **Overall risk:** Low · **Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| `skills/dh-semver/SKILL.md` exists | PASS | New file, 115 lines (< 250 threshold) |
| Frontmatter parses; `name`/`description` present | PASS | `name: dh-semver`; trigger-rich description with all five required trigger phrases; license/compatibility/allowed-tools/metadata mirror corpus convention; repo frontmatter parser reports 0 errors, name regex OK |
| Body contains algorithm, output template, safety sections | PASS | Algorithm parity with `~/.agents/skills/semver/SKILL.md` (tag discovery, commit range, conventional-commit mapping, edge cases); "Version Decision"/"Changelog" template; safety rules (no push/delete without confirmation) |
| Harness adaptations: `@dh-executor` for git; no `/release`; no non-bundled refs | PASS | `@dh-executor` at lines 23/45/102; zero bare `@executor`; zero `/release`; invocation sources are `dh-execute-plan`/`dh-final-review`/user request |
| Under 250 lines | PASS | 115 lines |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] Medium:** none.
- **[P3] Low — no-tags path ambiguity:** the edge case said to default to `v0.0.0` but `git log v0.0.0..HEAD` cannot run without that ref. **Addressed** — Edge Cases now instruct enumerating all commits with `git log --oneline` (lines 52–54); revalidated (`wc -l` = 115).

### Validation Results

- Tests present: n/a (content artifact; corpus checks in Phase 5).
- Validation commands: `wc -l` (< 250) PASS; frontmatter parse (repo parser) PASS; `grep` for `/release`/`@executor` PASS; `node scripts/audit.mjs` PASS with the file on the surface (frontmatter ok, no findings attributed).
- Edge cases from sub-task: heading/trigger quality, adaptation completeness, length — all handled.

### Regression Risk Assessment

- Breaking changes detected: none — new file only.
- Interface/config changes affecting other components: none yet (loop registration is Sub-Task 1.2; forward references become live in 1.3, as planned).

### Scope Compliance

- In scope: verified — only `skills/dh-semver/SKILL.md` created.
- Out of scope detected: none.

### Suggested Next Steps

- [x] Apply the P3 clarification.
- [ ] Sub-Task 1.2 — register the skill in the loop list + count contracts.

---

## Sub-Task Review: 1.2 — Wire count/test contracts for the new skill

**Reviewed against:** Sub-Task 1.2 (plan.md, Phase 1) · **Overall risk:** Low · **Verdict:** Approve

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| All corpus-size encodings updated to 17 skills / 24 names | PASS | 11 sites across 5 files; `rg` for stale patterns → 0 matches; secret-signature regexes (16/23-looking) correctly untouched |
| Loop list has `dh-semver`, alphabetical, parses | PASS | `shared.mjs:34` between `dh-review` and `dh-setup`; 17 skills / 7 agents; set-diff vs corpus empty; no duplicates |
| No unrelated edits; docs untouched (Phase 3 scope) | PASS | Diff limited to the 5 in-scope files; README/AGENTS/LOADING/skills-index unchanged |

### Findings

- **[P0] Blocking:** none. **[P1] High:** none. **[P2] Medium:** none. **[P3] Low:** none.
- Note: the engineer additionally fixed `assets.test.ts:66` ("loads the 16 bundled skills…") found by a broader sweep — within sub-task intent, no scope concern.

### Validation Results

- Build: `[copy-assets] agents 7 | skills 17 SKILL.md + index.md yes` (exit 0).
- Focused tests: 45/45 pass, including `registers the 7 bundled agents and 17 skills, zero commands`; plugin stdout `registered 7 agents, 17 skills`.
- Typecheck: clean (`tsc --noEmit`). Audit: PASS, loop membership 17/17 skills, 7/7 agents.

### Regression Risk Assessment

- Breaking changes detected: none — mechanical count updates; set-uniqueness and inventory invariants enforced by the updated tests.

### Scope Compliance

- In scope: verified. Out of scope detected: none.

### Suggested Next Steps

- [ ] Sub-Task 1.3 — point bundled skill/agent references at `dh-semver`.

---

## Sub-Task Review: 1.3 — Point bundled skill/agent references at dh-semver

**Reviewed against:** Sub-Task 1.3 (plan.md, Phase 1) · **Overall risk:** Low · **Verdict:** Approve

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| Skill invocations/pointers route to `dh-semver` | PASS | 7 refs in 4 files: `dh-execute-plan` L34/L84, `dh-final-review` L27/L78/L126, `dh-software-architect` L59, `AGENTS.md` L123 |
| No bare `semver` skill invocation remains | PASS | Only the intentional provenance attribution at `skills/dh-semver/SKILL.md:21` ("adaptation of the global `semver` skill") |
| Concept prose preserved | PASS | `dh-final-review` frontmatter "semver recommendation" unchanged; `AGENTS.md` "Tags: semver (`vX.Y.Z`)" retained; report label reworked to "(via `dh-semver`)" |
| Scope compliance | PASS | Only the 4 in-scope files; README/LOADING/skills-index untouched (Phase 3) |

### Findings

- **[P0] Blocking:** none. **[P1] High:** none. **[P2] Medium:** none. **[P3] Low:** none.

### Validation Results

- `node scripts/audit.mjs` → PASS (exit 0; `dh-semver` resolves as a bundled skill).
- `node scripts/check-links.mjs` → OK, 22 refs checked, 0 dead.
- Grammar/readability of the reworded sentences verified in context.

### Regression Risk Assessment

- Breaking changes detected: none — textual references only; no runtime/interface change.

### Scope Compliance

- In scope: verified. Out of scope detected: none (`state-sync` in the architect list remains a pre-existing point-6 concern).

### Suggested Next Steps

- [ ] Phase 2 — Sub-Task 2.1: normalize root docs to the registered dot namespace.

---

## Sub-Task Review: 2.1 — Normalize root docs (README.md, AGENTS.md, docs/LOADING.md)

**Reviewed against:** Sub-Task 2.1 (plan.md, Phase 2) · **Overall risk:** Low · **Verdict:** Approve

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| All underscore tool refs removed from root docs | PASS | `rg "dh_plan_|dh_logged_command|dh_read_sheet|dh_update_sheet|dh_sheet_schema"` over the 3 files → 0 matches |
| Dot names are the registered IDs | PASS | All 7 IDs verified against `src/plugin.ts` namespace/tool registrations; no malformed forms |
| LOADING table intro matches its 4 rows | PASS | "three plan-lifecycle tools plus the logged-command tool" — old "three … for phased plans" mismatch resolved |
| No skill names, counts, or unrelated prose changed | PASS | Identifier-only diff (11 tokens + 1 sentence) |
| Scope containment | PASS | Only README.md, AGENTS.md, docs/LOADING.md |

### Findings

- **[P0] Blocking:** none. **[P1] High:** none. **[P2] Medium:** none. **[P3] Low:** none.

### Validation Results

- `rg` underscore sweep → 0 hits in the three files; broader `dh_` sweep clean.
- Registered names cross-checked against `src/plugin.ts` (namespace `dh`, tools `plan_read`/`plan_update_status`/`plan_create`/`logged_command`/`read_sheet`/`update_sheet`/`sheet_schema`).
- `node scripts/check-links.mjs` → OK, 22 refs, 0 dead.

### Regression Risk Assessment

- Breaking changes detected: none — documentation identifiers only.

### Scope Compliance

- In scope: verified. Out of scope detected: none.

### Suggested Next Steps

- [ ] Sub-Task 2.2 — normalize skills/ and agents/ tool references.

---

## Sub-Task Review: 2.2 — Normalize skills/ and agents/ tool references

**Reviewed against:** Sub-Task 2.2 (plan.md, Phase 2) · **Overall risk:** Low · **Verdict:** Approve

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| Zero underscore tool refs remain in skills/ + agents/ | PASS | Targeted `rg` → 0; broader `dh_[a-z]` sweep → 0 |
| Dot names are registered IDs, well-formed | PASS | All 7 IDs match `src/plugin.ts`; no malformed forms; backticks/line-wrapping preserved |
| Occurrence count preserved (36 → 36) | PASS | Per-file 1:1 verified; token-normalized diff identical (rename-only) |
| Skill names (`dh-*`) untouched; prose/formatting intact | PASS | Multiset of `dh-` names identical; no counts changed |
| Scope | PASS | Exactly the 10 expected files |

### Findings

- **[P0] Blocking:** none. **[P1] High:** none. **[P2] Medium:** none. **[P3] Low:** none.
- Note: engineer also normalized the un-backticked variant at `skills/dh-setup/SKILL.md:37` — within sub-task intent.

### Validation Results

- `node scripts/check-links.mjs` → OK (22 refs, 0 dead); `node scripts/audit.mjs` → PASS.
- Diff checked name-by-name; no occurrence dropped in tables, blockquotes, or wrapped prose.

### Regression Risk Assessment

- Breaking changes detected: none — identifier renames in documentation/skill text only.

### Scope Compliance

- In scope: verified. Out of scope detected: none (counts remain deferred to Phase 3).

### Suggested Next Steps

- [ ] Phase 3 — Sub-Task 3.1: README counts + `dh-semver` skill row.

---

## Sub-Task Review: 3.1 — README.md counts + dh-semver skill row

**Reviewed against:** Sub-Task 3.1 (plan.md, Phase 3) · **Overall risk:** Low · **Verdict:** Approve

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| All six count sites read 17 skills | PASS | L3, L9, L27, L83, L125, L184; stale `15 dh-*`/`16 skills`/`16 bundled` → 0 matches |
| `dh-semver` row appended last in the Skills table | PASS | Format matches neighbours; table has 17 skill rows; wording matches the bundled skill |
| No unrelated content changed | PASS | Diff = 6 count edits + 1 row; `^2.0.20` pins and dot tool refs intact |
| Scope | PASS | README.md only |
| Corpus consistency | PASS | Disk: 7 agents / 17 skills; README: 7 agent rows / 17 skill rows |

### Findings

- **[P0] Blocking:** none. **[P1] High:** none. **[P2] Medium:** none. **[P3] Low:** none.

### Validation Results

- `rg` stale-count sweep → 0; row counts verified (17 skills, 7 agents); `node scripts/check-links.mjs` → OK (22 refs, 0 dead).

### Regression Risk Assessment

- Breaking changes detected: none — counts and one documentation row only.

### Scope Compliance

- In scope: verified. Out of scope detected: none.

### Suggested Next Steps

- [ ] Sub-Task 3.2 — docs/LOADING.md counts + complete verification checklists.

---

## Sub-Task Review: 3.2 — docs/LOADING.md counts + complete verification checklists

**Reviewed against:** Sub-Task 3.2 (plan.md, Phase 3) · **Overall risk:** Low · **Verdict:** Approve
*(Implementing session was interrupted mid-run; edits were in the working tree and validation/review were re-run cleanly after resume.)*

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| Checklist agents line: all 7 agents, `dh-` prefixed | PASS | Adds `dh-documentor`; fixes previously bare names; set-equal to `LOOP.agents` |
| Checklist skills line: all 17 skills, `dh-` prefixed | PASS | Adds `dh-contingency`, `dh-code-ruler`, `dh-semver`; set-equal to `LOOP.skills`; no duplicates |
| Count sites read 17 | PASS | L109 "7 agents + 17 skills", L118 "17 `dh-*` skills"; `rg \b15\b|\b16\b` → 0 |
| Scope/formatting | PASS | Exactly 4 hunks; code-block indent/fences intact; version bullet left for 4.1 |
| Tooling | PASS | `check-links` OK (22/0); `audit` PASS |

### Findings

- **[P0] Blocking:** none. **[P1] High:** none. **[P2] Medium:** none. **[P3] Low:** none.

### Validation Results

- Set-equality script: `agents: 7 set-equal: true`, `skills: 17 set-equal: true`.
- Checklist diff verified hunk-by-hunk; no interruption artifacts; no unrelated edits.

### Regression Risk Assessment

- Breaking changes detected: none — documentation lists only.

### Scope Compliance

- In scope: verified. Out of scope detected: none.

### Suggested Next Steps

- [ ] Sub-Task 3.3 — AGENTS.md + skills/index.md counts and lists.

---

## Sub-Task Review: 3.3 — AGENTS.md + skills/index.md counts and lists

**Reviewed against:** Sub-Task 3.3 (plan.md, Phase 3) · **Overall risk:** Low · **Verdict:** Approve

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| AGENTS.md count sites read 17; enumeration includes `dh-semver` | PASS | Role summary L12/L14, provenance L70, registration L77, verify L89 — stale patterns → 0 |
| skills/index.md: intro, heading, `dh-semver` row | PASS | L3 "**17 skills**"; L75 "## The 17 bundled skills"; row appended last with link target that resolves |
| Set-equality of both lists with the corpus | PASS | AGENTS enumeration = index table = disk = `LOOP.skills` (17, no duplicates) |
| Scope | PASS | Exactly 8 single-line hunks across the two files; nothing else touched |
| Tooling | PASS | `check-links` OK (23 refs, 0 dead — the new link is followed); `audit` PASS |

### Findings

- **[P0] Blocking:** none. **[P1] High:** none. **[P2] Medium:** none. **[P3] Low:** none.

### Validation Results

- Programmatic set-equality checks passed on both surfaces; table row count = 17.
- No stale `15`/`16` counts remain in either file.

### Regression Risk Assessment

- Breaking changes detected: none — counts, one list entry, one table row.

### Scope Compliance

- In scope: verified. Out of scope detected: none.

### Suggested Next Steps

- [ ] Phase 4 — Sub-Task 4.1: LOADING version-skew bullet.

---

## Sub-Task Review: 4.1 — Fix LOADING.md version-skew bullet

**Reviewed against:** Sub-Task 4.1 (plan.md, Phase 4) · **Overall risk:** Low · **Verdict:** Approve

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| Version-skew bullet reads `@opencode/plugin@^2.0.20` | PASS | One-line change at L145; sentence grammatical |
| Historical v2.0.18 notes intact | PASS | Install tip (L42) and real-session note (L136) unchanged |
| Consistency with `package.json` and install tip | PASS | package.json = `^2.0.20`; all live version claims aligned; no live `^2.0.18` remains |
| Scope | PASS | Exactly one line; no other files |

### Findings

- **[P0] Blocking:** none. **[P1] High:** none. **[P2] Medium:** none. **[P3] Low:** none.

### Validation Results

- `rg "2.0.18"` → only the two historical notes; `rg "^2.0.20"` → install tip + version-skew bullet.
- `check-links` OK; `audit` PASS.

### Regression Risk Assessment

- Breaking changes detected: none — single documentation token.

### Scope Compliance

- In scope: verified. Out of scope detected: none.

### Suggested Next Steps

- [ ] Sub-Task 4.2 — scripts/audit.mjs header comment.

---

## Sub-Task Review: 4.2 — Fix scripts/audit.mjs header comment

**Reviewed against:** Sub-Task 4.2 (plan.md, Phase 4) · **Overall risk:** Low · **Verdict:** Approve

### Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| Usage comment names real outputs | PASS | L10 now `reports/audit.json + reports/audit.md`, matching `MD_TARGET`/`JSON_TARGET` constants |
| Comment-only change; syntax valid | PASS | 1/1 line diff; `node --check` OK |
| No stale `audit-report.md` claims remain | PASS | `rg` over active surface → 0 (only the SDD/plan quotes describing the defect + archives) |
| Behavior unchanged | PASS | `node scripts/audit.mjs` → exit 0, PASS, loop 17/17 |

### Findings

- **[P0] Blocking:** none. **[P1] High:** none. **[P2] Medium:** none. **[P3] Low:** none.

### Validation Results

- Diff is exactly one comment line; runtime console output already pointed at `reports/audit.md`.

### Regression Risk Assessment

- Breaking changes detected: none — comment only.

### Scope Compliance

- In scope: verified. Out of scope detected: none.

### Suggested Next Steps

- [ ] Phase 5 — Sub-Task 5.1: build + full gate validation.

---

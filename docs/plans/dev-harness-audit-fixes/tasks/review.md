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

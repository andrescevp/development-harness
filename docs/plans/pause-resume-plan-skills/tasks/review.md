# Sub-Task Reviews — pause-resume-plan-skills

Reviews produced by the `dh-code-review` / `dh-review` skills during
`dh-execute-plan` orchestration. Format: one section per sub-task, findings
P0–P3 with disposition.

---

## Sub-Task Review: 1.1 — Author the versioned handoff contract

**Reviewed against:** Sub-Task 1.1 (plan.md, Phase 1)
**Scope:** `skills/dh-pause-plan/references/handoff-template.md` (new, 199 lines). No implementation files modified.
**Overall risk:** Low
**Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criterion | Status | Evidence |
|---|---|---|
| Objective: canonical handoff structure shared by pause and resume | PASS | Lines 3–5 name both skills and the `docs/plans/<plan-slug>/handoff.md` path; contract overview (9–16) and lifecycle (66–73) define shared semantics |
| All 19 frontmatter keys present with exact names | PASS | Field table lines 32–50 (19 rows); example lines 96–114; programmatic diff → 0 missing |
| All 11 required sections present with exact headings | PASS | Required-sections list lines 54–64; example headings lines 117–190; programmatic diff → 0 missing |
| Example frontmatter parses as YAML | PASS | Repo `yaml` package and PyYAML both parse; 19 keys; `tags` → array, `worktree_dirty`/`blocked` → booleans, `resumed_at` → `null` |
| Example internally consistent | PARTIAL | Timestamps, position, progress, paths, hashes, worktree count, blockers, validation, and checklist agree; two example-level defects: P2 history event, P3 `next_action`/step-1 mismatch |
| Contract overview: `plan.md` remains task truth; handoff is a sidecar | PASS | Lines 9–16 ("Sidecar, not a second plan"; "plan.md stays the only source of truth for task status") |
| Versioning explicit: `handoff_version: 1`; breaking changes bump; unknown major rejected | PASS | Lines 20–24 (only `1` accepted; missing/non-integer/unknown is a hard stop) |
| Status lifecycle paused → resumed; re-pause appends history and preserves rows | PASS | Lines 68–73; example history lines 194–198 (one row mislabeled — P2) |
| Field table gives meaning + null rules; Pause History columns defined | PASS | Lines 30–50 (type column distinguishes `| null`); columns lines 75–77 (null-position representation under-specified — P3) |
| Redaction/safety rules prohibit secrets, env values, full diffs, file contents, fabricated validation | PASS | Lines 81–90; "Never fabricate a pass" (87); "Never invent results" (61) (scan command hardening — P2) |
| ISO-8601 timestamps; git optional with null handling | PASS | Line 28; nullable git fields lines 40–42; all example timestamps are `…Z` |
| ≤ 200 lines | PASS | `wc -l` → 199 |
| Under repo 250-line skill limit | PASS | 199 < `LINE_LIMITS.skill` 250 (`scripts/lib/shared.mjs:15`) |
| Cautionary: no diffs, file contents, env values; handoff is not a second plan; unknown values explicit | PASS | Lines 9–16, 81–90; example uses paths/one-line summaries (133–152). Only gap: P3 `Position` null representation |
| No out-of-scope implementation files changed | PASS | Only the new template under `skills/dh-pause-plan/`; `docs/plans/**` and the `docs/plans/index.md` row are planning artifacts (R12), not Sub-Task 1.1 changes |
| No secret-like values in the file | PASS | Only instructional prose; repo `SECRETS` simulation → 0 high-signature failures, 8 low-signature prose matches (lines 76, 81, 88, 90) |
| Done When: complete, self-consistent, reviewed against the brief | PARTIAL | Complete and structurally correct; the P2 history labeling and P3 `next_action` mismatch prevent a strict reading of "self-consistent" until fixed |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.

#### [P2] Example logs a re-pause as `paused`, contradicting the `re-paused` lifecycle

- **Location:** `skills/dh-pause-plan/references/handoff-template.md:198` (see also 71–72 and 196–197)
- **Why it matters:** The example is the copy-paste model for `dh-pause-plan` and `dh-resume-plan`. A pause after a resume is a re-pause and must append a `re-paused` row; the final row (15:42) is labeled `paused` even though the handoff was consumed at 13:40 (`resumed`). The earlier re-pause at 12:20 already uses `re-paused`, so the example contradicts itself. Sub-Tasks 1.2/1.3 will copy this contract, and a future event-vocabulary assertion could encode the wrong expectation.
- **Evidence:** `status: paused` (line 99); history `… 13:40 resumed …` (line 197) followed by `… 15:42 paused …` (line 198); lifecycle text lines 71–72 requires `re-paused` for re-pauses; line 196 uses `re-paused` for the earlier re-pause.
- **Fix:** Change the 15:42 event to `re-paused`; optionally state in the Status lifecycle that the first pause uses `paused` and every later pause uses `re-paused`.

#### [P2] Secret-scan command is case-sensitive and misses common credential prefixes

- **Location:** `skills/dh-pause-plan/references/handoff-template.md:90`
- **Why it matters:** `rg` is case-sensitive by default, so `bearer ` does not match the standard `Authorization: Bearer …` header; `secret`/`password` miss uppercase env names; common token prefixes (`ghp_`, `github_pat_`, `sk-`, `AKIA`, `xox[baprs]-`) are absent. Handoffs are committed with the plan (`plan.md:48`; `sdd.md:98`), so a credential that slips past this scan is persisted in git. The repo's own audit uses a case-insensitive low pattern plus high-signature patterns (`scripts/lib/shared.mjs:62–78`); the template's command should mirror that strength.
- **Evidence:** Local check: `printf 'Authorization: Bearer …' | rg -n "bearer "` → no match (exit 1). The line-90 pattern has no `-i` and no token-prefix alternatives.
- **Fix:** Use e.g. `rg -ni "api[_-]?key|secret|password|bearer|token|ghp_|github_pat_|sk-|AKIA|xox[baprs]-|-----BEGIN [A-Z ]*PRIVATE KEY"` and keep the "instructional prose, never live values" note. This is defense-in-depth; the primary redaction rules already prohibit recording credentials.

#### [P3] `next_action` does not match Next Steps step 1

- **Location:** `skills/dh-pause-plan/references/handoff-template.md:111` (rule at 62; steps at 175–176)
- **Why it matters:** The contract says "step 1 matches `next_action`" (line 62). The example's `next_action` merges steps 1–2 ("Fix … then re-run the handoff test"), while Next Steps step 1 is "Read … and fix finding R-3". Implementers copying the example may produce values a resume workflow or future contract test cannot compare mechanically.
- **Evidence:** `next_action` line 111 vs Next Steps lines 175–176.
- **Fix:** Make `next_action` exactly step 1 (e.g., "Read `docs/plans/example-plan/tasks/review.md` and fix finding R-3."), or relax the rule to "step 1 starts with `next_action`".

#### [P3] Pause History `Position` has no null representation

- **Location:** `skills/dh-pause-plan/references/handoff-template.md:75–77` (nullable indices at 44–45)
- **Why it matters:** `phase_index`/`subtask_index` are explicitly nullable, but the `Position` column is specified only as `Phase N / Sub-Task N.M`. A pause between sub-tasks (phase active, sub-task null) or before the first phase has no defined cell value, forcing the writer to invent one — contrary to the "keep unknown values explicit" caution.
- **Evidence:** Field table lines 44–45; column definition lines 75–77.
- **Fix:** Define the representation, e.g. `Phase 2 / —`, `Phase — / Sub-Task —`, or `n/a`, and state that the cell is never empty.

### Validation Results

- YAML parse: repo `yaml` package → OK (19 keys); PyYAML → OK.
- Structural checks: 19/19 keys, 11/11 sections, 19/19 field-table rows; 0 missing.
- Line count: `wc -l` → 199 (this reference's 200-line cap; 250-line skill audit limit).
- Secret scan: simulated the repo's `SECRETS` patterns read-only (no `pnpm run audit`, which writes `reports/`) → 0 high-signature failures; 8 low-signature instructional-prose matches (lines 76, 81, 88, 90).
- Tables structurally valid (5/6 cell counts due to escaped pipes; no malformed rows); no tabs, no trailing whitespace.
- Automated contract test: not present yet — by design; Sub-Task 3.2 adds `src/__tests__/handoff-contract.test.ts`.

### Regression Risk Assessment

- New reference file only; no runtime, parser, status-model, or MCP changes.
- Downstream risk: Sub-Tasks 1.2/1.3 copy this contract and example; the P2 history labeling is the main propagation risk.
- The template's `dh-resume-plan` reference is forward-looking (skill authored in 1.3); reference files are outside the audit surface (`scripts/audit.mjs` audits `skills/*/SKILL.md`, agents, and the index), so there is no interim audit failure.

### Scope Compliance

- In scope: `skills/dh-pause-plan/references/handoff-template.md` — verified.
- Out of scope detected: none in implementation files. The working tree also contains `docs/plans/pause-resume-plan-skills/` (sdd/plan/contingency) and one `docs/plans/index.md` row; these are planning outputs (R12), not Sub-Task 1.1 changes.
- Secrets/tokens/credentials found in the diff: none (only generic instructional prose).

### Suggested Next Steps

- [ ] Apply both P2 fixes (one-word history event; scanner command) before Sub-Tasks 1.2/1.3 copy the contract.
- [ ] Apply the P3 clarifications (next_action/step-1 rule; Position null representation) or explicitly defer them to 1.3.
- [ ] In Sub-Task 3.2, extract the fenced example and assert the exact key/section lists plus the history event vocabulary; do not assert prose wording.
- [ ] Define resume behavior when `plan_sha256` is null (no hashing tool): skip the hash check with a warning and rely on plan reconciliation, so the null path is explicit in 1.3.

---

## Sub-Task Review: 1.2 — Author dh-pause-plan

**Reviewed against:** Sub-Task 1.2 (plan.md, Phase 1)
**Scope:** `skills/dh-pause-plan/SKILL.md` (new, 200 lines) plus its reference to `skills/dh-pause-plan/references/handoff-template.md`. No implementation files modified.
**Overall risk:** Medium
**Verdict:** Request changes — superseded by the re-review below (all blocking findings fixed)

### Acceptance Criteria Verification

| Criterion | Status | Evidence |
|---|---|---|
| Frontmatter: name, trigger-rich description, MIT, compatibility, allowed-tools, metadata | PASS | Lines 2–15. Repo tolerant parser and the `yaml` package both parse it; `name: dh-pause-plan` matches the dir; triggers include pause/suspend/stop/end a session/hand off/save progress; `license: MIT`; `compatibility: opencode, copilot, antigravity`; `allowed-tools: read, write, edit, bash`; `metadata.audience/workflow` present |
| Purpose: handoff is a sidecar; `plan.md` is task truth; no `Paused` status | PASS | Lines 25–28 ("sidecar", "plan.md remains the source of truth", "There is no `Paused` status") |
| Core rules forbid status changes, commit/stash/reset/checkout/branch switches, code edits | PASS | Lines 32–35 |
| Core rules forbid secrets, env values, full diffs, file contents | PASS | Lines 36–38 |
| Core rules forbid fabricated evidence and guessing | PASS | Lines 39–43 |
| Workflow: resolution → evidence → write → validate → report | PARTIAL | Steps 0–5 present (55–161), but Step 0 has an unhandled resolution state and a vacuous-truth ordering bug (P2 below) |
| Plan resolution: explicit slug/path, unique active, multiple ask, completed final-review, none planning | PARTIAL | Rules 1–5 at 57–66; explicit/unique/multiple/completed/none are covered, but "plans exist, none active" falls through, and empty `docs/plans/` vacuously satisfies rule 4 before rule 5 (P2) |
| `dh_plan_read` + manual fallback | PASS | Lines 70–75, matching `dh-execute-plan` tool/naming wording |
| Position priority matches `dh-execute-plan` | PASS | Lines 81–85 reproduce execute-plan Step 1 priorities (all-completed handled last, semantically equivalent); no status change on read |
| Multiple active phases/sub-tasks → record ambiguity, no guessing | PASS | Lines 88–91 (candidates recorded, ambiguous indices nulled, ask when the next action depends on it) |
| Read-only git evidence | PASS | Lines 97–99 (`rev-parse`, `status --porcelain=v1`, `diff --stat`, `log --oneline -5`); no mutation commands |
| `plan_sha256` collection | PASS | Lines 100–101 (`sha256sum` / `shasum -a 256`, `null` otherwise); quoted as a string in Step 3 |
| Review findings and SDD evidence | PASS | Lines 102–105 (P0/P1 ids + review path; P2/P3 noted without text; SDD ids only) |
| Composition follows the template | PASS | Lines 109–131; 19 fields deferred to the template, 11 sections listed exactly; status/`resumed_at`/`updated`/`next_action`/`created` rules align with template lines 34–50 and 62 |
| Paused/re-paused history preservation | PARTIAL | Lines 128–131 preserve every row and append `re-paused`; the first-pause `paused` row is never stated (P3) |
| Validation: frontmatter, sections, slug, secret scan, plan unchanged | PARTIAL | Lines 133–147 cover all five, but the "plan unchanged" git sub-check is wrong for a dirty/untracked plan (P1) and the hash-null path is undefined (P3) |
| Reporting with exact resume instruction | PASS | Lines 149–158, including `run dh-resume-plan for … (slug: …)` and the not-installed stop |
| Git-optional behavior explicit | PARTIAL | Lines 46–47 and 172–173 (nulls + continue); detached-HEAD handling from template line 39 is missing from Step 2 (P3) |
| Re-pause idempotency explicit | PASS | Lines 44–45 and 128–131 (refresh, reset `resumed_at`, one appended row, preserve history) |
| Error handling: no plan, multiple, unreadable/deleted, unknown version, write failure, non-git, completed, ambiguous | PASS | Lines 163–177 covers all eight plus a secret-found case (plan with no phases/unrecognized statuses is handled at line 91) |
| Loop integration: cross-cutting, loop 2.4 / end of session, resume returns to execute-plan | PASS | Lines 179–186 |
| References: template, dh-execute-plan, dh-resume-plan, dh-review, dh-final-review | PASS | Lines 188–194; template link resolves on disk |
| ≤ 250 lines | PASS | 200 lines (`wc -l`); audit counts 201 by trailing split, still under `LINE_LIMITS.skill` 250 |
| No out-of-scope file changes | PASS | Only the new `skills/dh-pause-plan/SKILL.md`; the template is Sub-Task 1.1, and `docs/plans/**` + the `docs/plans/index.md` row are planning artifacts (R12) |
| No live secrets or dangerous commands against wrong paths | PASS | High-signature secret scan → 0 failures; commands are read-only and use `<slug>` placeholders; no destructive command appears |

### Findings

### [P0] Blocking

None.

### [P1] High

#### [P1] "Plan unchanged" validation fails whenever `plan.md` is already dirty or untracked

- **Location:** `skills/dh-pause-plan/SKILL.md:139-141` (Step 4 item 3)
- **Why it matters:** Step 4 requires `git status --porcelain docs/plans/<slug>/plan.md` to be empty, which tests "matches HEAD", not "unchanged by pause". The harness edits `plan.md` to mark the active sub-task `In Progress` before execution (`skills/dh-execute-plan/SKILL.md:51`), and nothing commits that marker mid-sub-task; a new plan may not be committed at all. In exactly those states — the main pause scenarios (loop 2.4 blocker, end of session mid-sub-task) — the check fails while the SHA check passes, and Step 4 says to "fix and re-run" a check whose only fixes (commit, checkout, revert) are forbidden by Core Rules. The workflow deadlocks or pushes the agent to violate the read-only rule.
- **Evidence:** In this repo, `git status --porcelain=v1 docs/plans/pause-resume-plan-skills/plan.md` → `?? docs/plans/pause-resume-plan-skills/plan.md` (untracked), so a pause of the plan under construction would fail item 3 today. Step 3 (126–127) also records every uncommitted path under `## Uncommitted Changes` (including `plan.md` when it is dirty), contradicting the empty-status requirement. `plan_sha256` is computed in Step 2 before composition, so the SHA comparison already proves pause did not edit the plan.
- **Fix:** Compare the hash recorded in Step 2 with a recomputation after the handoff write and require equality; drop the clean-worktree requirement or replace it with a pre-write/post-write porcelain comparison (same paths before and after). Record pre-existing `plan.md` dirtiness as evidence in `## Uncommitted Changes`, not as a validation failure.

### [P2] Medium

#### [P2] Plan resolution has an unhandled state and a vacuous-truth ordering bug

- **Location:** `skills/dh-pause-plan/SKILL.md:59-66` (Step 0 rules 2–5)
- **Why it matters:** With `docs/plans/*/plan.md` present but none active (e.g., all `Pending`, or only future plans), rule 2 selects nothing, rule 4 ("every plan `Completed`") is false, and rule 5 ("no plans at all") is also false — the skill gives no outcome, inviting a guess in violation of the "Never guess" rule. Additionally, an empty `docs/plans/` makes rule 4 vacuously true, so a literal in-order reader can suggest `dh-final-review` instead of `dh-planning`.
- **Evidence:** Rules are ordered at 59–66; rule 4 precedes rule 5 and is not guarded by "at least one plan exists". No branch covers "≥1 plan, 0 active, not all Completed".
- **Fix:** Restate the resolution as an explicit matrix: explicit slug/path → validate; else count active plans (1 → select, >1 → list + ask, 0 with plans present → list + ask or suggest `dh-execute-plan`, 0 plan files → `dh-planning`); separately, all plans `Completed` → `dh-final-review`. Guard rule 4 with "at least one plan exists".

### [P3] Low

#### [P3] Detached HEAD would record `branch: HEAD` instead of `null`

- **Location:** `skills/dh-pause-plan/SKILL.md:97-98` (Step 2) vs `references/handoff-template.md:39`
- **Why it matters:** `git rev-parse --abbrev-ref HEAD` prints `HEAD` when detached; the template requires `branch: null` in that case with the short SHA in `## Snapshot`. Following Step 2 literally produces a value the contract forbids and Step 4's "types" check cannot catch.
- **Evidence:** Template line 39 ("`null` when git is unavailable or HEAD is detached (record the short SHA in Snapshot)"); Step 2 assigns the command output directly with no detached handling.
- **Fix:** After the command, "if the output is `HEAD`, set `branch: null` and write the short SHA under `## Snapshot`".

#### [P3] First-pause history row is never specified

- **Location:** `skills/dh-pause-plan/SKILL.md:128-131` (Step 3 history paragraph)
- **Why it matters:** The paragraph only defines behavior when an existing handoff is `paused` or `resumed` (`append a re-paused row`). For a new handoff it is silent, while the template example starts with a `paused` row (`handoff-template.md:194`). Implementations may create an empty history table or mislabel the first row, which the 3.2 contract test may later encode either way.
- **Evidence:** Step 3 has no "no existing handoff" branch; template lifecycle text (67–72) and example (194–198) distinguish the initial `paused` event from later `re-paused` events.
- **Fix:** Add: "No existing handoff → create `## Pause History` with one `paused` row; existing handoff → append one `re-paused` row."

#### [P3] Plan-integrity validation has no path when `plan_sha256` and git are both unavailable

- **Location:** `skills/dh-pause-plan/SKILL.md:100-101`, `139-141`, `172-173`
- **Why it matters:** Step 4 item 3 requires the recomputed hash to match `plan_sha256`; when no hashing tool exists the field is `null`, and in a non-git workspace there is no alternative evidence. The skill neither skips the check nor marks integrity unverifiable, so the agent must invent behavior — contrary to "unknown values explicit" and "never claim validation results not observed".
- **Evidence:** Step 2 sets `plan_sha256: null` when neither tool exists; Error Handling only addresses non-git, not hash-unavailable; Step 4 item 3 has no null condition.
- **Fix:** State that when `plan_sha256` is `null` the hash comparison is skipped and `## Snapshot` says plan integrity is `unverifiable` (with git evidence when available); never report the plan as unchanged without evidence.

### Validation Results

- Frontmatter: repo tolerant parser → 0 errors, fields `name, description, license, compatibility, allowed-tools, metadata`; `yaml` package → same keys; `metadata` parses as an object; description length 374 chars.
- Structure: six H2 sections (Core Rules, Workflow, Error Handling, Loop Integration, References, Doc search); Step 3 lists 11 sections that match the template's 11 required sections and the template example exactly (programmatic diff → 0).
- Line count: 200 (`wc -l`); audit line count 201 by trailing split — under the 250 limit.
- Secret scan: simulated the repo's `SECRETS` patterns read-only → 0 high-signature failures; 10 low-signature instructional-prose hits (info only, e.g. the scan pattern at line 144).
- Link check: `skills/dh-pause-plan/references/handoff-template.md` exists.
- Git evidence for the P1: `git status --porcelain=v1 docs/plans/pause-resume-plan-skills/plan.md` → `?? docs/plans/pause-resume-plan-skills/plan.md`.
- Not run: `pnpm run audit` (writes `reports/`), `pnpm test` (skill counts are still 17 by design until Sub-Tasks 3.1/3.2), and the rehearsal (Sub-Task 4.1).

### Regression Risk Assessment

- New skill file only; no runtime, parser, status-model, MCP, or config changes. Source-mode discovery will register it automatically; inventory/count assertions remain 17 until Sub-Tasks 3.1/3.2, which is expected by the plan.
- The reference link and its target are on the copy-assets surface, so the skill survives bundling.
- Main propagation risk: Sub-Task 1.3 will mirror this validation wording and the resolution matrix; fix the P1/P2 before 1.3 copies them. The P1 also affects the very first real use of the skill on this (currently untracked) plan.

### Scope Compliance

- In scope: `skills/dh-pause-plan/SKILL.md` — verified. The reference template is Sub-Task 1.1 (Completed) and was only read.
- Out of scope detected: none in implementation files. `docs/plans/pause-resume-plan-skills/**` and the `docs/plans/index.md` row are planning outputs (R12), not Sub-Task 1.2 edits.
- Secrets/tokens/credentials found in the diff: none (only generic instructional prose and a scan regex).

### Suggested Next Steps

- [ ] Fix the P1 validation rule before Sub-Task 1.3 copies it; keep the SHA before/after comparison and stop requiring a clean worktree.
- [ ] Fix the P2 resolution matrix (unhandled "none active" state; guard the vacuous "every plan Completed" branch).
- [ ] Apply the P3 clarifications (detached HEAD, initial `paused` row, hash-unavailable path) in 1.2 or carry them to 1.3.
- [ ] In Sub-Task 3.2 assert structure (fields, 11 sections, template link), not prose; in Sub-Task 4.1 rehearse a pause with a dirty/untracked `plan.md` — the P1 scenario.

---

## Sub-Task Re-Review: 1.2 — Author dh-pause-plan (after fixes)

**Reviewed against:** Sub-Task 1.2 (plan.md, Phase 1) — re-review after fixes to `skills/dh-pause-plan/SKILL.md` (now 214 lines)
**Scope:** `skills/dh-pause-plan/SKILL.md` and its reference to `skills/dh-pause-plan/references/handoff-template.md`. No implementation files modified.
**Overall risk:** Low
**Verdict:** Approve with comments

### Prior Findings Disposition

| Finding | Status | Evidence |
|---|---|---|
| [P1] "Plan unchanged" required a clean/HEAD-matching `plan.md` | FIXED | Step 4 item 3 (145–154) now compares the Step 2 `plan_sha256` with a post-write recomputation and hard-stops on mismatch; the pre/post porcelain snapshots are optional evidence; line 150 states "never require the file to be clean"; the hash-unavailable and neither-hash-nor-git paths are defined. Lines 159–160 explicitly forbid commit, checkout, revert, and touching `plan.md`. No residual wording requires a clean worktree. |
| [P2] Resolution matrix gap + vacuous "every plan Completed" | FIXED | Step 0 (57–70): explicit slug/path; exactly one active → use; multiple active → list + ask; no active + ≥1 plan + all `Completed` → `dh-final-review`; no active + plans exist + not all `Completed` → list + ask (explicit argument still resolves); zero plans → `dh-planning`. Rule 3 now requires "at least one plan exists", removing the empty-directory vacuity. |
| [P3] Detached HEAD recorded `branch: HEAD` | FIXED | Step 2 (101–103): if `git rev-parse --abbrev-ref HEAD` returns `HEAD`, set `branch: null` and record the short SHA in `## Snapshot`, never the literal `HEAD`. |
| [P3] First-pause history row unspecified | FIXED | Step 3 (134–137): a brand-new handoff appends `paused`; refreshing a paused handoff or pausing after a resume appends `re-paused` (keeping `created`); every prior row is preserved — never delete, reorder, or rewrite. |
| [P3] Integrity fallback undefined when hash/git unavailable | FIXED | Step 4 (151–154): hashing unavailable → pre/post porcelain comparison; neither hashing nor git → mark integrity `unverifiable` in `## Validation State` and `## Resume Checklist`, and never claim the plan is unchanged. |

### Remaining Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] Medium:** none.

#### [P3] Pre-write porcelain snapshot is sequenced inside the post-write validation step

- **Location:** `skills/dh-pause-plan/SKILL.md:147-152` (Step 4 item 3) vs the Step 3 write (117–118)
- **Why it matters:** When hashing is unavailable (`plan_sha256: null`), Step 4 says to "take and compare the pre/post porcelain snapshots instead", but Step 4 runs after the Step 3 write and the "before" snapshot is described as optional. An agent that reaches Step 4 without a pre-write snapshot cannot execute the fallback as written; the safe outcome (`unverifiable`) is only prescribed when *neither* hashing nor git is available, so the missing-pre-snapshot case is undefined and invites an improvised comparison.
- **Evidence:** The null-hash condition is known in Step 2 (106–107), but the snapshot instruction lives in Step 4 (147–152) after the write. No branch says "pre-write snapshot missing → mark `unverifiable`".
- **Fix:** In Step 2, capture the pre-write `git status --porcelain -- docs/plans/<slug>/plan.md` snapshot whenever `plan_sha256` is null (or always); in Step 4 add "if a pre-write snapshot is missing, mark integrity `unverifiable`". This is a clarification, not a functional break — the SHA comparison remains the primary check.

### Re-Validation

- Frontmatter: repo tolerant parser → 0 errors; `yaml` package → the same six fields; name/license/compatibility/allowed-tools/metadata unchanged.
- Line count: 214 (`wc -l`; audit counts 215 by trailing split) — under the 250-line skill limit.
- Structure: six H2 sections unchanged; Step 3's 11 sections still match the template's required sections.
- Secret scan: simulated the repo's `SECRETS` patterns read-only → 0 high-signature failures; 10 low-signature instructional-prose hits (info only).
- Residual command wording: only the prohibitions at 33–34 and 159–160; no executable commit/checkout/revert and no clean-worktree requirement (line 150 explicitly says the opposite).
- Empty-directory guard: verified — rule 3 requires at least one plan; rule 5 handles zero plans.
- Scope: `git status --porcelain` shows only the new `skills/dh-pause-plan/` (skill + template), the `docs/plans/pause-resume-plan-skills/` planning artifacts, and the `docs/plans/index.md` row; no implementation file changes.
- Not run: `pnpm run audit` (writes `reports/`), full `pnpm test` (inventory is still 17 by design until Sub-Tasks 3.1/3.2), and the rehearsal (Sub-Task 4.1).

### Verdict

**Approve with comments.** All P1/P2 findings and the targeted P3s are fixed. One low-impact P3 (pre-write snapshot sequencing) remains and does not block Sub-Task 1.2.

---

## Sub-Task Review: 1.3 — Author dh-resume-plan

**Reviewed against:** Sub-Task 1.3 (plan.md, Phase 1)
**Scope:** `skills/dh-resume-plan/SKILL.md` (new, 187 lines), cross-checked against `skills/dh-pause-plan/references/handoff-template.md` and `skills/dh-pause-plan/SKILL.md`. No implementation files modified.
**Overall risk:** Medium
**Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criterion | Status | Evidence |
|---|---|---|
| Frontmatter: name `dh-resume-plan`, trigger-rich description, MIT, compatibility, allowed-tools, metadata | PASS | Lines 2–14; tolerant parser and the `yaml` package parse it; name matches the dir; triggers include "resume the plan", "continue where we stopped", "pick up the plan"; `license: MIT`; `compatibility: opencode, copilot, antigravity`; `allowed-tools: read, write, edit, bash`; metadata present |
| Purpose: handoff supplements `plan.md`; `plan.md` is task truth; no `Paused` status; no loop duplication | PASS | Lines 17–27 ("supplements `plan.md`", "`plan.md` remains the source of truth", "there is no `Paused` status", non-goals against reimplementing the loop) |
| Core rules: destructive git ban, no work discard, validate before acting, no plan status mutation, one plan, idempotent consumed handling, surface unverifiable drift | PASS | Lines 31–47 (reset/stash/checkout/clean/rebase/revert/branch changes banned; "never discard uncommitted work"; validate-first; handoff-only writes; one plan at a time; consumed = report; unverifiable surfaced; no secret/diff dumps; delegate execution) |
| Step 0: explicit slug/path, 0/1/>1 paused handoffs, `resumed` = consumed | PASS | Lines 51–63; 0 → suggest status-based `dh-execute-plan`/`dh-planning`; 1 → use; >1 → list slug/position/`paused_at` + ask; resumed → report consumed and offer a fresh pause only on request |
| Step 1: integer `handoff_version: 1` (unknown/higher stops), slug/path match, all frontmatter keys, all 11 sections, `status: paused`; invalid only falls back with explicit confirmation | PASS | Lines 65–80; version/missing stop, slug/path + existence, template fields with types, 11 non-empty sections, paused status; failure stops and offers status-based execution only with explicit confirmation |
| Step 2: branch, HEAD vs `base_commit` + ancestry, worktree vs recorded paths, plan hash, conflicts, classification, material asks, unverifiable handling, no destructive reconciliation | PARTIAL | Lines 82–105 cover every check and the clean/explainable/material split; detached HEAD and a missing hashing tool are not in the unverifiable bullet, and ancestor commits are blanket-classified explainable (P3 below) |
| Step 3: reconcile plan truth (advanced, backwards, blocked/open findings, no remaining work, ambiguity) | PARTIAL | Lines 107–118 cover advanced/backwards/blocked/no-work; ambiguous positions are not handled (P2 below) |
| Step 4: concise rehydration without dumping the handoff | PASS | Lines 120–131 (goal, position, progress, completed/in-flight, uncommitted paths, unverified checks, decisions, blockers, validation, next steps; asks only on material drift/disagreement) |
| Step 5: consume only when starting; `resumed` + `resumed_at` + `updated`; append `resumed`; preserve history; no plan status mutation; delegate; unavailable → report | PARTIAL | Lines 133–147 define all fields/history/delegation and the unavailable instruction, but the handoff is consumed before `dh-execute-plan` availability is established (P3 below) |
| Error handling: no handoff, corrupt, unknown version, slug/path mismatch, plan missing, already resumed, no remaining work, material drift, non-git, multiple paused, write failure | PASS | Lines 149–164 (all 11; the corrupt/plan-missing recovery advice is inaccurate — P3 below) |
| Loop integration and references (template path resolves after bundling) | PASS | Lines 168–181; `../dh-pause-plan/references/handoff-template.md` resolves on disk and the relative layout is preserved by the asset copier |
| ≤ 250 lines | PASS | 187 (`wc -l`; audit counts 188 by trailing split) |
| No out-of-scope changes | PASS | Only the new `skills/dh-resume-plan/`; `docs/plans/**` and the `docs/plans/index.md` row are planning outputs |
| No live secrets; read-only git only | PASS | Secret scan → 0 high-signature failures; git commands are `rev-parse`, `merge-base --is-ancestor`, `log`, `status`, `diff --name-only --diff-filter=U`; no mutation command |
| Cross-consistency: field names, statuses, history events, plan-as-truth model | PASS | Field references match the template (`handoff_version`, `plan_slug`, `plan_path`, `status`, `resumed_at`, `updated`, `branch`, `base_commit`, `worktree_dirty`, `plan_sha256`, `blocked`); `paused`/`resumed` statuses; resume appends `resumed` while pause writes `paused`/`re-paused`; plan truth stated at 19, 26–27, 36–38, 109–118, 140 |

### Findings

### [P0] Blocking

None.

### [P1] High

None.

### [P2] Medium

#### [P2] Step 3 never handles an ambiguous plan position

- **Location:** `skills/dh-resume-plan/SKILL.md:107-118` (Step 3), in contrast with `skills/dh-pause-plan/SKILL.md:92-94`
- **Why it matters:** Pause records ambiguity explicitly (candidates listed, `phase_index`/`subtask_index` nulled) when multiple phases or sub-tasks are `In Progress`. Resume recomputes the position with the execute-plan priority and never inspects the handoff's `## Current Position` ambiguity or the null indices. On an ambiguous plan it silently resumes the first candidate instead of asking, contrary to the plan's risk rule "Ambiguous active plan/sub-task → never guess; record the ambiguity or ask" (`plan.md:64`) and to the review checklist's Step 3 ambiguity requirement. The result can be work resumed in the wrong phase/sub-task, with the ambiguity invisible in the Step 4 summary.
- **Evidence:** Pause Step 1 lines 92–94 record candidates and null the ambiguous indices; resume Step 3 lines 109–118 only list advanced/backwards/blocked/no-work branches; resume Step 4 (120–131) does not mention ambiguity. No validation rejects `phase_index`/`subtask_index` null while a paused handoff exists.
- **Fix:** In Step 3, after recomputing, add: "If the plan has multiple `In Progress` phases/sub-tasks, or the handoff's `phase_index`/`subtask_index` are null with candidates in `## Current Position`, list the candidates and ask — never auto-pick. If the handoff and plan disagree on the active sub-task, stop and ask." Surface the same in the Step 4 summary.

### [P3] Low

#### [P3] Unverifiable drift misses detached HEAD and a missing hashing tool

- **Location:** `skills/dh-resume-plan/SKILL.md:86-101` (Step 2)
- **Why it matters:** Two realistic states have no defined classification. (1) Pause records `branch: null` when HEAD is detached (`handoff-template.md:39`); at resume `git rev-parse --abbrev-ref HEAD` returns the literal `HEAD`, which the branch bullet (86–87) would treat as "a different branch → material" instead of the unverifiable branch check. (2) When the recorded `plan_sha256` is non-null but no `sha256sum`/`shasum` exists in the resuming environment, the plan-hash bullet (96–97) cannot recompute it, and the unverifiable bullet (100–101) lists only no git, null branch/base_commit, or missing commits. Both cases force the agent to improvise.
- **Evidence:** Template line 39 makes `branch` null for detached HEAD; pause Step 2 (101–103) records the short SHA in Snapshot. Resume's unverifiable bullet does not mention hashing-tool absence, while pause Step 4 (151–152) explicitly degrades when hashing is unavailable.
- **Fix:** Add to the unverifiable bullet: "detached HEAD at pause (`branch: null`) → compare `base_commit`/HEAD, mark the branch check unverifiable; no hashing tool → mark the plan-hash check unverifiable and rely on git evidence." Never classify either state as material solely on the missing value.

#### [P3] Ancestor commits are classified explainable without checking what they touched

- **Location:** `skills/dh-resume-plan/SKILL.md:88-91` (Step 2 HEAD ancestry)
- **Why it matters:** Every descendant commit is labeled explainable once `merge-base --is-ancestor` passes, regardless of content. The plan's drift definition limits explainable to "new commits or files that do not touch recorded work" (`plan.md:76-79`) and warns that concurrent sessions should be detected and warned rather than overwritten. A commit from another session that changes the files listed in `## Work In Flight` would be silently labeled explainable, and Step 4 would proceed without confirmation, risking conflicting or duplicated work.
- **Evidence:** Branch bullet 86–87 and ancestry bullet 88–91 make branch/HEAD identity the only criteria; the worktree bullet (92–95) checks uncommitted paths but committed changes no longer appear in `git status`. Only `git log --oneline` is listed, with no path/content comparison against `## Work In Flight` or `## Uncommitted Changes`.
- **Fix:** After listing `git log --oneline <base_commit>..HEAD`, inspect whether those commits touch the recorded in-flight/recorded paths (`git show --stat` or `git diff --name-only <base_commit>..HEAD`); touching recorded work → material (ask), unrelated → explainable.

#### [P3] Corrupt-handoff and missing-plan recovery actions are not executable by the referenced skills

- **Location:** `skills/dh-resume-plan/SKILL.md:153,156` (Error Handling) vs `skills/dh-pause-plan/SKILL.md:57-58,182-183`
- **Why it matters:** For a corrupt/unparseable handoff, resume says "ask the user to re-pause", but pause's Error Handling refuses to overwrite an invalid existing handoff (unparseable YAML, missing `handoff_version`, or an unknown version) and never migrates it. For a missing plan, resume says "offer a fresh pause", but pause Step 0 requires a readable `plan.md` before writing a handoff. In both cases the suggested recovery cannot be performed as stated, leaving the user stuck without the manual prerequisite.
- **Evidence:** Pause Error Handling lines 182–183 ("never overwrite or migrate it"); pause Step 0 lines 57–58 require an existing, readable plan. Resume lines 153 and 156 present re-pause/fresh pause as the remedy.
- **Fix:** State the prerequisite: "corrupt handoff → ask the user to remove or repair the file before re-pausing — pause will not overwrite it"; "plan missing → restore the plan or archive the handoff; a fresh pause requires a readable plan." Optionally make Step 0 report unparseable handoff files instead of treating them as absent.

#### [P3] Step 5 consumes the handoff before confirming `dh-execute-plan` is available

- **Location:** `skills/dh-resume-plan/SKILL.md:135-147` (Step 5)
- **Why it matters:** Step 5 edits the handoff to `status: resumed` first (135–139) and only then invokes `dh-execute-plan` (141–143); the unavailable case (146–147) reports an instruction. If `dh-execute-plan` is unavailable, the handoff is consumed (`status: resumed`) although execution never started, so a later resume reports it as already consumed and the user must perform a fresh pause to retry. The plan's consume lifecycle says resume stamps `resumed` only when execution is about to start (`plan.md:81-84`).
- **Evidence:** Step 5 order 1 → 3; the unavailable branch is a report, not a rollback. Pause's re-pause path can reopen a resumed handoff, so the state is recoverable, but the consume is premature.
- **Fix:** Verify `dh-execute-plan` availability before step 1; if unavailable, report the exact resume instruction and leave `status: paused`. Alternatively, make the unavailable branch explicitly say the handoff remains consumed and requires a fresh pause.

### Validation Results

- Frontmatter: repo tolerant parser → 0 errors, six fields; `yaml` package → same keys; metadata parses as an object.
- Line count: 187 (`wc -l`; audit count 188 by trailing split) — under the 250-line limit.
- Secret scan: simulated the repo's `SECRETS` patterns read-only → 0 high-signature failures; 2 low-signature instructional-prose hits (info only).
- Reference: `skills/dh-resume-plan/../dh-pause-plan/references/handoff-template.md` exists; `scripts/copy-assets.mjs` copies skill directories recursively, so the relative link survives bundling.
- Git commands: `rev-parse`, `merge-base --is-ancestor`, `log`, `status`, `diff --name-only --diff-filter=U` — all read-only; no reset/stash/checkout/clean/rebase/revert/branch command.
- Vocabulary cross-check: template uses `paused`/`resumed`/`re-paused`; pause writes `paused`/`re-paused`; resume appends `resumed` and preserves history. Field names referenced by resume all exist in the template.
- Not run: `pnpm run audit` (writes `reports/`), full `pnpm test` (inventory is still 17 by design until Sub-Tasks 3.1/3.2), and the rehearsal (Sub-Task 4.1).

### Regression Risk Assessment

- New skill only; no runtime, parser, status-model, MCP, or config change. Source-mode discovery registers it automatically; the reference template is bundled as a sibling directory, so the link resolves in `dist/assets`.
- The P2 ambiguity gap affects real resume behavior (wrong-position risk) and should be fixed before Sub-Task 2.1 adds the execute-plan paused-handoff guard.
- The P3 recovery guidance is cross-skill documentation; fixing it keeps pause/resume coherent. The consume-order P3 is recoverable via re-pause but pollutes history.

### Scope Compliance

- In scope: `skills/dh-resume-plan/SKILL.md` — verified (new, 187 lines).
- Out of scope detected: none in implementation files. `docs/plans/pause-resume-plan-skills/**` and `docs/plans/index.md` are planning outputs (R12), not Sub-Task 1.3 edits.
- Secrets/tokens/credentials found in the diff: none (only generic instructional prose).

### Suggested Next Steps

- [ ] Fix the P2 ambiguity handling in Step 3 before Sub-Task 2.1 integrates the paused-handoff guard.
- [ ] Apply the P3 clarifications (detached HEAD + missing hashing tool, ancestor-commit classification, recovery prerequisites, consume-before-availability).
- [ ] In Sub-Task 3.2, assert the cross-skill vocabulary (field names, `paused`/`resumed`/`re-paused`) and the template reference path structurally.
- [ ] In Sub-Task 4.1, rehearse detached HEAD, corrupt handoff, missing plan, and hashing-unavailable resume paths.

---

## Sub-Task Re-Review: 1.3 — Author dh-resume-plan (after fixes)

**Reviewed against:** Sub-Task 1.3 (plan.md, Phase 1) — re-review after fixes to `skills/dh-resume-plan/SKILL.md` (now 205 lines)
**Scope:** `skills/dh-resume-plan/SKILL.md`, cross-checked against `skills/dh-pause-plan/references/handoff-template.md` and `skills/dh-pause-plan/SKILL.md`. No implementation files modified.
**Overall risk:** Medium
**Verdict:** Approve with comments

### Prior Findings Disposition

| Finding | Status | Evidence |
|---|---|---|
| [P2] Step 3 ambiguous position | FIXED | Step 3 (120–123) lists candidates and asks when multiple phases/sub-tasks are `In Progress` or the indices are null with recorded candidates; Step 4 (139, 142–144) carries the ambiguity and requires confirmation. |
| [P3] Detached HEAD treated as material | FIXED | Step 2 (86–88): literal `HEAD` with a null recorded `branch` is "consistent (branch unverifiable)"; a different branch or newly detached HEAD is material. |
| [P3] Ancestor commits blanket-explainable | FIXED | Step 2 (89–96): `git diff --name-only <base_commit>..HEAD`; paths intersecting recorded in-flight/uncommitted paths or `plan.md` are material and must be asked about; only unrelated paths are explainable. |
| [P3] Missing hashing tool | PARTIAL | Step 2 (101–104) marks plan integrity unverifiable and requires confirmation; Step 4 (142–144) omits unverifiable drift from the confirmation gate (remaining P2 below). |
| [P3] Corrupt-handoff / missing-plan recovery | FIXED | Error Handling (168–174): repair/remove the invalid handoff before re-pausing; restore `plan.md` before re-pausing; both match pause's refusal to overwrite invalid handoffs or write without a readable plan. |
| [P3] Step 5 consumes before availability | FIXED | Step 5 (150–152) verifies `dh-execute-plan` first; unavailable → report the instruction and leave `status: paused`. |

### Remaining Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.

#### [P2] Step 4's confirmation gate omits unverifiable drift

- **Location:** `skills/dh-resume-plan/SKILL.md:142-144` (Step 4), in conflict with lines 42, 103–104, and 178–179
- **Why it matters:** Core Rule line 42 says unverifiable drift "is surfaced and confirmed before proceeding"; the plan-hash bullet (103–104) says a missing hashing tool means "mark plan integrity unverifiable and require confirmation before continuing"; Error Handling (178–179) says non-git/unverifiable requires consent. Step 4 then says "Ask for confirmation only when drift was material, the plan and handoff disagree, or Step 3 surfaced an ambiguous position; otherwise proceed to Step 5" — unverifiable drift is not in the list, so a non-git, null-hash, or missing-hashing-tool resume can proceed without the confirmation the other three rules require.
- **Evidence:** The Step 2 "Unverifiable" bullet (107–108) instructs "mark the check unverifiable and say so in the summary" but does not repeat the confirmation; Step 4's exclusive "only when" wording makes the omission controlling. The three confirmation statements and the Step 4 gate are mutually inconsistent.
- **Fix:** Add "or drift was unverifiable (non-git, null recorded hash, or missing hashing tool)" to the Step 4 confirmation trigger, and state the same ask in Step 2's unverifiable bullet.

### Re-Validation

- Frontmatter: repo tolerant parser → 0 errors, six fields; `yaml` package → same keys; name/license/compatibility/allowed-tools/metadata unchanged.
- Line count: 205 (`wc -l`; audit count 206 by trailing split) — under the 250-line limit.
- Secret scan: simulated the repo's `SECRETS` patterns read-only → 0 high-signature failures; 2 low-signature instructional-prose hits (info only).
- Reference: `../dh-pause-plan/references/handoff-template.md` resolves on disk; the asset copier keeps `references/` so the link survives bundling.
- Git commands: `rev-parse`, `merge-base --is-ancestor`, `log`, `status`, `diff --name-only` (both ancestry and conflict checks) — all read-only; no destructive command.
- Regression check: frontmatter, purpose, core rules, Steps 0–1, loop integration, and references are unchanged; Step 2 additions are read-only; Step 3/4 add ambiguity handling; Step 5 reorders the availability check before the handoff edit; Error Handling updated; no new sections or fields.
- Scope: `git status --porcelain` shows only the new `skills/dh-resume-plan/`, `skills/dh-pause-plan/`, the `docs/plans/pause-resume-plan-skills/` planning artifacts, and the `docs/plans/index.md` row; no implementation changes.
- Not run: `pnpm run audit` (writes `reports/`), full `pnpm test` (inventory is still 17 by design until Sub-Tasks 3.1/3.2), and the rehearsal (Sub-Task 4.1).

### Verdict

**Approve with comments.** All prior findings are fixed except the Step 4 confirmation gate, which is a non-blocking P2 consistency fix. The skill is ready to proceed to Sub-Task 2.1 once that wording is aligned.

---

## Sub-Task Review: 2.1 — Guard dh-execute-plan and reference pause on blockers

**Reviewed against:** Sub-Task 2.1 (plan.md, Phase 2)
**Scope:** `skills/dh-execute-plan/SKILL.md` (+4 lines) and `skills/dh-execute-plan-task/SKILL.md` (+3 lines). The diff is purely additive; no existing line was modified. No implementation files changed.
**Overall risk:** Low
**Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criterion | Status | Evidence |
|---|---|---|
| `dh-execute-plan` Core Rules has a paused-handoff guard: paused handoff blocks status-based execution, redirects to `dh-resume-plan`, bypass only on explicit instruction | PASS | Line 23: path + `status: paused`, stop/direct to `dh-resume-plan`, "Bypass only on an explicit user instruction to skip rehydration" |
| Step 1 has a priority-0 paused-handoff check before existing priorities; numbering/priority 2 reference remain coherent | PASS | Lines 43–47: priority 0 precedes 1–4; Resume Mode line 107 still says "priority 2", which is still the first `In Progress` phase priority |
| Resume Mode states paused handoff takes precedence; absent/already-`resumed` falls back to phase-aware resume | PASS | Line 105: "takes precedence over status-based resume"; absent/resumed → phase-aware priority in Step 1 |
| Error Handling includes the paused-handoff redirect | PASS | Line 112: redirect to `dh-resume-plan` or explicit confirmation to bypass |
| `dh-execute-plan-task` recommends `dh-pause-plan` on 3-strike validation failure | PASS | Line 77 stops after 3 failures; line 79 recommends `dh-pause-plan` to preserve the position/git/decisions/next steps |
| `dh-execute-plan-task` recommends `dh-pause-plan` when P0/P1 cannot be resolved; never marks sub-task/phase Completed around a blocker | PASS | Line 122: recommend pause, do not mark Completed; existing lines 26, 69, 127–128 keep completion gated on review |
| No `Paused` plan status or plan-status mutation; word refers only to the handoff | PASS | Only handoff contexts at `dh-execute-plan` 23, 43, 105, 112; no plan status added; no status writes in the diff |
| Single-executor policy, TDD, project-type detection, phase lifecycle, status coordination unchanged | PASS | Diff is additive only; lines 19–22, 26, 29–43 (task), 53–69, 125–130 and the equivalent execute-plan sections are untouched |
| Both files ≤250 lines; frontmatter valid | PASS | 153 and 173 lines; both frontmatters parse (tolerant parser + `yaml`) with unchanged fields |
| Only the two skill files changed (plus pre-existing plan artifacts) | PASS | `git status`: the two skill files modified; `docs/plans/index.md` and the plan/pause/resume artifacts predate this sub-task |
| No broken cross-references or duplicate handoff contract | PASS | `dh-resume-plan` and `dh-pause-plan` exist; the guard/task text summarizes intent and does not restate the template contract |

### Findings

### [P0] Blocking

None.

### [P1] High

None.

### [P2] Medium

None.

### [P3] Low

#### [P3] Loop Integration 2.4 does not mention pause, despite the plan's instruction to note it

- **Location:** `skills/dh-execute-plan/SKILL.md:133-140` and `skills/dh-execute-plan-task/SKILL.md:155-161` (Loop Integration 2.4); related `skills/dh-execute-plan-task/SKILL.md:116`
- **Why it matters:** The sub-task instructions say "Note pause at loop step 2.4 and in the task failure path" (`plan.md:149`). The task failure paths are covered (3-strike at 77–79; P0/P1 at 122), but the canonical 2.4 paragraphs still say only "STOP: report the blocker and ask the user for guidance" with no `dh-pause-plan` recommendation. The task file's Step 5 re-validation failure (line 116: two additional failures after initial fixes) is another hard-blocker exit that does not mention pause; only the Step 3 paragraph (79) does. An agent reading the Loop Integration summary or the Step 5 failure path can end the session without the handoff the feature is meant to preserve.
- **Evidence:** `rg "dh-pause-plan"` finds only task lines 79 and 122; neither Loop Integration 2.4 paragraph contains it. The Step 5 line 116 says "stop and report ... do not proceed" without the pause recommendation. The plan's Instructions line 149 explicitly asks for the loop 2.4 note.
- **Fix:** Add one line to both 2.4 paragraphs: "Recommend `dh-pause-plan` before ending the session so the position, git state, and next steps are preserved." Alternatively, add a task Core Rule covering all hard-blocker exits (3-strike, re-validation failure, unresolvable P0/P1) and reference it from 2.4.

### Validation Results

- Diff: purely additive — `dh-execute-plan` +4 lines, `dh-execute-plan-task` +3 lines; no deleted or rewritten lines.
- Frontmatter: both files parse with the repo tolerant parser and the `yaml` package; name/license/compatibility/allowed-tools/metadata unchanged.
- Line counts: `dh-execute-plan` 153, `dh-execute-plan-task` 173 — both under 250.
- Secret scan: simulated repo `SECRETS` patterns → 0 high-signature failures in both files.
- Cross-references: `skills/dh-pause-plan/SKILL.md` and `skills/dh-resume-plan/SKILL.md` exist; `dh-review`/`dh-final-review`/`dh-execute-plan-task` exist.
- Status model: no `Paused` plan status; the only "paused" text is the handoff guard; no plan status mutation in the diff.
- Scope: the two skill files are the only sub-task changes; `docs/plans/**` and the index row are planning artifacts.
- Not run: `pnpm test` (skill counts are still 17 by design until Sub-Tasks 3.1/3.2), `pnpm run audit` (writes `reports/`), and the full QA gate (Sub-Task 4.2).

### Regression Risk Assessment

- Low: the guard is additive and only triggers when a handoff exists with `status: paused`; the no-handoff execution path and priority semantics are unchanged.
- The task file's pause recommendations sit on the existing failure paths; normal execution, TDD, single-executor policy, project-type detection, and phase coordination are untouched.
- The only residual risk is the P3 documentation gap at Loop Integration 2.4 / Step 5 re-validation failure, not a behavioral regression.

### Scope Compliance

- In scope: `skills/dh-execute-plan/SKILL.md` and `skills/dh-execute-plan-task/SKILL.md` — verified.
- Out of scope detected: none in implementation files. `docs/plans/pause-resume-plan-skills/**`, `docs/plans/index.md`, and the Phase 1 skill directories are pre-existing planning/implementation artifacts.
- Secrets/tokens/credentials found in the diff: none.

### Suggested Next Steps

- [ ] Add the pause recommendation to Loop Integration 2.4 in both files and to the task's Step 5 re-validation failure (or add a Core Rule covering all hard-blocker exits).
- [ ] Proceed to Sub-Task 2.2 (AGENTS.md/skills index) once this wording is aligned; the inventory is still 17 by design.
- [ ] Re-run the link/audit checks after the 2.2 inventory updates.

---

## Sub-Task Review: 2.2 — Update AGENTS.md and skills index

**Reviewed against:** Sub-Task 2.2 (plan.md, Phase 2)
**Scope:** `AGENTS.md` and `skills/index.md` — the only files changed by this sub-task. The `dh-execute-plan`/`dh-execute-plan-task` edits are Sub-Task 2.1; `docs/plans/**` and the index row are pre-existing plan artifacts.
**Overall risk:** Low
**Verdict:** Approve

### Acceptance Criteria Verification

| Criterion | Status | Evidence |
|---|---|---|
| `AGENTS.md` role summary says 19 skills and lists `dh-pause-plan` + `dh-resume-plan` | PASS | Lines 12–16; the list contains 19 skill names, including both new skills |
| Cross-cutting pause/resume section after 2.4 and before Harness tools; handoff is a sidecar, not a fourth status; redirect and re-entry accurate | PASS | Lines 51–57 sit after the 2.4 paragraph (42–49) and before Harness tools (59); states pause without status changes, handoff sidecar, `dh-execute-plan` redirect, and `dh-resume-plan` re-entry to step 2 |
| Provenance/registration/verify/layout counts all say 19 | PASS | Lines 83, 90, 104, 114 |
| `skills/index.md` intro and heading say 19 | PASS | Lines 3–5 and 88 |
| Mermaid PA/RS nodes, three edges, class line, balanced subgraph/end | PASS | Nodes lines 20–21; edges 32–34 (`EP → PA → RS → EP` with `pause / stop`, `handoff.md`, `rehydrate + drift check`); class line 49 includes PA/RS; subgraph 15 / end 44 |
| Cross-cutting paragraph after 2.4 | PASS | Lines 76–81, after the 2.4 paragraph (70–74) |
| 19 skill table rows with working links | PASS | Rows 92–110 = 19; every link target exists; `node scripts/check-links.mjs` → 32 references, OK, exit 0 |
| No false claim that pause is a loop step or a status | PASS | Table rows say "Cross-cutting"; paragraph says "it is not a fourth status"; PA/RS are unnumbered graph nodes |
| No stale 17-skill counts on either active doc | PASS | `rg "17"` finds only the Mermaid color `#f57f17` at `skills/index.md:47`; no count |
| Only these two files changed by this sub-task | PASS | `git status`: `AGENTS.md` and `skills/index.md` modified; 2.1 skill edits and plan artifacts are separate |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] Medium:** none.
- **[P3] Low:** none.

### Validation Results

- `node scripts/check-links.mjs` → scanned markdown, 32 references checked, "OK — no dead references in the active surface", exit 0.
- `AGENTS.md` skill list: 19 names counted; `skills/index.md` table: 19 rows; `skills/` has 19 skill directories (plus `index.md`).
- Mermaid: one `subgraph` and one matching `end`; PA/RS declared and classed; the three pause/resume edges are present.
- Counts: `AGENTS.md` 12, 83, 90, 104, 114; `skills/index.md` 3, 88; no stale 17 counts except the color.
- Scope: only `AGENTS.md` and `skills/index.md` belong to 2.2; the 2.1 skill edits and plan artifacts predate it.
- Secrets: no secrets/tokens/credentials in the diff (documentation only).
- Not run: full QA gate (Sub-Task 4.2); `pnpm test` still reflects the 17-skill inventory until Sub-Tasks 3.1/3.2.

### Regression Risk and Sequencing

- Documentation-only; no runtime, parser, status-model, MCP, or config change.
- The docs now correctly describe 19 skills while the runtime/script inventory (`EXPECTED_SKILL_COUNT`, install/pack smoke checks) is still 17 by design. Sub-Task 3.1 owns that update; this is a phase-sequencing dependency, not a 2.2 defect.
- The Mermaid graph keeps the pause/resume cycle readable and does not renumber loop steps.

### Scope Compliance

- In scope: `AGENTS.md` and `skills/index.md` — verified.
- Out of scope detected: none in implementation files. `skills/dh-execute-plan*/` changes are Sub-Task 2.1; `docs/plans/**` and the index row are plan artifacts.
- Secrets/tokens/credentials found in the diff: none.

### Suggested Next Steps

- [ ] Proceed to Sub-Tasks 3.1/3.2 to move the runtime, scripts, and tests from 17 to 19 skills; the docs are already aligned.
- [ ] Keep `check-links.mjs` in the Sub-Task 4.2 gate (it passes now).
- [ ] No changes needed for 2.2.

---

## Sub-Task Review: 3.1 — Update runtime and script inventory to 19 skills

**Reviewed against:** Sub-Task 3.1 (plan.md, Phase 3)
**Scope:** `src/cli/plugin-artifact.ts`, `scripts/lib/shared.mjs`, `scripts/lib/install-smoke-checks.mjs`, `scripts/lib/pack-install.mjs`, `scripts/smoke-pack.mjs`, `scripts/docker-test.sh`, `scripts/lib/pack-contract.mjs`, plus the justified residuals `src/plugin.ts` (header comment) and `skills/dh-pause-plan/references/handoff-template.md` (generic risk). Tests and docs remain 3.2/3.3 work.
**Overall risk:** Low
**Verdict:** Approve

### Acceptance Criteria Verification

| Criterion | Status | Evidence |
|---|---|---|
| `EXPECTED_SKILL_COUNT` is 19; error message derives from the constant | PASS | `src/cli/plugin-artifact.ts:34`; the failure text at 143–145 interpolates `EXPECTED_AGENT_COUNT`/`EXPECTED_SKILL_COUNT`; no `17` remains in the file |
| `LOOP.skills` has 19 entries, includes `dh-pause-plan`/`dh-resume-plan`, alphabetically sorted | PASS | `scripts/lib/shared.mjs:28-49`; programmatic check: count 19, sorted `true`, includes both, matches the 19 skill directories exactly |
| `install-smoke-checks.mjs` updated | PASS | Comment `44`; label/condition `61` (`19 skill directories`); return condition `67` (`19`) |
| `pack-install.mjs` updated | PASS | Line `185`: `installed dist/assets has 19 skills`, condition `19` |
| `smoke-pack.mjs` comments/labels/condition/failure message updated | PASS | Comments `10`, `18`; condition `67` (`source.skills.length === 19 && skillCount === 19`); message `68` (`skillCount !== 19`) |
| `docker-test.sh` expects 7/19 | PASS | Lines `244–245`: condition `skills.length !== 19`; error text `expected 7/19` |
| `pack-contract.mjs` comment is 19 | PASS | Line `34`: "7 agents and 19 skill directories" |
| `src/plugin.ts` header says 19 | PASS | Line `4`: "(7 agents, 19 skills)" |
| No checks weakened or removed | PASS | Diff is numeric/comment-only; the same assertions and failure paths remain |
| Handoff template 199 lines, contract-valid, no stale 17/repo-specific claim | PASS | `wc -l` = 199; example frontmatter parses with 19 keys (`handoff_version: 1`, `status: paused`, `resumed_at: null`); 11/11 sections; `rg "\b17\b"` = 0; risk line is the generic `dh` MCP-server risk |
| No stale 17-skill claims in the touched files | PASS | `rg "17"` across all nine files → no hits; the only remaining non-test 17 in `scripts/`/`src/` is the unrelated `src/cli/jsonc.ts:32` `TOKEN_EOF = 17` |
| No tests or active docs changed in 3.1; note expected temporary test failure | PASS (noted) | No test files and no README/LOADING/AGENTS/index changes in the 3.1 diff; the handoff template is the justified 3.1 residual. Tests still assert 17 in `registration.test.ts`, `assets.test.ts`, `frontmatter.test.ts`, `plugin-artifact.test.ts`, `install-command.test.ts`, and `install-harness.ts`; Sub-Task 3.2 owns the 19/26 updates, so `pnpm test` is expected to fail until then |
| Typecheck/biome/shell syntax evidence | PASS | `pnpm typecheck` → exit 0; `pnpm lint:biome` → exit 0 (5 warnings/11 infos in pre-existing files; targeted check of the seven changed JS/TS files → 0 issues); `bash -n scripts/docker-test.sh` → exit 0 |
| Only expected files changed | PASS | `git status`: the nine 3.1 files; `AGENTS.md`/`skills/index.md` are 2.2; `dh-execute-plan*` are 2.1; `docs/plans/**` are plan artifacts; no `dist/` changes |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] Medium:** none.
- **[P3] Low:** none.

### Validation Results

- `src/cli/plugin-artifact.ts`: `EXPECTED_SKILL_COUNT = 19`; failure message derived from the constants; `rg "17"` → 0 hits.
- `scripts/lib/shared.mjs`: `LOOP.skills` count 19, sorted, exact match with the 19 skill directories; includes `dh-pause-plan` and `dh-resume-plan`.
- `scripts/lib/install-smoke-checks.mjs`: comment, label, condition, and return all 19.
- `scripts/lib/pack-install.mjs`: label and condition 19.
- `scripts/smoke-pack.mjs`: comments, condition, and failure message 19.
- `scripts/docker-test.sh`: 7/19 condition and message; `bash -n` passes.
- `scripts/lib/pack-contract.mjs`: comment 19; source inventory remains dynamic.
- `src/plugin.ts`: header 19.
- Handoff template: 199 lines; 19 frontmatter keys; 11 sections; example parses; no `17` or stale repo/phase claim.
- `pnpm typecheck` → 0; targeted Biome on the changed files → 0 issues; full Biome exits 0 with pre-existing warnings elsewhere.
- Expected temporary failure: `pnpm test` still sees 17-skill assertions in the test files (3.2); not run/considered a 3.1 defect.

### Regression Risk and Sequencing

- Low: the runtime/script changes are numeric/comment-only; no assertion was removed or weakened. `LOOP.skills` now matches the 19 real skill directories.
- The runtime is aligned at 19 while the test suite remains at 17 by design; Sub-Task 3.2 must land the test updates before the full QA gate (4.2).
- `dist/` was not rebuilt in this sub-task (out of scope); the installer/smoke checks will exercise 19 after the build in 4.2.
- `README.md`, `docs/LOADING.md`, and `opencode.example.jsonc` may still carry 17 counts — Sub-Task 3.3 owns those; they are not in the 3.1 touched set.

### Scope Compliance

- In scope: the nine listed files — verified. The handoff template is the explicitly justified residual under `skills/dh-pause-plan/references/`.
- Out of scope detected: none. No tests, active docs, `dist/`, or unrelated scripts changed.
- Secrets/tokens/credentials found in the diff: none.

### Suggested Next Steps

- [ ] Proceed to Sub-Task 3.2: update the test inventories to 19 (and 24→26 name sets) and add the handoff contract test; `pnpm test` should pass after that.
- [ ] Sub-Task 3.3: clear the remaining 17 claims in `README.md`, `docs/LOADING.md`, and `opencode.example.jsonc`.
- [ ] Sub-Task 4.2: rebuild `dist/`, then run the full QA gate (`pnpm qa:check:full`) and the 7/19 Docker smoke.

---

## Sub-Task Review: 3.2 — Update tests and add the handoff contract test

**Reviewed against:** Sub-Task 3.2 (plan.md, Phase 3)
**Scope:** `src/__tests__/registration.test.ts`, `assets.test.ts`, `frontmatter.test.ts`, `src/cli/__tests__/plugin-artifact.test.ts`, `install-command.test.ts`, `helpers/install-harness.ts`, and the new `src/__tests__/handoff-contract.test.ts`. No template/skill/runtime/doc changes in this sub-task.
**Overall risk:** Low
**Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criterion | Status | Evidence |
|---|---|---|
| 17→19 inventory assertions/comments; no stale 17; set sizes 26 | PASS | `rg "17|24"` across the seven test files → 0 hits; `19`/`26` at `registration.test.ts:4,71,91`; `assets.test.ts:6,66,67,77`; `frontmatter.test.ts:40,42,62`; `plugin-artifact.test.ts:187,191`; `install-command.test.ts:58`; `install-harness.ts:4,18` |
| Contract test reads the real template and both skills | PASS | `handoff-contract.test.ts:16-19,93-97` reads `handoff-template.md`, both `SKILL.md` files, and parses all three |
| All 19 required frontmatter keys | PASS | `REQUIRED_KEYS` 21–41 (19); exact `Object.keys(data).sort()` equality at 100–102 — catches key removal from the worked example |
| All 11 sections | PASS | `REQUIRED_SECTIONS` 43–55; loop at 116–120 — catches heading removal from the worked example |
| Version 1 | PASS | `data.handoff_version === 1` at 105 |
| Paused/resumed lifecycle fields | PASS | `status: paused`, `resumed_at: null` at 106–107; history events include `resumed`/`re-paused` at 122–136; resume markers include `status: resumed`/`resumed_at` at 59–68 |
| Pause History columns/event vocabulary | PASS | 122–136: header `Timestamp | Event | Position | Note`; event set equals `paused`, `resumed`, `re-paused` |
| `next_action` ↔ Next Steps step 1 | PASS | 138–140 with `firstNextStep` (86–91) |
| Both skill frontmatters/names/references | PASS | 144–149: both frontmatters parse, names are `dh-pause-plan`/`dh-resume-plan`, both reference `handoff-template.md` |
| Pause/resume workflow markers | PASS | `PAUSE_MARKERS` 58 / `RESUME_MARKERS` 59–68; assertions 151–159; includes plan read, hash, paused/resumed status, ancestry, conflicts, delegation |
| `PHASE_STATUSES` exactly `Pending | In Progress | Completed`, no `Paused` | PASS | 162–167: `toEqual`, length 3, `not.toContain('Paused')` |
| Assertions structural, not brittle prose snapshots | PARTIAL | Section/key/marker checks are structural; the Pause History row selector is tied to the literal `2026-` prefix (P3 below) |
| Contract test ≤300 lines | PASS | 172 lines (`wc -l`) |
| Would fail if a required field/section were removed | PARTIAL | Removing a key or heading from the worked example fails (100–102, 116–120); removing a row from `## Frontmatter fields` or a bullet from `## Required sections` while leaving the example intact would not (P2 below) |
| No template/skill/runtime/doc changes in 3.2 | PASS | 3.2 diff is the seven test files + the new contract test; template/skills/runtime/docs changes are 1.x/2.x/3.1/3.3 |
| Test does not weaken or skip checks | PASS | No `skip`/`todo` in the 3.2 files; existing count assertions were raised, not removed |
| Evidence claims: build, targeted 85, full 668, typecheck, Biome | PASS | Verified: targeted 6 files → 85/85; full `pnpm test` → 40 files / 668/668; `pnpm typecheck` → 0; Biome full exit 0 (5 warnings/11 infos pre-existing), targeted changed files exit 0 with 2 pre-existing infos. `dist/assets/skills` has 19 dirs and the built-bundle registration test passes, so the `pnpm build` claim is consistent (build not re-run in review to avoid touching `dist/`) |
| No out-of-scope changes | PASS | Only test files + the new test belong to 3.2; the other working-tree changes are 2.1/2.2/3.1/plan artifacts |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.

#### [P2] Contract test guards the worked example, not the template's field table / required-sections list

- **Location:** `src/__tests__/handoff-contract.test.ts:100-120`
- **Why it matters:** The test asserts the 19 keys and 11 sections from the worked example only. It never parses the authoritative `## Frontmatter fields` table (template lines 31–50) or the `## Required sections` bullet list (lines 54–64). Deleting a field row (e.g. `plan_sha256`) or a required-section bullet while leaving the example intact would pass, even though the plan's 3.2 Acceptance Criteria says "deleting a required template field/section fails the contract test." The same applies in reverse: adding a table/list entry without updating the example would pass.
- **Evidence:** `templateText` is used only by `workedExample()` (79–84) and `countLines()` (169–171); `REQUIRED_KEYS`/`REQUIRED_SECTIONS` are hardcoded and compared to `data`/`body` (100–120). No code reads the table rows or the required-sections bullets.
- **Fix:** Parse the table rows (`^\| \`([a-z_0-9]+)\` \|`) and the required-section bullets (`^- \`## (.+)\``) from the real template and assert both equal `REQUIRED_KEYS`/`REQUIRED_SECTIONS` (and the worked example). This stays structural and closes the table/list drift.

### [P3] Low

#### [P3] Template line-limit assertion uses 250, not the 1.1 reference cap of 200

- **Location:** `src/__tests__/handoff-contract.test.ts:169-171`
- **Why it matters:** The 1.1 contract caps the handoff reference at ≤200 lines (template currently 199). The test allows up to 250 (the SKILL.md audit limit), so a future edit growing the template to 201–250 would pass this guard while violating the 1.1 limit.
- **Evidence:** `countLines(templateText)` → 199; assertion is `toBeLessThanOrEqual(250)`.
- **Fix:** Assert `≤200` (or state in the test why 250 is intentional if the 200 cap is being relaxed).

#### [P3] Pause History rows are selected by a literal `2026-` date prefix

- **Location:** `src/__tests__/handoff-contract.test.ts:133`
- **Why it matters:** The event-vocabulary check filters rows with `/^\| 2026-/`. If the worked example's dates are updated (e.g., to 2027), the test fails even though the `paused`/`resumed`/`re-paused` vocabulary is unchanged — a fixture brittleness rather than a contract change.
- **Evidence:** Row filter at 133; the template's example rows happen to use 2026. The header/separator can be filtered structurally instead.
- **Fix:** Select all table body rows after the separator (e.g., lines starting `|` that are not the header or `|---`), independent of the year.

### Validation Results

- New contract test: `src/__tests__/handoff-contract.test.ts` → 10/10 passed.
- Targeted suite: `registration`, `assets`, `frontmatter`, `handoff-contract`, `plugin-artifact`, `install-command` → 6 files, 85/85 passed.
- Full suite: `pnpm test` → 40 files, 668/668 passed.
- `pnpm typecheck` → exit 0.
- `pnpm lint:biome` → exit 0 (5 warnings/11 infos in pre-existing files); targeted Biome on the seven changed test files → exit 0 with 2 pre-existing infos in `frontmatter.test.ts` (`data['permission']`/`data['tools']`).
- `dist/assets/skills` → 19 skill directories + `index.md`; the built-bundle registration test passes, consistent with the reported `pnpm build`.
- No skipped/todo tests in the 3.2 files; no template/skill/runtime/doc changes in 3.2.
- Not run: full QA gate (4.2); `pnpm build` not re-run in review to avoid modifying `dist/`.

### Regression Risk and Sequencing

- Test-only change; no runtime/template/doc behavior affected. Existing plan/parser tests keep their behavior (full suite green).
- The P2 table/list gap is a contract-test coverage improvement, not a current failure; the worked example, skill markers, and three-status model are guarded today.
- 3.3 still owns the remaining README/LOADING/opencode.example.jsonc 17 claims; 4.2 owns the rebuilt full gate.

### Scope Compliance

- In scope: the seven test files and the new contract test — verified.
- Out of scope detected: none. No template/skill/runtime/doc changes in 3.2; `dist/`, README, LOADING, and the example config are untouched by this sub-task.
- Secrets/tokens/credentials found in the diff: none.

### Suggested Next Steps

- [ ] Add the template table/list assertions (P2) before considering the contract fully guarded.
- [ ] Align the template line cap to 200 and make the Pause History row filter structural (P3s).
- [ ] Proceed to Sub-Task 3.3 (remaining 17 claims) and 4.2 (rebuild + full QA gate).

---

## Sub-Task Re-Review: 3.2 — Update tests and add the handoff contract test (after fixes)

**Reviewed against:** Sub-Task 3.2 (plan.md, Phase 3) — re-review after fixes to `src/__tests__/handoff-contract.test.ts` (192 lines, 11 tests)
**Scope:** only `src/__tests__/handoff-contract.test.ts` changed in the fix; the other 3.2 test files, template, skills, runtime, and docs are unchanged by it.
**Overall risk:** Low
**Verdict:** Approve

### Prior Findings Disposition

| Finding | Status | Evidence |
|---|---|---|
| [P2] Contract test guarded only the worked example, not the template's field table / required-sections list | FIXED | `documentedFields` (93–96) parses the `## Frontmatter fields` table; `documentedSections` (98–101) parses the `## Required sections` bullets; the new assertion (110–113) compares both to `REQUIRED_KEYS`/`REQUIRED_SECTIONS`. Read-only negative-case simulation: 19 fields/11 sections parsed; removing a field row yields 18, removing a section bullet yields 10 — the sorted `toEqual` would fail in both cases |
| [P3] Template line cap was 250 vs the 1.1 reference cap | FIXED | Line 190: `toBeLessThanOrEqual(200)`; template is 199 lines |
| [P3] Pause History rows were selected by a literal `2026-` prefix | FIXED | Lines 137–155 find the header, take the contiguous table lines after it, filter the separator, and derive the event set; no date prefix |

### Remaining Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] Medium:** none.
- **[P3] Low:** none.

### Re-Validation

- Targeted contract test: `src/__tests__/handoff-contract.test.ts` → 11/11 passed.
- Full suite: `pnpm test` → 40 files, 669/669 passed (the 11-test contract file accounts for the one-test increase over the prior 668).
- `pnpm typecheck` → exit 0.
- `pnpm exec biome check src/__tests__/handoff-contract.test.ts` → clean (exit 0).
- No regressions: the worked-example key/section/lifecycle/history/next_action assertions (115–160), both skill frontmatter/name/reference + marker checks (163–179), and the three-status/no-`Paused` guard (182–187) remain.
- File size: 192 lines ≤220; no template/skill/runtime/doc changes in the fix; no out-of-scope changes.
- Negative-case evidence: read-only simulation on the real template — documented fields 19 (remove one row → 18), documented sections 11 (remove one bullet → 10); the new `toEqual` assertions would fail, satisfying the 3.2 "deleting a required field/section fails" criterion.
- Not run in re-review: `pnpm build` (avoid touching `dist/`) and the full QA gate (4.2); the full Vitest suite is green.

### Verdict

**Approve.** All prior findings are fixed and no regressions were found. The contract test now guards both the worked example and the template's authoritative field/section lists.

---

## Sub-Task Review: 3.3 — Update documentation counts and tables

**Reviewed against:** Sub-Task 3.3 (plan.md, Phase 3)
**Scope:** `README.md`, `docs/LOADING.md`, `opencode.example.jsonc`, and `demo-project/docs/index.md`. No code or test changes in this sub-task.
**Overall risk:** Low
**Verdict:** Approve

### Acceptance Criteria Verification

| Criterion | Status | Evidence |
|---|---|---|
| All active-surface 17-skill claims are 19 in these four files | PASS | README lines 3, 9, 112, 193, 269; LOADING lines 27, 176, 256, 306; opencode line 40; demo lines 15, 29, 64. `rg "17"` across the four files → 0 hits |
| README Skills table has 19 rows and adds `dh-pause-plan` + `dh-resume-plan` with accurate roles | PASS | 19 `dh-*` rows counted; pause row 216 ("Snapshots an active plan into `docs/plans/<slug>/handoff.md` without changing statuses or code"), resume row 217 ("Validates a handoff, detects drift, rehydrates context, and resumes execution via `dh-execute-plan`") |
| README Agents table remains 7 | PASS | 7 `dh-*` rows counted in the Agents table |
| README pause/resume paragraph accurate; no false loop-step claim | PASS | Line 146: handoff sidecar, no plan-status change, drift detection/rehydration, resume marks the handoff `resumed`, re-enters step 2; `dh-execute-plan` redirects; "not a fourth status". It is labeled cross-cutting and is not numbered as a loop step |
| Demo doc no longer carries the stale `181 tests` count and reads naturally | PASS | `rg "181"` → 0; line 29 now says "harness test suite (in-process registration of the 7 agents / 19 skills; the tools come from the `dh` MCP server wired in `opencode.jsonc`)" |
| No historical `docs/plans/**`, `reports/**`, or `docs/evolve/**` rewritten | PASS | Only the four target files changed for 3.3; `docs/plans/index.md` keeps its historical "17 skills" audit row untouched; no `reports/` or `docs/evolve/` changes |
| `node scripts/check-links.mjs` passes | PASS | 32 references checked; "OK — no dead references in the active surface"; exit 0 |
| No stale 17-skill claim on the active surface | PASS | Four target files → 0. The only remaining 17s are the historical `docs/plans/index.md:7` row (out of scope) and the allowed Mermaid color `#f57f17` (`skills/index.md:47`) |
| Only the four files changed; no code/test | PASS | 3.3 diff: README (+9/−5), demo (+4/−4), LOADING (+4/−4), opencode (+1/−1); other working-tree changes are 1.x/2.x/3.1/3.2 edits and plan artifacts |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] Medium:** none.
- **[P3] Low:** none.

### Validation Results

- `rg "17"` in README, LOADING, opencode.example.jsonc, demo-project/docs/index.md → 0 hits.
- `rg "19"` confirms README 3/9/112/193/269; LOADING 27/176/256/306; opencode 40; demo 15/29/64.
- README Skills table: 19 rows; Agents table: 7 rows.
- `rg "181"` in the four files → 0 hits.
- `node scripts/check-links.mjs` → 32 references, OK, exit 0.
- Active-surface 17s outside the four files: `docs/plans/index.md:7` (historical audit row, out of scope) and `skills/index.md:47` (Mermaid color, explicitly allowed).
- Historical records: `docs/plans/index.md` historical rows were not edited; no `reports/` or `docs/evolve/` changes.
- 3.3 diff: README, demo doc, LOADING, and the example config only; no `src/`, `scripts/`, or test changes.

### Regression Risk and Cross-Task Note

- Documentation-only; no runtime, parser, status-model, MCP, or config change.
- The open 2.1 P3 (loop 2.4 pause recommendation) is unchanged: README's 2.4 summary still says only "the loop stops and asks the user for guidance." It is not a 3.3 count/link defect, but the final review should decide whether to close that cross-task note.
- The historical `docs/plans/index.md:7` 17-skill row remains by design (3.3 explicitly excludes historical plans/reports).

### Scope Compliance

- In scope: the four target files — verified.
- Out of scope detected: none. `AGENTS.md`, `skills/index.md`, the skill files, scripts, tests, and `docs/plans/**` are earlier sub-task/plan artifacts, not 3.3 changes.
- Secrets/tokens/credentials found in the diff: none.

### Suggested Next Steps

- [ ] Proceed to Sub-Task 4.2 (full QA gate + artifact checks) and 4.3 (final review/sign-off).
- [ ] At final review, decide whether to close the open 2.1 P3 about the loop 2.4 pause recommendation; it is unchanged by 3.3.

---

## Sub-Task Review: 4.1 — Rehearse pause, drift, and resume end-to-end

**Reviewed against:** Sub-Task 4.1 (plan.md, Phase 4)
**Scope:** `docs/plans/pause-resume-plan-skills/tasks/rehearsal.md` (new) plus the four ambiguity clarifications in `skills/dh-pause-plan/SKILL.md`, `skills/dh-pause-plan/references/handoff-template.md`, and `skills/dh-resume-plan/SKILL.md`. No production code/test changes.
**Overall risk:** Low
**Verdict:** Approve with comments

### Acceptance Criteria Verification

| Criterion | Status | Evidence |
|---|---|---|
| Scenarios: clean pause, re-pause, plan-hash drift, branch drift, HEAD drift touching recorded work, clean resume, already-resumed, non-git | PASS | Scenario table `32-42` covers A, B, C, D, E, E2, F, G, H; each has Expected/Observed/Result = PASS and key evidence at `46-165` |
| Pause assertions: plan hash/HEAD/commit count/statuses unchanged; no stash/reset/checkout; handoff valid (19 keys/11 sections/paused row) | PASS | `46-66`: HEAD unchanged, plan SHA unchanged, commit count 1, no stash, only new path `handoff.md`, 19 keys, 11 sections, one `paused` row; no reset/checkout in the pause steps |
| Resume assertions: material drift stops/asks and leaves handoff paused; clean resume marks `resumed`/`resumed_at`/history and leaves plan statuses/hash unchanged; already-resumed reports consumed; non-git is unverifiable + ask | PASS | C `78-92`, D `94-102`, E `104-124` (`handoff_status: paused`); F `126-141` (`status: resumed`, `resumed_at`, 4 rows, delegation, plan unchanged); G `143-149` (consumed, hashes identical); H `151-165` (nulls, unverifiable, ask, handoff paused) |
| Clarifications: handoff/`*.tmp` exclusion + `worktree_dirty`; re-pause changeable/preserved sections; Snapshot audit retention; plan-hash override | PASS (text) / PARTIAL (evidence) | Pause `105-108` (exclusion, `worktree_dirty: false` when only handoff), `140-146` (uncommitted list, re-pause regenerates changeable sections while preserving `created`/history/`Work Completed`/`Decisions`); template `39,51,55,65-72` (field/list, Snapshot retained after resume, resume changes only status/resumed_at/updated/history); resume `101-103` (plan-hash mismatch material, overrides explainable for `plan.md`), `158-162` (no Snapshot rewrite). Evidence gaps noted as P3 below |
| Template ≤200 lines, contract fields/sections unchanged; pause/resume skills ≤250; contract test passes | PASS | Template 199 lines (cap 200); pause 230, resume 212 (cap 250); `handoff-contract.test.ts` 11/11; typecheck exit 0 |
| No secrets or full diffs in evidence; no production code/tests changed by the rehearsal; only the evidence file was added | PASS | Secret/diff-marker grep → no hits; 4.1 changes are the rehearsal file + the four skill/template clarifications; no `src/`/`scripts/` 4.1 changes. Evidence file is currently untracked (P3) |
| Any unresolved ambiguity deferred with rationale | PARTIAL | The four ambiguities are resolved in the skills/template; the method deviation is disclosed at `185-190`; the rehearsal's ambiguity text is still present-tense as if unresolved (P3) |
| Plan's 4.1 setup calls for a phased plan **and SDD** | PARTIAL | `plan.md:230` says "with a phased plan and SDD"; the rehearsal setup (`19-24`) lists `plan.md` and `src/feature.txt` but no `sdd.md` (P3) |

### Findings

- **[P0] Blocking:** none.
- **[P1] High:** none.
- **[P2] Medium:** none.

#### [P3] Rehearsal ambiguity notes are now stale against the updated skills/template

- **Location:** `docs/plans/pause-resume-plan-skills/tasks/rehearsal.md:169-184`
- **Why it matters:** Items 1–3 still say the template/pause skill "does not say" the Snapshot-retention, handoff/`*.tmp` exclusion, or re-pause body policy, but those clarifications now exist: pause `105-108,143-146`; template `39,51,55,65-72`; resume `101-103,158-162`. A reader cannot tell the ambiguities were resolved, which conflicts with the requirement to defer or resolve each ambiguity explicitly.
- **Evidence:** Rehearsal `169-184`; the updated clarifications above. Item 4 (drift overlap) is handled by the resume plan-hash override; item 5 (method) is disclosed.
- **Fix:** Add a "Resolved by" reference/status per item (or a status column) and keep the method deviation disclosed with its rationale.

#### [P3] Clarifications are stated but not all are demonstrated in the evidence

- **Location:** `docs/plans/pause-resume-plan-skills/tasks/rehearsal.md:46-76,114-124,151-165`; pause `105-108,143-146`; template `39,55`
- **Why it matters:** The rehearsal has no case where the handoff is the only untracked path (`worktree_dirty: false`), no `*.tmp` exclusion evidence, the A snippet does not show the frontmatter `worktree_dirty` value, and the B re-pause shows `created`/history but not the preserved `## Work Completed`/`## Decisions and Rationale`. The text is correct, but the rehearsal does not prove those clarified branches.
- **Evidence:** A records `src/feature.txt` + `notes-wip.md` (so `worktree_dirty` is true); B shows only `created`/`updated`/history; E2 shows `worktree_dirty: true`; H is non-git. No only-handoff or `*.tmp` case.
- **Fix:** Add a short handoff-only/`*.tmp` assertion and show the re-pause `Work Completed`/`Decisions` preservation (or explicitly state they were verified).

#### [P3] The plan-specified scratch SDD is not present or disclosed

- **Location:** `docs/plans/pause-resume-plan-skills/tasks/rehearsal.md:19-24` vs `plan.md:230`
- **Why it matters:** Sub-Task 4.1's In Scope says the scratch workspace includes "a phased plan and SDD"; the setup lists only `plan.md` and `src/feature.txt`. The pause skill's Step 2 SDD evidence path (`## Decisions and Rationale` / binding ids) is therefore not exercised, and the omission is not in the Ambiguities section.
- **Evidence:** Plan line 230; rehearsal setup 19–24; no `sdd.md` mention.
- **Fix:** Add an `sdd.md` fixture and a pause assertion for the SDD binding ids, or explicitly disclose the omission and rationale.

#### [P3] Evidence file is untracked while the sub-task's Done When requires it committed

- **Location:** `docs/plans/pause-resume-plan-skills/tasks/rehearsal.md` (untracked); `plan.md:237`
- **Why it matters:** The plan's Done When is "Evidence is committed and all scenarios pass." The file is present and complete, but `git ls-files` does not know it; the 4.1 status is still In Progress. This is a commit/sequence step, not an evidence defect.
- **Evidence:** `git status` shows `?? docs/plans/pause-resume-plan-skills/`; `git ls-files --error-unmatch` fails for the evidence file.
- **Fix:** Commit the evidence file with the plan artifacts (and update the plan status) before marking 4.1 complete.

### Validation Results

- Rehearsal file: 195 lines; scenario table A–H all PASS; key evidence includes statuses, hashes, history, and commit ids.
- Secret/diff-marker grep on the rehearsal → no hits; no full diffs or contents; scratch workspaces cleaned.
- Pause skill 230 lines; resume skill 212; template 199; contract test 11/11; `pnpm typecheck` exit 0.
- Clarifications verified: pause `105-108,143-146`; template `39,51,55,65-72`; resume `101-103,158-162`.
- No production code/test changes for 4.1; only the evidence file (new) and the four skill/template clarifications. The other working-tree changes are 1.x/2.x/3.1/3.2/3.3 artifacts.

### Regression Risk and Cross-Task Note

- Low: the rehearsed behaviors are documented and the clarifications are text-only; no runtime/code change. The P3s are evidence/documentation completeness, not behavioral failures.
- The evidence file's ambiguity section should be updated to show the four resolutions; otherwise a reader may think the contract is still ambiguous.
- The open 2.1 P3 (loop 2.4 pause recommendation) remains unchanged and is still for final review disposition.

### Scope Compliance

- In scope: the rehearsal evidence file and the four ambiguity clarifications — verified.
- Out of scope detected: none. No production code/tests changed by the rehearsal; no secrets; the scratch commits/workspace are disposable.
- Secrets/tokens/credentials found in the evidence: none.

### Suggested Next Steps

- [ ] Mark the four ambiguities resolved in the rehearsal file (or add a resolution column), and add the handoff-only/`*.tmp` + re-pause-body assertions.
- [ ] Add/mention the SDD fixture (or disclose its omission).
- [ ] Commit the evidence file with the plan artifacts, then proceed to Sub-Task 4.2 and 4.3.

---

## Final Plan Review

**Plan:** `pause-resume-plan-skills` · **Branch:** `feature/pause-resume-plan-skills`
**Range reviewed:** `ef87c61...HEAD` (`701007d` feature, `0000726` audit refresh, `7be0da4` QA/release evidence) plus the working tree
**Review date:** 2026-11-07
**Overall risk:** Low–Medium
**Verdict: Approve with comments**

This is the binding plan-level sign-off. There are **no P0/P1 findings**. One non-blocking P2 (worktree
content-dirtiness is not fingerprinted) and several P3 polish/evidence items are recorded below. The plan
meets R1–R12 and AC1–AC12; the only non-green QA step is the documented, user-accepted `scan:deps`
exception.

### Status consistency

| Phase | Plan status | Sub-tasks | Review status |
|---|---|---|---|
| Phase 1 — Handoff contract and skill authoring | Completed | 1.1, 1.2, 1.3 Completed | 1.1, 1.2 (+re-review), 1.3 (+re-review) approved; template 199 lines, both skills valid |
| Phase 2 — Harness workflow integration | Completed | 2.1, 2.2 Completed | 2.1 and 2.2 approved; the 2.1 P3 (loop 2.4 pause note) is now closed |
| Phase 3 — Inventory and automated enforcement | Completed | 3.1, 3.2, 3.3 Completed | 3.1 approved; 3.2 re-review approved; 3.3 approved |
| Phase 4 — Validation and release readiness | **In Progress** | 4.1, 4.2 Completed; 4.3 **In Progress** (this review) | Rehearsal and QA evidence complete; this review is the final gate |

- No status inconsistency: Phase 1–3 are `Completed`; Phase 4 remains `In Progress` until 4.3 closes.
- Plan frontmatter (`plan.md:7`) and the `docs/plans/index.md:10` row are still `Pending`. That is the
  required pre-sign-off state; both must be flipped to `Completed` in the sign-off commit after this
  verdict. This review does not modify them.
- Diff scope is clean: no `package.json`/`pnpm-lock.yaml`, parser, `PHASE_STATUSES`, MCP tool, commands,
  or prompts changed.
- Disclosed deviations (accepted, non-blocking): the 4.1 rehearsal used a local helper rather than an
  agent runner and omitted the scratch `sdd.md` fixture, exercising the absent-SDD path
  (`tasks/rehearsal.md:26-31,213-219`). The behavior evidence is still complete for A–H.

### Requirements coverage

| ID | Result | Evidence |
|---|---|---|
| R1 — `dh-pause-plan` triggers + safe workflow | PASS | `skills/dh-pause-plan/SKILL.md:2-14` (pause/suspend/stop/end-session/handoff/save-progress triggers), Steps 0–5 at 55–191 |
| R2 — `dh-resume-plan` triggers + validated workflow | PASS | `skills/dh-resume-plan/SKILL.md:2-14`, Steps 0–5 at 51–169 |
| R3 — versioned `handoff.md` beside `plan.md` | PASS | Template 19 fields / 11 sections at `skills/dh-pause-plan/references/handoff-template.md:27-61`; path contract 3–14 |
| R4 — pause read-only, idempotent, history-preserving | PASS | Core rules 30–51; no status/commit/stash/reset/checkout/branch mutation; re-pause 143–152; rehearsal A/B and post-clarification (c) |
| R5 — resume validates and detects material drift | PASS with P2 comment | Version/slug/fields/sections/status at 65–80; branch/ancestry/worktree/plan-hash/conflicts at 82–116. Worktree drift is path-level only — see the P2 below |
| R6 — plan truth, rehydrate, consume, delegate | PASS | Reconcile 118–133; summary 135–149; consume only after availability check at 151–166 |
| R7 — execute-plan guard + task pause recommendations | PASS | `skills/dh-execute-plan/SKILL.md:23,43,105,112`; `skills/dh-execute-plan-task/SKILL.md:79,122,161` |
| R8 — no `Paused` status/parser/MCP change | PASS | `src/tools/plan-lifecycle.ts:21` still exactly 3 statuses; no `src/mcp` diff; contract test 182–187 |
| R9 — 17 → 19 inventory everywhere | PASS | `src/cli/plugin-artifact.ts:34`, `scripts/lib/shared.mjs:28-49`, smoke/install/pack/docker scripts, tests, AGENTS/README/LOADING/index/audit; stale-count grep is zero on the active surface |
| R10 — automated handoff contract test | PASS | `src/__tests__/handoff-contract.test.ts` 192 lines / 11 tests; parses the real template table and required-sections list (93–113), example (115–160), both skills (163–180), 3-status guard (182–187) |
| R11 — rehearsal + full QA gate | PASS with accepted exception | `tasks/rehearsal.md` A–H + post-clarification checks; `tasks/qa-gate.md`; only `scan:deps` is non-green (documented/accepted) |
| R12 — docs + plans index | PASS | `AGENTS.md:12-16,51-57`, `README.md:3,9,146,213-218`, `skills/index.md:3-5,20-34,76-81,88-110`, `docs/LOADING.md`, `opencode.example.jsonc`; plan row `docs/plans/index.md:10` (Pending until sign-off) |

### Acceptance criteria coverage

| AC | Result | Evidence |
|---|---|---|
| AC1 — pause creates the versioned handoff; plan byte-identical; no commit/stash/reset/checkout | PASS | Rehearsal A (46–71); skill Step 4 hash comparison 160–170; Core Rules 32–35 |
| AC2 — re-pause refreshes + appends history, preserving rows | PASS | Rehearsal B (73–81) and E2 (119–129); skill 143–152 |
| AC3 — no secrets/diffs/contents; paths only | PASS | Template safety 77–90; pause 36–41, 140–142; audit 0 high-signature; no secret-like values in the diff |
| AC4 — clean resume validates, summarizes, marks resumed, delegates | PASS | Rehearsal F (131–146); resume 135–166 |
| AC5 — branch/HEAD/plan-hash drift stops; no destructive git | PASS | Rehearsal C/D/E (83–129); resume 82–116 and 31–33. (Path-level worktree caveat: P2) |
| AC6 — already-resumed reports consumed | PASS (explicit slug) | Rehearsal G (148–154); resume Step 0.3 (61–63). P3: a no-argument scan reports “none” rather than the consumed handoff |
| AC7 — multiple paused asks; non-git pauses/resumes with warning | PASS | Resume 55–60, 109–112, 185–186; Rehearsal H (156–170). Multiple-paused is text-only (P3 evidence gap) |
| AC8 — execute-plan redirects to resume | PASS | `skills/dh-execute-plan/SKILL.md:23,43-47,105,112` |
| AC9 — parser stays three-valued; existing tests pass | PASS | `PHASE_STATUSES` unchanged; 669/669 tests pass |
| AC10 — inventory gates 19; contract test fails on removed field/section | PASS | Inventory/audit/smoke; contract test parses table/list/example; prior negative-case simulation (18 fields / 10 sections would fail) |
| AC11 — full QA gate + rehearsal coverage | PASS with accepted exception | `tasks/qa-gate.md`; independent re-run of test/typecheck/biome/links/build/smokes below |
| AC12 — docs/index consistent; pack unchanged except new skill assets | PASS | 19-skill counts across active docs; `smoke-pack` 7 agents/19 skills, no docs/plans; index row pending until sign-off |

### Findings

#### [P0] Blocking

None.

#### [P1] High

None.

#### [P2] Worktree drift is path-only; same dirty path with changed content is classified clean

- **Location:** `skills/dh-resume-plan/SKILL.md:97-100`; contract at
  `skills/dh-pause-plan/references/handoff-template.md:39,55`
- **Why it matters:** The handoff records only paths (and a boolean), never a content fingerprint for
  uncommitted files. On resume, “matching state is clean” means only that the same paths are still dirty.
  A concurrent session can edit a file that was already listed under `## Uncommitted Changes`, leave it
  dirty, and resume will not detect it — then execute the next step against changed content. This
  contradicts the plan’s stated mitigation “Concurrent sessions → no lock; detect drift and warn rather
  than overwrite” (`plan.md:63`).
- **Evidence:** Pause records paths and one-line purposes only (`skills/dh-pause-plan/SKILL.md:140-142`;
  template 55); the only resume worktree test is `git status --porcelain=v1` vs the recorded path set
  (97–100); rehearsal E covers a *committed* recorded path, not a changed dirty path.
- **Fix:** Record a per-path fingerprint at pause — e.g. `git hash-object <path>` blob SHAs for modified
  files plus a hash of untracked file contents, or a `git diff --numstat` summary — and compare on resume;
  content changes to a recorded path become material. Alternatively, downgrade “matching paths” to
  “content-unverified/explainable” and require confirmation whenever a recorded path is still dirty.
  This is an additive contract change, so it can be a follow-up (no full diffs, no secrets).

#### [P3] Additive versioning rule conflicts with strict resume validation

- **Location:** `skills/dh-pause-plan/references/handoff-template.md:18-21` vs
  `skills/dh-resume-plan/SKILL.md:70-76`
- **Why it matters:** The template says additive field/section changes do **not** bump
  `handoff_version`, while resume accepts only version `1` and requires “every frontmatter field from the
  template” and “all 11 required sections”. After a future additive change, a valid version-1 handoff
  written before it would be rejected as incomplete. The contract test only covers the current snapshot.
- **Fix:** Either bump the version whenever a required field/section is added, or allow missing
  additive fields/sections with documented defaults in resume (and state which are optional).

#### [P3] Stale “future consumer” wording for `dh-resume-plan`

- **Location:** `skills/dh-pause-plan/SKILL.md:222`
- **Why it matters:** The pause skill still describes `dh-resume-plan` as a “future consumer”, but the
  resume skill is bundled in this change. This is a small documentation inconsistency in a skill that
  agents read as current instructions.
- **Fix:** Change to “consumer that validates the handoff and re-enters execution”.

#### [P3] No-argument resume does not report an already-consumed handoff

- **Location:** `skills/dh-resume-plan/SKILL.md:55-63`
- **Why it matters:** AC6 is satisfied when the user passes the slug (Step 0.3), but with no argument the
  scan selects only `status: paused`; a consumed (`resumed`) handoff is reported as “0 paused handoffs”
  and the user is sent to status-based execution without being told it was already consumed. The result is
  safe, but it loses the explicit consumed report AC6 calls for.
- **Fix:** Scan all `docs/plans/*/handoff.md`; when no paused handoff exists, report any `resumed` handoff
  as consumed before suggesting status-based `dh-execute-plan`.

#### [P3] Delegation failure after consume has no recovery path

- **Location:** `skills/dh-resume-plan/SKILL.md:151-166`; error handling 188-189
- **Why it matters:** Step 5 verifies `dh-execute-plan` availability before editing the handoff, but if
  the invocation itself fails after the handoff is marked `resumed`, the handoff is consumed while
  execution never started. Error Handling only covers a handoff write failure, so the user must discover
  that a fresh `dh-pause-plan` is the recovery.
- **Fix:** State that a failed delegation leaves the handoff `resumed` and requires a fresh pause, or
  restore `status: paused` on delegation failure.

#### [P3] Null recorded branch is ambiguous between non-git pause and detached HEAD

- **Location:** `skills/dh-resume-plan/SKILL.md:86-88` vs 109-112
- **Why it matters:** Pause writes `branch: null` when git was unavailable **or** HEAD was detached. At
  resume, a named branch now with a null recorded branch can be read as “a different branch → material”
  (86–88) instead of “branch is unverifiable” (109–112). The outcome is safe (it asks), but a non-git
  pause later resumed in a git checkout is misclassified as material.
- **Fix:** State explicitly that a null recorded `branch`/`base_commit` is always unverifiable, regardless
  of the current git state; only a non-null recorded branch that differs is material.

#### [P3] Rehearsal evidence gaps and helper method disclosure

- **Location:** `docs/plans/pause-resume-plan-skills/tasks/rehearsal.md:35-45,213-219`
- **Why it matters:** The required A–H scenarios pass, but the rehearsal does not cover multiple paused
  handoffs, detached HEAD at pause, corrupt/unknown-version handoffs, a missing `plan.md`, or a
  hashing-tool-unavailable resume. The plan’s 4.1 setup also called for a scratch `sdd.md`; the rehearsal
  deliberately omits it and exercises the absent-SDD path (`rehearsal.md:26-31`). The method note also
  discloses that a local helper, not the skills through an agent runner, executed the steps. These are
  evidence-completeness gaps and a disclosed deviation, not observed behavior failures.
- **Fix:** Add one short scenario per missing branch (or explicitly defer them with rationale) and keep
  the helper/SDD disclosures; no production change is implied.

#### [P3] Contract test does not guard the execute-plan/task integration

- **Location:** `src/__tests__/handoff-contract.test.ts:163-180`
- **Why it matters:** R7’s integration is text-only: the contract test asserts the handoff template and
  both lifecycle skills, but not the paused-handoff guard in `dh-execute-plan` or the pause
  recommendations in `dh-execute-plan-task`. A future edit could remove the guard while all tests stay
  green. R10 does not require it, so this is an enhancement.
- **Fix:** Add structural markers for the guard and task pause recommendations (as `PAUSE_MARKERS`/
  `RESUME_MARKERS` already do for the two new skills).

### Dependency-scan exception disposition

**Accepted — no action in this plan.** `scan:deps` reports 20 known vulnerabilities on this branch
(`zod`, `undici`, `minimatch`, `glob`, `ip-address`) versus 28 on `develop`; this diff changes neither
`package.json` nor `pnpm-lock.yaml`, so it does not introduce or worsen them. The exception is recorded
in `tasks/qa-gate.md:37-47` and `tasks/release-checks.md:77-82`; the user accepted it on 2026-11-07.
No gate was skipped, weakened, or re-pointed. Remediation is dependency-upgrade work outside this
plan’s scope. All other `qa:check:full` steps are green.

### Independent validation (this review)

- `pnpm test` → 40 files, **669/669** passed; no skipped/only tests in the diff.
- `pnpm typecheck` → exit 0; `pnpm lint:biome` → 101 files, 0 errors (pre-existing 5 warnings/11 infos);
  `pnpm lint:links` → **34** references, 0 dead (the evidence files record 32 at their earlier run);
  `pnpm lint:knip`, `pnpm lint:dup` (0 clones), `pnpm lint:depcruise` (39 modules/92 deps, no violations)
  → clean.
- `pnpm build` → 3 entries + declarations; `dist/assets` = **7 agents / 19 skill dirs** (+ `index.md`);
  `dist/assets/skills/dh-pause-plan/references/handoff-template.md` is present.
- `node scripts/smoke-load.mjs`, `smoke-mcp.mjs`, `smoke-pack.mjs` (206 files, 7/19, no src/docs/tests/
  plans), and `smoke-install.mjs` → all pass.
- `reports/audit.md`/`audit.json` (committed in `0000726`) → verdict **PASS**, 0 fails, 0 high-signature
  secrets, 19/19 skills present. `pnpm run audit` was not re-run to avoid rewriting tracked reports.
- Working tree was clean at review start; this review only appends this section. `dist/` and
  `report/jscpd-report.md` are gitignored.

### Security, rollback, and regression notes

- **Secrets:** no sensitive files or credential-shaped values in the diff; audit high-signature count 0.
  The handoff examples use fake hashes and contain only redaction rules.
- **Rollback:** revert `701007d` (feature), `0000726` (audit refresh), and `7be0da4` (evidence) as a unit;
  rebuild `dist/` because it is gitignored. No schema/data migration exists. Handoff files are inert
  documents; plan statuses were never part of the mutation, and removing the guard restores the previous
  status-based execute-plan path.
- **Regressions:** no parser/MCP/runtime changes; the 19-skill inventory is consistent across source,
  tests, smoke, audit, and active docs; the no-handoff execution path is unchanged.

### Deferred items

- **P2 worktree content fingerprint** — follow-up (contract additive change + test); non-blocking.
- **P3 versioning rule / stale wording / no-arg consumed report / delegation-failure recovery /
  branch-null ambiguity** — documentation and robustness polish; no runtime impact.
- **P3 rehearsal gaps and R7 contract markers** — evidence/test improvements for a future pass.
- **Post-sign-off (required to close):** mark Sub-Task 4.3 and Phase 4 `Completed`, set `plan.md`
  frontmatter `status: Completed`, and set the `docs/plans/index.md:10` row to `Completed`; commit the
  final review and status update. Do not tag without approval.

### Release recommendation

**Minor version bump.** The change adds two bundled skills and is additive/non-breaking; the current
package is `0.5.0-rc.1` and the latest tag is `v0.4.0`. Recommend `0.5.0` (or `0.5.0-rc.2` if the RC line
is being continued) — **no major bump**, and **no tag** until explicitly approved and the post-sign-off
status/index commit lands.

### Final decision

**Approve with comments.** R1–R12 and AC1–AC12 are met; no P0/P1 findings; the P2 is a non-blocking
drift-hardening follow-up and the P3s are documentation/evidence polish. The plan is release-ready once
the 4.3 sign-off status and plans-index row are committed.

---

## P2 Resolution Re-review

**Reviewed against:** the Final Plan Review’s P2 — worktree drift was path-only and classified same-path
content changes as clean (`skills/dh-resume-plan/SKILL.md:97-100`, `handoff-template.md:39,55`).
**Scope:** uncommitted changes since that review only: `skills/dh-pause-plan/SKILL.md`,
`skills/dh-pause-plan/references/handoff-template.md`, `skills/dh-resume-plan/SKILL.md`,
`src/__tests__/handoff-contract.test.ts`, and `docs/plans/pause-resume-plan-skills/tasks/rehearsal.md`.
No plan-status or index changes were made.
**Verdict: Approve with comments** — the P2 behavior fix is accepted; one new **P2 release-gate
regression** (Biome formatting) and P3 evidence/clarity items remain.

### P2 resolution

| Original P2 | Status | Evidence |
|---|---|---|
| Same-path content edits were classified clean; concurrent edits could be missed | **FIXED** | Template adds `worktree_fingerprint` (`handoff-template.md:37-38`); status lifecycle makes content changes material even with an unchanged path set (71–72); pause computes a sorted `status<TAB>path<TAB>blob-SHA` SHA-256 (`dh-pause-plan/SKILL.md:110-114`); resume compares the path set first and then the fingerprint, with any difference material (`dh-resume-plan/SKILL.md:97-108`) |
| Null/missing fingerprint could be treated as clean/explainable | **FIXED** | Resume Step 1 requires the field and accepts only lowercase 64-hex or `null`; missing/unknown stops; unavailable hash is unverifiable with confirmation (`dh-resume-plan/SKILL.md:75-77`); Step 2 states “null/uncomputable … never clean or explainable” (105–108) |
| Evidence must prove the content-only case | **PASS** | Rehearsal I: equal path set, fingerprint `d7b64f5c…` → `a945e5f5…` / `e7e53b0d…`, plan hash clean, worktree/overall material, STOP, handoff paused (`rehearsal.md:176-193`). Independent simulation in a throwaway git repo also changed the fingerprint with the same paths (`9fbbf585…` → `080cb73c…`) |

**No migration needed for this branch:** no `handoff.md` exists in the repository or git history, and
the pause/resume feature is unreleased (latest tag `v0.4.0`). The new field is part of the initial
unreleased v1 contract. If v1 had already shipped, adding a *required* field would be a breaking change;
the existing P3 about the additive-versioning rule versus strict resume validation therefore remains
relevant for future contract evolution.

### Contract, limits, and tests

- Template `199` lines (≤200); `dh-pause-plan` `238` and `dh-resume-plan` `218` lines (≤250);
  `handoff-contract.test.ts` `195` lines.
- Contract test has **20** required keys, asserts the example’s 64-hex fingerprint, and still parses the
  authoritative `## Frontmatter fields` table and `## Required sections` list. Full suite: **40 files /
  669 tests passed**.
- `pnpm typecheck` → 0; `pnpm lint:links` → 34 references, 0 dead; `pnpm build` → 7 agents / 19 skills;
  `pnpm lint:knip`, `lint:dup` (0 clones), `lint:depcruise` (39 modules/92 deps) → pass.
- No changes to the 19-skill inventory, parser/`PHASE_STATUSES`, MCP tools, execute-plan guard, or
  execute-plan-task pause recommendations.
- R1–R12/AC1–AC12 coverage: R3/R5/R10 are strengthened by the new field; R11/AC11 is not fully
  re-certified until the Biome fix and gate re-run; all other requirements and criteria are unchanged.

### Findings

#### [P0] Blocking

None.

#### [P1] High

None.

#### [P2] Biome formatting gate regression in the contract test

- **Location:** `src/__tests__/handoff-contract.test.ts:59`
- **Why it matters:** The new `PAUSE_MARKERS` array is a single line that Biome’s formatter wants split
  across multiple lines. `pnpm lint:biome` and `pnpm format:biome:check` now exit **1** with
  “Formatter would have printed the following content”, so the repository’s `qa:check` gate fails at its
  first step. The tests themselves pass, but the release gate is not green after the P2 fix, and the
  existing QA evidence predates this change.
- **Evidence:** `pnpm exec biome check src/__tests__/handoff-contract.test.ts` → 1 error at line 59;
  full `pnpm lint:biome` → “Found 1 error” (plus the pre-existing 5 warnings/11 infos). The failure is
  caused by adding `'worktree_fingerprint'` to the previously single-line array.
- **Fix:** Run `pnpm format:biome` (or break `PAUSE_MARKERS` into the multi-line form shown by Biome),
  then re-run `pnpm qa:check:full` (or at minimum `lint:biome`, `format:biome:check`, and the test suite)
  and refresh the QA evidence. This is mechanical; no functional change is implied.

#### [P3] Rehearsal evidence is partially stale after adding the field

- **Location:** `docs/plans/pause-resume-plan-skills/tasks/rehearsal.md:70` (A) and `160-174` (H)
- **Why it matters:** Scenario A still says “19 frontmatter keys” although the contract now has 20, and
  the non-git scenario H does not show `worktree_fingerprint: null` (or otherwise demonstrate the field’s
  non-git value). A reader cannot confirm the 20-key contract or the null-handling path from the evidence.
- **Fix:** Update A to 20 keys and add the missing `worktree_fingerprint: null` line/assertion to H (or
  state explicitly that H is a partial frontmatter excerpt).

#### [P3] `worktree_fingerprint` null condition omits git-unavailable

- **Location:** `skills/dh-pause-plan/references/handoff-template.md:38`; `skills/dh-pause-plan/SKILL.md:110-114`
- **Why it matters:** The field table says `null` when no hashing tool exists, but not when git (and thus
  the path set) is unavailable. In a non-git pause, the algorithm’s “over the non-handoff paths” input is
  undefined; an agent could hash an empty block and record a valid-looking 64-hex fingerprint with no
  path set. Resume still marks the handoff unverifiable because `branch`/`base_commit` are null, but the
  field semantics should be explicit.
- **Fix:** State that `worktree_fingerprint` is `null` when either no hashing tool exists **or** git is
  unavailable (path set unknown), and never fabricate an empty-block hash for an unknown worktree.

#### [P3] Fingerprint algorithm does not address untracked directories

- **Location:** `skills/dh-pause-plan/SKILL.md:110-114`; `skills/dh-resume-plan/SKILL.md:101-108`
- **Why it matters:** `git status --porcelain=v1` can list an untracked directory as `?? dir/`; in that
  case the path is not a file and `git hash-object -- dir/` fails. The algorithm only defines the
  existing-file and `DELETED` cases, so an untracked directory can make the fingerprint uncomputable or
  produce an improvised value. Resume’s “uncomputable → unverifiable” rule keeps this safe, but the
  pause-side behavior should be defined.
- **Fix:** Use `git status --porcelain=v1 -uall` and expand directory entries to files (or mark the
  fingerprint uncomputable/unverifiable when a path is not a regular file).

#### Existing P3s (still deferred)

The previously recorded P3s remain: the additive-versioning rule versus strict resume validation; the
stale “future consumer” wording (`skills/dh-pause-plan/SKILL.md:222`); no-argument resume not reporting
an already-consumed handoff; delegation-failure recovery after consume; null-branch ambiguity between
non-git and detached HEAD; the broader rehearsal gaps (multiple paused, detached HEAD, corrupt/missing
plan, hashing-unavailable) and disclosed helper/no-SDD method; and the missing contract-test markers for
the execute-plan/task integration. The P2 fix is additive and does not worsen these.

### Updated verdict

**Approve with comments.** The original P2 is genuinely resolved: a same-path content edit now produces
a material fingerprint mismatch, and a null/missing fingerprint is unverifiable with confirmation, not
clean. No new functional P0/P1/P2 was introduced; the only new **P2** is the mechanical Biome formatting
failure above, which must be fixed and the QA gate re-run before merge/release. The P3s are evidence and
edge-case clarity items and may remain deferred.

Release recommendation is unchanged: **minor** (`0.5.0`, or `0.5.0-rc.2` if continuing the RC line);
**do not tag** until the formatting fix, the refreshed QA gate, and the post-sign-off plan/index status
commit are complete.

---

## Final Verification

**Plan:** `pause-resume-plan-skills` · **Branch:** `feature/pause-resume-plan-skills`
**Range/state:** current working tree on top of `7be0da4`; changes since the P2 re-review are the
`worktree_fingerprint` contract, pause/resume fingerprint rules, untracked-directory expansion, test
formatting, rehearsal evidence, and the post-P2 QA evidence.
**Reviewer scope:** verification only; no implementation, plan-status, or index changes were made by this
review. The only file written by this section is this review.
**Overall risk:** Low.
**Verdict: Approve with comments** — P3-only comments; no P0/P1/P2.

This is the final binding verification for the 4.3 close-out. The P2 content-drift gap is resolved, the
formatting gate is green, and the plan is ready to close once the post-sign-off status/index update is
committed. The remaining comments are non-blocking P3 evidence/edge-case items.

### Verification matrix

| Area | Result | Evidence |
|---|---|---|
| Biome lint | **PASS** | `pnpm lint:biome` → 101 files, 0 errors (5 pre-existing warnings, 11 infos), exit 0 |
| Biome format | **PASS** | `pnpm format:biome:check` → exit 0 |
| Unit tests | **PASS** | `pnpm test` → 40 files, **669/669** tests |
| Typecheck | **PASS** | `pnpm typecheck` → exit 0 |
| Markdown links | **PASS** | `pnpm lint:links` → 34 references, 0 dead |
| Build/artifacts | **PASS** | `pnpm build` → 3 tsup entries + declarations; assets 7 agents / 19 skill dirs (+ `index.md`) |
| Smoke load/MCP/pack/install | **PASS** | `smoke-load`, `smoke-mcp`, `smoke-pack` (206 files; 7/19; no src/docs/tests/plans), `smoke-install` all exit 0 |
| Knip/duplication/dependency-cruiser | **PASS** | `lint:knip` exit 0; `lint:dup` 0 clones; `lint:depcruise` 39 modules/92 deps, no violations |
| Harness audit | **PASS** | Independent `node scripts/audit.mjs` → verdict PASS, exit 0, 0 failures/0 high-signature secrets (reports restored; see P3 evidence note) |
| Contract test | **PASS** | 20 required keys; 11 tests; parses the authoritative field table, required-sections list, and worked example |
| Line limits | **PASS** | Template 199 ≤200; pause 244 and resume 218 ≤250; contract test 202 ≤220 |
| Status model | **PASS** | `PHASE_STATUSES` exactly `Pending | In Progress | Completed`; no parser or MCP change |
| Dependency scan | **ACCEPTED EXCEPTION** | 20 vulns vs 28 on `develop`; no `package.json`/`pnpm-lock.yaml` change; user accepted; no gate weakened |

### P2/P3 disposition

| Item | Status | Evidence |
|---|---|---|
| P2 — same-path content drift classified clean | **FIXED** | `worktree_fingerprint` is a required 20th v1 field; pause computes sorted `status<TAB>path<TAB>blob-SHA` lines; resume compares path set first, then fingerprint, and any difference is material (`dh-resume-plan/SKILL.md:100-108`); null/missing is unverifiable with confirmation (`75-77`, `105-108`) |
| P2 evidence — content-only edits | **PASS** | Rehearsal I: equal path set, `d7b64f5c…` → `a945e5f5…` / `e7e53b0d…`, plan hash clean, material/STOP, handoff paused (`rehearsal.md:177-193`) |
| P3 — untracked directory expansion | **PARTIAL (P3 remains)** | Pause expands `?? dir/` with `git ls-files --others --exclude-standard`, hashes each file, uses `DIR_EMPTY`, and records expanded file paths (`dh-pause-plan/SKILL.md:114-118`; template 38; rehearsal (d) `213-215`). Resume still derives its path set from raw `git status --porcelain=v1` (`dh-resume-plan/SKILL.md:100-108`), so a clean untracked directory can look like a path-set mismatch (false material/explainable, not false clean) |
| P3 — git-unavailable/null fingerprint | **FIXED** | Template and pause state `null` when git or hashing is unavailable (path set/content unknown); H shows `worktree_fingerprint: null` and unverifiable/ask (`rehearsal.md:160-175`) |
| P3 — rehearsal counts | **FIXED** | A now says 20 frontmatter keys (`rehearsal.md:70`); H shows the null fingerprint; (d) shows directory expansion |
| P3 — Biome formatting regression | **FIXED** | `PAUSE_MARKERS` is multi-line and both Biome gates exit 0 |
| Additive field vs version-1 | **NO MIGRATION NEEDED** | No `handoff.md` exists in the repo or git history; the feature is unreleased (latest tag `v0.4.0`), so this is the initial v1 contract. If v1 had shipped, the required additive field would be breaking; the future-versioning P3 remains |

### Requirements / acceptance criteria

| Coverage | Result |
|---|---|
| R1–R12 | **PASS** — R5/AC5 are strengthened by the content fingerprint; R10 covers the 20-key contract; R7 guard/task paths unchanged; R8 parser/MCP/status unchanged; R9 19-skill inventory unchanged; R12 docs/index unchanged |
| AC1–AC12 | **PASS** — AC3 no secrets/diffs; AC5 content drift material; AC6 consumed handling unchanged; AC7 non-git is unverifiable with confirmation; AC10 contract test covers the 20-key table/list/example; AC11 rehearsal + gate (accepted `scan:deps` exception); AC12 pack/docs/index |
| Regression check | No new P0/P1/P2; no runtime/parser/MCP changes; no test weakening; no stale active-surface 17-skill claims; 19/19 skills consistent |

### Findings

#### [P0] Blocking

None.

#### [P1] High

None.

#### [P2] Medium

None.

#### [P3] Resume path-set comparison does not expand untracked directories

- **Location:** `skills/dh-resume-plan/SKILL.md:100-108` (path set from raw `git status --porcelain=v1`) vs
  `skills/dh-pause-plan/SKILL.md:114-118` and `handoff-template.md:38`
- **Why it matters:** Pause records expanded file paths for an untracked directory; resume compares the
  raw status entry (`?? dir/`) with those recorded files. On an unchanged worktree this can be reported as
  an unexpected/missing path (material/explainable) instead of clean, causing a false-positive stop. It does
  not create a false clean and does not undermine the P2 fix.
- **Fix:** Apply the same `git ls-files --others --exclude-standard -- <dir>/` expansion (and
  `DIR_EMPTY`/directory handling) to resume’s path set before comparison, or record the directory along
  with its expanded files.

#### [P3] Post-P2 QA table is focused; audit report is stale

- **Location:** `docs/plans/pause-resume-plan-skills/tasks/qa-gate.md:66-93`; `reports/audit.json` /
  `reports/audit.md`
- **Why it matters:** The post-P2 table covers the affected lint/format/build/test/typecheck/links/smokes
  and contract checks, but omits `smoke-install`, `lint:knip`, `lint:dup`, `lint:depcruise`, and `audit`.
  The committed audit report still records the pre-P2 skill line counts (231/213) versus the current
  244/218. I independently re-ran the omitted checks and all pass (audit PASS, exit 0), but the evidence
  file is not literally a full current gate record.
- **Fix:** Add the omitted non-Docker results (or state they were unaffected) and refresh
  `reports/audit.*` before the final sign-off if the audit report is part of the release evidence.

#### Deferred P3s (explicit)

- Additive field/versioning rule versus strict resume validation (future contract evolution; no migration
  for this unreleased v1).
- Stale “future consumer” wording for `dh-resume-plan` (`skills/dh-pause-plan/SKILL.md:222`).
- No-argument resume does not report an already-consumed handoff.
- Delegation failure after consume has no explicit recovery path.
- Null recorded branch is ambiguous between non-git pause and detached HEAD.
- Broader rehearsal gaps (multiple paused plans, detached HEAD, corrupt/missing plan,
  hashing-unavailable) and the disclosed helper/no-SDD method.
- Contract test does not guard the execute-plan/task integration (R7 markers).
- The new resume untracked-directory path-set expansion and QA/audit evidence freshness above.

### Docs, status, and close-out

- Active docs remain consistent at **19 skills**: AGENTS, README, `skills/index.md`, `docs/LOADING.md`,
  `opencode.example.jsonc`, demo docs, and the audit inventory. No stale 17-skill claim remains on the
  active surface.
- Plan statuses are consistent: Phases 1–3 `Completed`; Phase 4 `In Progress`; Sub-Tasks 4.1 and 4.2
  `Completed`; 4.3 `In Progress` (this review). Plan frontmatter and the `docs/plans/index.md` row remain
  `Pending` until the 4.3 close-out commit, as required.
- Security/rollback: no secrets or credential-shaped values in the diff; no package/lockfile, parser, or
  MCP changes. Reverting the feature/audit/evidence commits remains the recovery path; handoff files are
  inert documents and plan statuses were never mutated by the skills.
- **Semver:** minor only — `0.5.0` (or `0.5.0-rc.2` if continuing the current RC line); no major bump and
  **no tag** until explicitly approved.
- **4.3 close-out:** ready. Mark 4.3 and Phase 4 `Completed`, set the plan frontmatter `status:
  Completed`, set the plans-index row to `Completed`, commit the final review/status update, and do not
  tag. The P3s may be deferred and recorded in the plan’s close-out notes.

### Final binding verdict

**Approve with comments (P3-only).** P2 is resolved, the formatting gate is green, R1–R12/AC1–AC12 remain
covered, and there are no P0/P1/P2 findings. The plan is ready for the 4.3 close-out with the remaining P3
items deferred.

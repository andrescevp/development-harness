# Sub-Task Review: Scaffold repo and extract harness content (R1)

**Reviewed against:** Sub-Task 1 from plan.md (dev-harness-v2-plugin)
**Overall risk:** Low
**Verdict:** Approve

## Acceptance Criteria Verification

| Criteria | Status | Notes |
|---|---|---|
| `agents/` 14 files | PASS | `ls agents | wc -l` == 14 |
| `skills/` 37 dirs + `index.md` | PASS | Source holds 37 real dirs (36 + 1 symlink dereferenced) + index.md; plan's "38 dirs" counted index.md — deviation documented in docs/EXTRACTION.md |
| `commands/` 11 files | PASS | verified |
| `prompts/` 9 files | PASS | verified |
| aliases body identical (name only) | PASS | diff after removing `name:` line → IDENTICAL for both pairs |
| no .env/api_key/token/personal endpoints | PASS | high-signature scan 0 hits; 117 prose hits all instructional, reviewed |
| no .bak/node_modules/junk | PASS | find empty; 0 symlinks; `--check` now enforces symlinks + `.env*` exclusion |

## Findings

All P2/P3 findings from @reviewer addressed in this sub-task:

- **[P2] `.env*` not in extractor exclusion list** → **Addressed**: `junkReason` now returns `'secrets (.env*)'` for `.env`/`.env.*` before the dir early-return; probe test verified the file is skipped.
- **[P3] EXTRACTION.md claimed `--check` enforces zero symlinks** → **Addressed**: `collectSymlinks()` added; `--check` now flags symlinks in the extracted tree (probe-verified: CHECK FAIL on symlink, PASS after removal).
- **[P3] EXTRACTION.md count inaccuracies (6→5 `__pycache__`, 41→45 files)** → **Addressed**: both corrected.
- **[P3] `--check` raw ENOENT stack when source missing** → **Addressed**: top-level try/catch prints clean `source root not found:` message, exit 1 (verified).
- **[P3] Dead `SECTIONS` manifest + duplicated expectations** → **Deferred** (P3, non-blocking): audit script in ST2 will consolidate the manifest; noted for ST2.

## Validation Results

- Tests present: extraction `--check` mode (scripted self-verification) + independent @executor validation 7/7 PASS; post-fix re-validation PASS (`.env*` probe, symlink probe, graceful errors, doc counts).
- Validation commands: `node scripts/extract.mjs --check` exit 0; `node scripts/extract.mjs` idempotent (138-file byte-compare clean).
- Edge cases from sub-task: secret copy (probe), junk hidden files (junk scan), rename body integrity (diff), symlink dereference (0 symlinks in dest) — all handled.

## Regression Risk Assessment

- Breaking changes detected: none (new repo, no prior code).
- Interface/config changes affecting other components: none; source `~/.agents` untouched (dirtiness pre-existing, mtimes prove one-way copy).

## Scope Compliance

- In scope: scaffold, extraction, renames, provenance, placeholder — verified.
- Out of scope detected: none (no configs/secrets/v1 plugin/copilot-gemini variants copied).

## Suggested Next Steps

- [x] `.env*` exclusion (P2) — done
- [x] EXTRACTION.md accuracy + `--check` symlink claim (P3) — done
- [x] graceful error on missing source (P3) — done
- [ ] ST2: consolidate the include/exclude manifest (was dead `SECTIONS`) for audit reuse
- [ ] ST5/ST6/ST7: use **38 SKILL.md** count (37 extracted + coding), not 39

---

## Scope Revision Addendum (2026-09-27)

**User-mandated manifest.** The plugin scope was limited by the user to exactly:

- **Agents (6):** `software-architect` (rename of `senior-architect`), `software-engineer` (rename of `senior-engineer`), `reviewer`, `final-reviewer`, `executor`, `explorer`
- **Skills (12):** `artifact-check`, `simplify`, `domain-check`, `coding` (NEW — created in ST3), `code-review`, `execute-plan`, `execute-plan-task`, `final-review`, `planning`, `preflight`, `review`, `create-documentation`
- **Everything else out of scope:** other 8 agents, other 26 skills, all commands, all prompts, v1 plugin, multi-CLI variants, `~/.agents` configs/secrets.

**Pruning action.** ST1's earlier full extraction (14 agents, 37 skill dirs +
index.md, 11 commands, 9 prompts) was **pruned to the scoped set**: the extractor
now enforces the `include` lists in `scripts/manifest.json` (15 new include
entries: 6 agent files + 11 skill dirs, plus index.md), the repo's `commands/`
and `prompts/` directories were **removed**, and both scripts were re-run.

**Re-verification (all checks pass):**

| Check | Result |
|---|---|
| `node scripts/extract.mjs` | exit 0 — copied 6 agents, 11 skill dirs + index.md; 36 items skipped as out of scope (8 agents, 26 skills, 2 `.bak` junk) |
| `node scripts/extract.mjs --check` | exit 0 — CHECK PASS: agents 6, skills 11 dirs + index.md, **no commands/, no prompts/**, no junk, alias bodies identical to source |
| `node scripts/audit.mjs` | exit 0 — PASS: FAIL findings 0; loop 11/12 skills present + coding expected-pending (ST3), 6/6 agents present; 0 size/secrets/junk failures; 8 unresolved `@`-mentions + 72 prose tokens are warn-only (external-harness references documented, e.g. `@build`, `state-sync`) |
| dirs | `commands/` and `prompts/` do **not** exist in the repo (verified via `ls`) |
| aliases | `software-architect.md` / `software-engineer.md` present; bodies byte-identical to source (frontmatter `name` only) |
| junk/secrets | 0 `.bak`/junk files, 0 symlinks, 0 high-signature secret hits (11 low-signature prose hits, all instructional) |

Counts now match the plan contract: 6 agents / 11 skills now (+ coding in ST3).
No SKILL.md exceeds 250 lines and no agent exceeds 300 lines in the scoped set.
---

## Sub-Task 2 Review: Audit extracted artifacts (R2)

**Reviewed against:** Sub-Task 2 from plan.md (dev-harness-v2-plugin)
**Reviewer:** scoped code review (code-review skill severity scale)
**Scope reviewed:** `scripts/manifest.json`, `scripts/extract.mjs`, `scripts/audit.mjs`, `scripts/lib/frontmatter.mjs`, `scripts/lib/report.mjs`, `docs/EXTRACTION.md`, `tasks/audit-report.md`, `reports/audit.json`
**Overall risk:** Low
**Verdict:** Approve with comments

### Acceptance Criteria Verification (ST2)

| Criteria | Status | Notes |
|---|---|---|
| Audit exits 0 with zero FAIL findings | PASS | Re-ran `node scripts/audit.mjs` → exit 0, verdict PASS, 0 FAIL, 0 size deviations; `node scripts/extract.mjs --check` → exit 0 |
| 100% frontmatter parses | PASS | 18/18 files parsed; folded `description: >` blocks + non-ASCII (`á` in software-architect) handled — verified against corpus |
| Skill names match regex | PASS | All 11 skill names + 6 agent names match `^[a-z0-9]+(-[a-z0-9]+)*$`; frontmatter name == dir name for all 11 skills |
| No secret/junk matches | PASS | 0 high-signature, 11 low-signature prose hits (instructional, reviewed); 0 junk files, 0 symlinks; repo-wide high-signature grep clean |
| Cross-references resolve; coding expected-pending | PASS | 141 resolved; 8 `@build` mentions warn-only (out-of-bundle harness agent, per plan cautionary); 72 kebab prose tokens warn-only (`state-sync`, `bounded-context`, ...); coding `expected-pending (ST3)` recorded |
| Loop membership confirmed | PASS | 11/12 skills present + coding expected-pending; 6/6 agents present (renamed names resolve) |
| Size deviations documented | PASS | None present; mechanism reports size as warn-only (`SKILL.md < 250`, agents `< 300`) — max scoped file 184 lines |
| Manifest is single source of truth | PASS | `include`/`sections`/`junk`/`secrets`/`loop`/`lineLimits`/`skillNameRegex` shared by extract.mjs (copy + --check) and audit.mjs; no duplicated expectations remain (ST1 P3 "dead SECTIONS" resolved) |
| Scope compliance | PASS | `agents/` 6 files, `skills/` 11 dirs + index.md, no `commands/`, no `prompts/`; audit explicitly refuses out-of-scope dirs (`checkInventory`) and extract removes them on every run; no non-manifest skills/agents in repo |
| Security | PASS (with P2) | Scripts contain no credentials (patterns + placeholder allowlist only); extract/audit read-only on `~/.agents` (guard rejects `AGENTS_HOME` inside repo); no `.env*`/config inclusion paths; symlink-deref hardening gap noted below |
| Report artifacts | PASS | `reports/audit.json` + `tasks/audit-report.md` generated, consistent with each other and with `docs/EXTRACTION.md` |

### Validation (reproduced)

- `node scripts/extract.mjs --check` → exit 0, CHECK PASS (6 agents, 11 dirs + index.md, no commands/prompts, alias bodies identical, zero junk/symlinks).
- `node scripts/audit.mjs` → exit 0, verdict PASS, loop 11/12 + coding, 8 unresolved @mentions + 72 kebab tokens warn-only, secretFailures 0, junkFiles 0.

### Findings

#### [P2] Medium

- **Symlink dereference can copy files from outside the source root**
  - **Location**: `scripts/extract.mjs:93-102` (`walkCopy` symlink branch)
  - **Why it matters**: a symlink inside a source skill dir is resolved via `fs.realpathSync` and copied **without verifying the target stays under `SOURCE_ROOT`**. A link such as `notes.txt -> ~/.env` or `-> ~/.ssh/...` would be copied into the repo as a regular file. Post-hoc gates would NOT catch it: `--check`/audit flag symlinks, but dereferencing leaves a plain file (no symlink remains), and the secret scan only FAILs on high-signature patterns — an env-style `DATABASE_URL=postgres://u:p@host` file would pass as "low-signature prose".
  - **Evidence**: `junkReason` (extract.mjs:39-46) checks only the link's own name; the deref branch (lines 97-102) follows any target. Current exposure is zero (all 11 scoped source dirs verified symlink-free), so this is hardening, not an active leak.
  - **Fix**: resolve the target and skip/reject when `path.resolve(real)` is not inside `SOURCE_ROOT`, or refuse to follow symlinks entirely (fail loudly in `--check`).

- **Audit inventory count will hard-FAIL when ST3 adds `coding` (expected-pending does not cover `sections` counts)**
  - **Location**: `scripts/manifest.json:31-35` (`bundledSkillMdCount`/`afterSt3Note`) vs `scripts/audit.mjs:192-203` (`checkInventory`)
  - **Why it matters**: the audit anticipates `coding` only in the loop-membership dimension (`expected-pending (ST3)`). Adding `skills/coding/` makes `inv.skillDirs` 12 while `sections.skills.expectedItems` stays 11 -> `checkInventory` pushes "skill dirs 12 != 11" and the audit exits 1. The manifest documents the bump (`afterSt3Note`), but plan ST3's instructions don't mention editing `manifest.json`, and the very mechanism designed to avoid this hard fail (expected-pending) doesn't apply to the inventory dimension.
  - **Evidence**: audit.mjs:195-197 reads `exp.skills.expectedItems` (11); ST3 acceptance ("Audit (ST2 script) passes on the new file") has no manifest-bump step.
  - **Fix**: derive the skills expectation from `bundledSkillMdCount` with the same expected-pending semantics used for the loop, or add an explicit ST3 instruction to bump `sections.skills.expectedItems` (+ `bundledSkillMdCount.now`) and re-run `extract --check` + audit.

#### [P3] Low

- **Missing `SKILL.md` in a skill dir crashes the audit instead of producing a FAIL finding**
  - **Location**: `scripts/audit.mjs:239-288` (`main`, no try/catch) + audit surface at `audit.mjs:244`
  - **Why it matters**: `surface` is built from dir names (`skills/<d>/SKILL.md`); `auditFile` -> `raw()` -> `readFileSync` throws ENOENT -> unhandled stack trace, report not regenerated (stale). `extract --check` also counts dirs, not SKILL.md files, so it wouldn't catch it either.
  - **Fix**: wrap per-file reads; record a clean `fail` finding "SKILL.md missing in dir" instead of crashing.

- **Dead `knownSchemaDeviations` path + duplicated frontmatter splitters**
  - **Location**: `scripts/audit.mjs:204-213`; `scripts/extract.mjs:56-63` vs `scripts/lib/frontmatter.mjs:18-23`
  - **Why it matters**: `applySchemaDeviations` references `MANIFEST.knownSchemaDeviations`, which does not exist in `manifest.json` (dead code that would silently downgrade FAIL findings to warn if ever populated). Frontmatter splitting exists twice with different contracts (extract throws and keeps the closing `---`; lib returns `{error}`) — a parser bug fix must be applied in both places.
  - **Fix**: drop the dead path or define the key; have `extract.mjs` import the shared splitter.

- **Report header "Warn deviations: 0" contradicts the WARN cross-references dimension**
  - **Location**: `scripts/lib/report.mjs:10,20`
  - **Why it matters**: `warns` counts only record-level findings, so the header says "Warn deviations: 0" while the dimension table shows Cross-references = WARN and the report prints 8 unresolved @mentions + 72 prose tokens below. Misleading at a glance.
  - **Fix**: compute the header count from the warn dimensions/sections (or reword to "record-level warn findings").

- **Flattened nested fields (`tools`/`permission`) are not YAML-faithful — ST5 must not register from them**
  - **Location**: `scripts/lib/frontmatter.mjs:9-15,44-54`
  - **Why it matters**: the lib flattens nested maps to strings like `"bash: true read: true"`. The header comment claims this is "not needed for audit/registration", but V2 agent registration needs structured `permission`/`tools` objects. If ST5's `buildAgentRecord` consumes these flattened strings, registrations will be malformed.
  - **Fix**: ST5/ST6 should re-parse frontmatter with the planned `yaml` dependency for structured fields (audit use of the lenient parser is fine).

### Suggested Next Steps

- [ ] (P2) Constrain symlink dereference to `SOURCE_ROOT` in `extract.mjs`
- [ ] (P2) Make the ST3 inventory expectation self-adjusting (or add the manifest bump to ST3's instructions)
- [ ] (P3) Graceful FAIL finding for missing `SKILL.md`; remove dead `knownSchemaDeviations` path; unify frontmatter splitters
- [ ] (P3) Fix "Warn deviations: 0" header; add a note in ST5 to use the real YAML parser for `tools`/`permission`
- [ ] Reminder for ST3: `extract --check` + audit will go red until `sections.skills.expectedItems` is bumped 11 -> 12
- [ ] ST6: add vitest coverage for `lib/frontmatter.mjs`, `lib/report.mjs`, and the audit gates (currently only manual/@executor validation; acceptable per plan, but the audit is the plan's gate)

## ST2 Resolution Log (2026-09-28)

All reviewer findings addressed; re-validated green.

- **[P2] Symlink target outside SOURCE_ROOT** → Addressed: `walkCopy` now realpath-checks the target against `realpathSync(SOURCE_ROOT)` and skips with `symlink target outside source root`. Probe-verified (skipped, not copied).
- **[P2] Audit hard-fails when ST3 adds `coding`** → Addressed: extract `--check` and audit `checkInventory` derive expected skill-dir count from `manifest.bundledSkillMdCount` (`now: 11` / `afterSt3: 12`), self-adjusting when `skills/coding/SKILL.md` exists.
- **[P3] Missing SKILL.md crashes audit** → Addressed: `auditFile` catches read errors → FAIL finding `file missing on audit surface`; `scanMentions`/`scanSecrets` skip missing records. Probe-verified (exit 1 clean report, no raw ENOENT).
- **[P3] Dead `knownSchemaDeviations`** → Addressed: function and call removed.
- **[P3] Report header warn-count contradiction** → Addressed: header count = record warns + @mentions + kebab tokens (now 80 = 0+8+72, consistent with sections).
- **[P3] Frontmatter splitter duplicated; ST5 YAML-faithfulness** → Deferred (noted for ST5/ST6): ST5 must re-parse `tools`/`permission` with the `yaml` dependency for structured V2 registration; the lenient parser is fine for audit. Splitter unification deferred as non-blocking.

## ST3 Review (2026-09-28)

**Verdict: Approve with comments** — no P0/P1.

All acceptance criteria PASS: file exists (87 lines ≤ 250), frontmatter parses, name `coding` matches regex, description encodes TDD + CODE_RULES.md lookup + triggers, body covers test-first workflow / project-type awareness / CODE_RULES.md precedence / global-guideline-by-convention (non-bundled), audit PASS with coding loop status `present` (12/12 skills), extract --check green.

Findings:
- **[P2] Delegation targets `@build`/`@senior-engineer` not registered in the plugin → Addressed**: coding skill now delegates standard/complex software work to `@software-engineer` (this plugin's builder), non-software to `@software-engineer` with simplify/domain-check/create-documentation skipped, validation via `@executor`; marker-check mechanism clause added (P3-2). ST4 carries the same normalization for extracted loop-critical copies.
- **[P3] `allowed-tools` includes `bash` while skill mandates `@executor` for bash → Deferred** (consistent with sibling skills; kept).
- **[P3] `compatibility: opencode` diverges from siblings' `opencode, copilot, antigravity` → Intentional** (plugin is opencode-only per R1; documented).

## ST4 Review (2026-09-28)

**Verdict: Approve** (no P0/P1/P2).

ACs PASS: AGENTS.md (74 lines ≤ 120) carries the full 5-step loop verbatim with 2.4 halts automation explicit, provenance accurate vs docs/EXTRACTION.md, agent mapping table complete; both execute-plan and execute-plan-task copies carry `## Loop Integration (bundled)` with coding (2.1), simplify (2.2), review+code-review (2.3), hard-blocker stop (2.4) — extending (not contradicting) the existing P0/P1 stop rule; patches are additive/normalization-only vs ~/.agents sources (byte-identical otherwise); normalization coherence verified (no self-contradicting non-software clauses); audit exit 0 (12/12 skills, 6/6 agents, FAIL 0), extract --check green.

Findings:
- **[P3] execute-plan-task's Loop Integration lacks steps 1/3/4/5 → Addressed**: added "Full loop 1–5 lives in repo-root AGENTS.md / execute-plan" pointer line.

## ST5 Review (2026-09-28)

**Verdict: Approve with comments** (no P0/P1/P2).

Verified: pnpm typecheck exit 0; smoke-load OK (id dev-harness-skills, setup fn); dist/assets = 6 agents + 12 SKILL.md + index.md; audit exit 0 (secrets/junk/symlinks 0); clean rebuild OK. Contract: assets loaded before sync transforms; agent upsert via update (only path — no editor.add for agents; matches @opencode/plugin@2.0.18 typings); skills registered with full Skill.Info {id,name,description,path,content}; zero command transforms. Frontmatter via yaml (multi-line > descriptions fold; model split at last / → {id,providerID,variant}; tools/permission mapped to V2 permissions rules per opencode's own V1→V2 migration). Robustness: import.meta.dirname (CWD-independent — verified importing from /tmp), per-file errors collected, schema-invalid skipped. Security: no secrets; copy-assets honors manifest junk; ~/.agents untouched. Testability: pure exported helpers ready for ST6.

Findings:
- **[P3] yaml declared only in devDependencies → Addressed**: moved to dependencies (runtime import in dist/plugin.js).
- **[P3] engines.node >=20 loose for import.meta.dirname (needs 20.11) → Addressed**: engines now `>=20.11`.
- **[P3] pnpm test exits 1 until ST6 lands the vitest suite → Expected**: ST6 owns the suite; final gate runs after ST6.

## ST6 Review (2026-09-28)

**Verdict: Approve with comments** (no P0/P1 blocking findings in the deliverable; one documented environment limitation).

- Gate green: typecheck, build, test (51/51), smoke-load, audit (FAIL 0), extract --check, asset counts (6/12).
- Registration test (stub ctx + real bundle) asserts exactly the 6 manifest agents, 12 skills, 0 commands — matches user-mandated scope.
- Real-session verification: file://-to-file plugin entry explicitly rejected by v2.0.18 ("must be a directory"); directory/path/.opencode/plugins forms accepted but did not surface plugin agents; no plugin-load error emitted. Documented in tasks/verification.md with degradation path per plan (stub test + smoke-load substitute). Open question recorded for README troubleshooting.
- TDD fixes during implementation: TS strict (noUncheckedIndexedAccess, domain-union), folded-description assertion drift, leading-newline body expectation — all corrected; tests now match real builder semantics.

## ST7 Review (2026-09-28)

**Verdict: Approve with comments** (one P1 doc/gate collision, now resolved).

Verified: README (86 lines) documents provenance/manifest (6 agents, 12 skills, no commands)/quickstart/troubleshooting; LOADING.md shows the exact directory-form `"plugins"` entry, verification checklist, and v2 "must be a directory" + empty-registration troubleshooting; skills/index.md (92 lines) adapted with the 12 skills, coding present, and a rendering mermaid graph including coding + 2.4 STOP edge; all counts/names verified vs repo (6/12, no commands/prompts); no secrets; real-session limitation note matches tasks/verification.md.

Findings:
- **[P1] `pnpm audit` collides with pnpm's dependency security audit** (runs pnpm's audit, exits 1 on a low dev-only esbuild advisory, silently skipping the harness manifest audit) → **Addressed**: README quickstart + gate now use `pnpm run audit`; same correction applied in plan.md (ST6/ST7/testing + Final Integration gate references); LOADING.md adds a troubleshooting note distinguishing `pnpm audit` (security, 1 low dev-only advisory) from `pnpm run audit` (harness gate). End-to-end gate re-run: typecheck ✅, run audit ✅ (FAIL 0), test ✅ (51/51), build ✅, smoke-load ✅; `pnpm audit` confirmed exit 1 (informational).
- **[P3] relative load-form example differed between LOADING.md and opencode.example.jsonc** → **Addressed**: both use `"../shared/dev-harness-skills"`.

## ST7 gate (documented command set) — PASS
`pnpm typecheck && pnpm run audit && pnpm test && pnpm build && node scripts/smoke-load.mjs` → all exit 0.

---

# Final Plan Review: Dev Harness V2 Plugin

**Plan slug:** dev-harness-v2-plugin
**Review against:** plan.md Requirements Snapshot (R1–R7) — no task.md exists (fallback per final-review skill)
**Reviewer:** @final-reviewer (code-review skill) · **Date:** 2026-09-28
**Overall risk:** Low
**Verdict:** Approve with comments

## Plan Completion Status

| Sub-task | Status | Notes |
|---|---|---|
| ST1 — Scaffold + scoped extraction (R1) | Completed | 6 agents (2 aliased), 11 skill dirs + index.md; no commands/, no prompts/; junk/secrets 0; provenance in EXTRACTION.md |
| ST2 — Audit (R2) | Completed | audit exit 0, zero FAIL; warn-only out-of-bundle cross-refs documented; all ST2 P2/P3 findings resolved (resolution log) |
| ST3 — NEW `coding` skill (R3) | Completed | 87 lines ≤ 250; TDD + CODE_RULES.md + project-type aware; global-guideline by convention |
| ST4 — Skills-loop embedding (R4) | Completed | AGENTS.md (78 lines ≤ 120) + Loop Integration in execute-plan/execute-plan-task; 2.4 hard-blocker explicit |
| ST5 — V2 plugin build (R5) | Completed | tsup ESM + dist/assets; Plugin.define, agent+skill transforms only; zero command transforms |
| ST6 — Tests + verification (R6) | Completed | 51/51 tests; registration test on real bundle asserts 6 agents/12 skills/0 commands; real-session limitation documented |
| ST7 — Docs (R7) | Completed | README, LOADING.md, skills/index.md (12 skills, mermaid loop incl. coding + 2.4 STOP); counts match repo |

## Requirements Verification

| Requirement | Status | Evidence |
|---|---|---|
| R1: Scoped extraction (6 agents + 12 skills, opencode-only, no secrets/configs) | PASS | `agents/` = 6 files (software-architect/software-engineer bodies byte-identical to source per `extract --check`), `skills/` = 12 dirs + index.md; no `commands/`/`prompts/` dirs (verified `ls`); 0 high-signature secrets, 0 junk, 0 symlinks; `~/.agents` read-only guard in extract.mjs; machine configs/v1 plugin/copilot-gemini variants excluded per EXTRACTION.md |
| R2: Audit (frontmatter, name regex, size limits, cross-refs, loop, secrets, junk; exit 0, zero FAIL) | PASS | Re-ran `node scripts/audit.mjs` → exit 0, verdict PASS, failFindings 0; 18/18 frontmatter parse; regex all match; size deviations 0 (max 197 lines < 250/300); loop 12/12 skills + 6/6 agents present; secretFailures 0; junkFiles 0; cross-ref WARN = 5 out-of-bundle `@build`/`@plan` mentions + 75 kebab prose tokens, warn-only per plan cautionary |
| R3: NEW `coding` skill (TDD; CODE_RULES.md at project root; project-type aware; global guideline by convention) | PASS | `skills/coding/SKILL.md` exists, parses, name matches regex, 87 lines ≤ 250; description encodes TDD + CODE_RULES.md + triggers ("implement, write code, fix a bug"); body: red→green→refactor, CODE_RULES.md resolution order (present → override; absent → global fallback; always test-first), project markers, software vs non-software delegation, @executor validation, 3-strike stop; convention note for `~/.agents/prompts/coding-guideline.md` (not bundled) |
| R4: Skills-loop embedding (AGENTS.md + execute-plan/execute-plan-task; 2.4 hard-blocker) | PASS | AGENTS.md carries the verbatim 5-step loop with 2.1–2.4 and "Step 2.4 halts automation"; both bundled skill copies have `## Loop Integration (bundled)` with coding (2.1), domain-check gate, simplify (2.2), review+code-review (2.3), hard-blocker stop (2.4); additive patches, no contradiction with source P0/P1 stop rules; audit loop membership green |
| R5: V2 plugin build (tsup ESM, dist/assets, agent+skill transforms, NO commands) | PASS | `pnpm build` → dist/plugin.js (ESM, 6.95 KB) + dist/assets (6 agents + 12 SKILL.md + index.md + create-documentation/references/); src/plugin.ts `Plugin.define({ id: "dev-harness-skills" })`, assets loaded before sync transforms, agent update-upsert + skill add only; grep of bundle confirms zero command transforms; `import.meta.dirname` (CWD-independent); engines >=20.11; `@opencode/plugin` ^2.0.18 + yaml external/deps aligned |
| R6: Validation/verification (tests; real-session load of 6 agents + 12 skills; audit resolved) | PASS (with documented limitation) | `pnpm typecheck` ✅, `pnpm test` 51/51 ✅ (frontmatter 26, records 11, assets 6, manifest 6, registration 2), registration test runs the real built bundle against a stub ctx and asserts exactly the 6 manifest agents + 12 skills + 0 commands ✅; smoke-load ✅; real-session load NOT confirmed on opencode v2.0.18 (4 load forms attempted, limitation + open questions documented in verification.md, README, LOADING.md) — degradation path per plan assumptions exercised; see P2-1 for the substitute deviation |
| R7: Documentation (README, loader guide, adapted skills/index.md) | PASS | README.md (86 lines) — provenance, manifest 6/12, quickstart, gate, layout, troubleshooting; docs/LOADING.md — directory-form `"plugins"` entry, verification checklist, troubleshooting incl. `pnpm audit` vs `pnpm run audit` and real-session note; skills/index.md (92 lines) — 12 skills, `coding` callout, mermaid loop graph with coding node + 2.4 STOP edge; doc counts spot-checked against repo (6/12, no commands/prompts) |

## Findings

### [P0] Blocking

None.

### [P1] High

None.

### [P2] Medium

- **Real-session load never confirmed; the degradation substitute deviates from the documented `@opencode/sdk` fallback, and the live-load open question is still open**
  - **Location**: `docs/plans/dev-harness-v2-plugin/tasks/verification.md:31-47`; plan.md R6 / Assumptions ("falls back to an `@opencode/sdk` embedded integration test"); ST6 AC
  - **Why it matters**: the plugin's core contract (registering agents/skills in a live opencode host) is verified only indirectly (stub-ctx registration test + smoke-load). None of the 4 attempted load forms surfaced the manifest agents on opencode v2.0.18, and no plugin-load error was emitted — root cause undetermined (plugin discovery vs `editor.update` upsert semantics). The plan's stated fallback was an `@opencode/sdk` embedded test; the shipped substitute is a hand-rolled stub ctx — functionally similar coverage of the plugin's own logic, but it exercises no real host code path. A future host change could silently break registration and this would not be caught.
  - **Evidence**: verification.md:38-42 "the local opencode v2.0.18 host did not surface plugin-registered agents through any of the four load forms attempted"; ST6 review "documented environment limitation"; README/LOADING.md carry the same note — limitation is transparent, no false claim.
  - **Fix**: once configurable plugin loading is confirmed, re-run the real-session check via the installed-package form (`pnpm pack` + `opencode plugin add`) or an `@opencode/sdk`-embedded integration test, and record the outcome in verification.md/README. Non-blocking because the plan explicitly provides the degradation path and the limitation is documented.

### [P3] Low

- **Bundled skill bodies reference out-of-bundle harness resources by absolute `~/.agents/` path**
  - **Location**: `skills/execute-plan/SKILL.md:120-127`, `skills/execute-plan-task/SKILL.md:158-164` (and similar references elsewhere)
  - **Why it matters**: a runtime agent executing inside the plugin may chase `~/.agents/commands/plan.md`, `~/.agents/skills/evolve/...`, `state-sync`, `semver`, `next-subtask.md` etc. — none of which exist in the plugin scope. The audit reports these as warn-only (5 `@build`/`@plan` mentions, 75 kebab tokens) by design (bodies byte-identical per R1). Impact: possible confusion or failed tool lookups at runtime; no security exposure.
  - **Fix**: extend the Loop Integration sections (or index.md) with a short "Bundled scope" note listing what is *not* bundled (evolve/state-sync/semver/commands), so executing agents normalize to in-scope alternatives.
- **Agent records pin the machine-specific model `opencode-go/deepseek-v4-flash` (+ `variant: max` on 4 of 6 agents)**
  - **Location**: frontmatter of all `agents/*.md`; `src/lib/records.ts:104-116` maps it onto the V2 agent record
  - **Why it matters**: the plugin registers agents hard-bound to the local provider ID; loaded on a host without that provider, agent model resolution may fail or silently fall back. Extraction scope keeps frontmatter as-is (it is source content), so this is a portability note, not a defect.
  - **Fix**: document model overridability in README (how to override per-agent model after load) — no code change required.
- **`docs/plans/index.md` and plan.md frontmatter still show `status: Pending` / active Yes**
  - **Location**: `docs/plans/index.md:5`, `docs/plans/dev-harness-v2-plugin/plan.md:12`
  - **Why it matters**: plan.md "Final Integration & Verification" step 5 directs updating index.md to Completed + active No once the plan is complete. This is the sign-off follow-up (execute-plan convention), not an implementation defect.
  - **Fix**: after this final review, update index.md (and plan.md frontmatter) to `Completed` / active No.
- **plan.md frontmatter `description` still says "registering agents, skills, and commands via domain transforms"**
  - **Location**: `docs/plans/dev-harness-v2-plugin/plan.md:9`
  - **Why it matters**: stale wording from the pre-scope-revision draft, contradicted by the plan body and every deliverable (commands are out of scope by user mandate). Doc nit, no runtime impact.
  - **Fix**: reword to "registering agents and skills via domain transforms (no commands)".

## Integration Assessment

- Cross-sub-task integration: none found. Manifest single-source (`scripts/manifest.json`) flows through extract → audit → copy-assets → build; `bundledSkillMdCount` self-adjusts for `coding` (ST2 P2 fix verified — audit passes 12/12 with coding present); the 12-skill inventory matches ST3/ST5/ST7 counts everywhere; loop references resolve to bundled items; AGENTS.md normalization table matches runtime delegation (no `@build`/`@senior-*` reliance in the loop-critical patched sections).
- Regression risk across full scope: **low** — fresh repo (no commits/history), no prior code to regress, source `~/.agents` untouched (verified read-only guard + one-way copy); the only external-behavior risk is the unverified live-host load (P2-1).

## Release Readiness (software project)

- Gate commands (re-run this review, node v24.18.0 / pnpm 11.9.0): `pnpm typecheck` ✅ · `pnpm run audit` ✅ (exit 0, FAIL 0) · `pnpm test` ✅ 51/51 · `pnpm build` ✅ (dist/plugin.js 6.95 KB, copy-assets OK) · `node scripts/smoke-load.mjs` ✅ (valid Plugin.define, id dev-harness-skills) — **full gate PASS**.
- Artifact checks: `dist/assets` = 6 agent .md + 12 SKILL.md + index.md (+ references/) — counts exact; `dist/plugin.d.ts` + lib declarations present; bundle contains zero command transforms; `dist/` git-ignored; `node scripts/extract.mjs --check` PASS (6/12, no commands/prompts, junk 0, symlinks 0, alias bodies identical).
- `pnpm audit` (dependency security): exits 1 on **1 low dev-only esbuild advisory** (Windows dev-server arbitrary file read; path `.>tsup>esbuild`, `.>vitest>vite>esbuild`) — dev-dependency only, no runtime exposure in the ESM bundle; documented in LOADING.md; **not a gate blocker**.
- Real-session host verification: **UNVERIFIED** (documented limitation, P2-1) — the only release-readiness caveat.
- Recommended `semver` bump: **release as-is at `0.1.0`** (no bump). No prior tag/commit/published version exists, so semver "bump" rules don't apply; 0.1.0 is the correct initial version for a fresh private package. To publish, remove `"private": true` and `pnpm pack`. Forward path: `0.1.1` after the live-load question is resolved on a future host, `0.2.0` for new bundled skills/agents, `1.0.0` once live-load is proven and the manifest is stable.
- Changelog generated: no (initial release; nothing to diff against).

## Sign-off Verdict

**Verdict:** Approve with comments
**Recommendation:** Merge — all 7 sub-tasks Completed, R1–R7 PASS (R6 via documented degradation path), release gate green, artifacts valid. Track the P2-1 live-load verification and the P3 follow-ups (index.md status flip, bundled-scope note, model portability note) as post-merge issues. No P0/P1 findings; nothing blocks the initial 0.1.0 release.

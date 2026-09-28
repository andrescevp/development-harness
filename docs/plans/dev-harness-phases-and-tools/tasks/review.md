# Sub-Task Review: M1 — Phased plan format + planning skill update

**Verdict: Approve** (ST1 review: P2 fixes applied, no P0/P1).

## Findings resolved
- [P2] Fixture preamble before frontmatter → moved below closing `---` (file now starts with `---`, frontmatter.ts compatible).
- [P2] "immediately after" ambiguity → rules 3/5 clarified (first `- **Status:**` bullet; only blank lines precede it; before any other heading/field; phases region termination at next top-level `##` or EOF).
- [P3] EXTRACTION.md re-extract hazard → warning added (do not re-run extract until ST3 PATCHES).
- [P3] Fixture comment "one sub-task" → "at least one sub-task".
- [P3] Description tools mention → guarded with "when installed".

## Acceptance criteria
AC1 contract unambiguous ✅ · AC2 SKILL.md 101 ≤ 250, audit exit 0 zero FAIL ✅ · AC3 fixture consistent (2 phases, 3 sub-tasks, valid statuses) ✅ · AC4 stable for ST2 consume ✅

## ST2 Review (2026-09-28)

**Verdict: Approve with comments** — reviewer initially requested changes (2 P1, 5 P2, 3 P3); ALL findings addressed, gate re-green.

Resolved:
- [P1] CRLF: markers now match `(.+?)\r?$`; setStatus preserves the trailing CR; CRLF fixture test added.
- [P1] Tool.Result shape: executors return `{ content: JSON.stringify(...) }`; `as never` casts removed; execute typed per contract (input: unknown, cast inside).
- [P2] Sibling sub-task sections: findSections now closes the previous section for siblings; test added (1.1 without Related Requirements does not inherit 1.2's).
- [P2] Unparseable content: parsePlan throws when `## Phases` / `### Phase N` missing; unterminated frontmatter throws (meta parsed first); orphan sub-tasks throw; invalid status values throw (no silent Pending coercion).
- [P2] Symlink traversal: resolvePlanPath lstat-walks components and rejects symlinks; temp-symlink test added.
- [P2] CWD fallback: empty workspaceRoot now throws ("no workspace root available; pass explicit path").
- [P2] 300-line rule: template literals moved to src/tools/plan-template.ts (plan-lifecycle.ts now 268 ≤ 300).
- [P3] index.md row aligned to real columns + pipe escaping.
- [P3] Registration test: codemode asserted true for all 3 tools, namespace harness asserted, command stub throws if touched (0 commands verified meaningfully).

Gate: typecheck ✓ · build ✓ · 72/72 tests ✓ (new crlf/unparseable/orphan/symlink/empty-root/codemode cases) · smoke-load ✓ · audit exit 0 ✓.

## ST4 Review (2026-09-28)

**Verdict: Approve** — all 4 loop skills wired to the phased model + harness tools; validations green.

- execute-plan (157 lines): phase-ordered iteration, phase lifecycle, phase-aware resume, harness_plan_read/update_status usage, phase-close step 3a, Loop Integration restored with 2.4 phase-boundary extension, P0/P1 + blocked-phase stop preserved.
- execute-plan-task (184 lines): phase-aware selection (first In Progress phase → its sub-task), tool-based status updates, phase coordination (tell orchestrator when phase ready; never self-close with open sub-tasks), 2.4 preserved, coding delegation intact.
- review (145) / final-review (155): phase-aware selection + per-phase completion in sign-off; full loop pointed to AGENTS.md.
- Manifest allowlist: phase-aware, phase-completion, repo-root added (rationale comment).
- Gates: audit exit 0 (12/12 + 6/6), extract --check exit 0, wc ≤ 250 each, pnpm test 73/73.
- **Flag resolved**: ST3 re-extract had clobbered planning/SKILL.md (flat source version) before repoAuthored existed; restored the phase-aware 101-line version from dist/assets; planning is now protected by repoAuthored.skills so builds/extracts preserve it (verified check+audit green).

## ST5 Review (2026-09-28)

**Verdict: Approve.** ST5 (agents + docs):
- `software-architect` / `software-engineer` carry a sanctioned plan-tools body note (M2 wiring) applied by the patches pipeline (`append-body-note`); alias-body integrity check strips the marker block and normalizes trailing newlines (verified check PASS).
- AGENTS.md (96 lines): phased loop text + phase lifecycle + 2.4 phase-boundary extension + harness tools; skills/index.md (105): phased loop + tools section; README (107): phased plans, tools table, permission-strip provenance.
- Gates: typecheck ✓, audit exit 0, extract --check PASS, pnpm build ✓, smoke-load ✓, pnpm test 73/73 (M3 permission unit test included).

## ST6 Review (2026-09-28)

**Verdict: Approve.** ST6 (validation + docs): LOADING.md gains the harness tools reference table (+ phase gate + path-safety notes); verification record written; full gate green (see tasks/verification.md). Real-session note duplicates the base-plugin limitation; tool logic covered by 21 unit tests.

## Final Plan Review (phases-and-tools)

**Date:** 2026-09-28 · **Reviewer:** @final-reviewer · **Branch:** feat/dev-harness-phases-and-tools (all work uncommitted — expected, base plan state) · **Plan:** `docs/plans/dev-harness-phases-and-tools/plan.md` (no task.md — reviewed against Requirements Snapshot R1–R5) · **Scope:** M1 phased plans, M2 harness plan-lifecycle tools, M3 permission-key removal

**Verdict: Approve with comments.** All functional gates pass; one core-requirement mechanism deviation (R4) and two status-marker hygiene issues must be recorded/fixed before merge. No P0.

### Requirements table

| Req | Result | Evidence |
|---|---|---|
| R1 — Phased plan model | ✅ PASS | `skills/planning/references/phased-plan-template.md` (9 marker rules + full template + lifecycle contract, 123 lines); fixture `src/__tests__/fixtures/plans/phased-plan.md` (2 phases / 3 sub-tasks, mixed statuses, in sync with template); `planning` SKILL.md 101 ≤ 250 lines; `execute-plan` (157) / `execute-plan-task` (184) / `review` (145) / `final-review` (155) all phase-aware with `harness_plan_*` refs; AGENTS.md 96 lines phased loop + 2.4 phase-boundary rule; skills/index.md mermaid graph updated; README covers phased plans. |
| R2 — Plan-lifecycle tools | ✅ PASS | 3 tools registered under namespace `harness`, `codemode: true` (`src/plugin.ts:90-175`); effective ids `harness_plan_read` / `harness_plan_update_status` / `harness_plan_create`; pure helpers `parsePlan` / `setStatus` / `buildPlanTemplate` in `src/tools/plan-lifecycle.ts` (268 ≤ 300, template literals split to `plan-template.ts`); 21 vitest cases (fixture+template parse, CRLF, orphan sub-tasks, unparseable, symlink/escape/empty-root rejection, phase→Completed gating, idempotent same-status no-op); path resolution anchored via `ctx.location?.directory`, never `process.cwd()`. |
| R3 — Permission key removal | ✅ PASS | `grep -c '^permission:' agents/*.md` = 0/0/0/0/0/0; source `~/.agents/agents/*.md` still carries the key (untouched); `scripts/manifest.json` `patches` → `strip-frontmatter-key` (state-machine block strip, body-protected); `extract.mjs --check` PASS (re-ran in this review); re-extract idempotent (sha256 stable across two runs); audit FAIL-level permission check (audit.mjs:83-84); M3 unit test in frontmatter suite; EXTRACTION.md + README document the patch. |
| R4 — Skills/agents wiring | ⚠️ PASS (deviation) | 4 loop skills + planning use the tools; 2.4 hard-blocker text preserved verbatim; AGENTS.md/index/README mention tools. **Deviation:** `software-architect`/`software-engineer` do NOT carry the 3 harness tools in their frontmatter `tools:` maps (R4 + ST5 AC1 as written); instead a body note (`> Harness plan tools (bundled):`) was appended via a new `append-body-note` patch. The approved `ensure-tools-entry` patch shape exists only in plan.md, not in manifest.json — no plan amendment recorded (see P1). |
| R5 — Validation & documentation | ✅ PASS | Full gate re-run this review (below); EXTRACTION.md + README + docs/LOADING.md document the strip and the tools (usage + troubleshooting incl. idempotency/path notes); `tasks/verification.md` written with gate results and documented real-session limitation (host v2.0.18 did not surface plugin-registered agents/tools via file-path load — stub registration test stands in). |

### Release readiness (re-run 2026-09-28, node v24 / pnpm 11, `. ~/.nvm/nvm.sh`)

| Command | Exit | Result |
|---|---|---|
| `pnpm typecheck` | 0 | PASS |
| `pnpm run audit` | 0 | PASS — FAIL findings 0, warn deviations 0; loop 12/12 skills + 6/6 agents; junk 0, secrets 0, symlinks 0 |
| `pnpm test` | 0 | PASS — 73/73 (frontmatter 27, records 11, assets 6, manifest 6, registration 2, plan-lifecycle 21) |
| `pnpm build` | 0 | PASS — dist/plugin.js 20.57 KB ESM, copy-assets 6 agents + 12 SKILL.md |
| `node scripts/smoke-load.mjs` | 0 | PASS — valid `Plugin.define` |
| `node scripts/extract.mjs --check` | 0 | PASS — agents 6, skills 12 dirs + index.md, no commands/, no prompts/, alias bodies identical |
| extract re-run idempotency | — | PASS — sha256 of `agents/software-engineer.md` + `skills/planning/SKILL.md` stable across two runs |

### Regression check vs base manifest

6 agents exactly (`software-architect`, `software-engineer`, `reviewer`, `final-reviewer`, `executor`, `explorer`) ✅ · 12 skills incl. `coding` ✅ · 0 commands / 0 prompts dirs ✅ · 3 harness tools with namespace + codemode asserted in `registration.test.ts` ✅ (command-stub throws if touched) · skill line limits all ≤ 250 ✅ · agent line limits ≤ 300 ✅ · no secrets/credentials in repo (audit secret scan PASS + spot grep) ✅ · rollback: full repo is untracked on a fresh branch — no prior commit exists, so the base state lives in `dist/assets`/source `~/.agents` (read-only, untouched); re-extract is the recovery path and is idempotent ✅.

### Findings

- **[P1] R4/ST5 mechanism deviation: harness tools not in agent `tools:` maps — body note used instead (no plan amendment)**
  - **Location**: `scripts/manifest.json` `patches` (`append-body-note`); `agents/software-architect.md`, `agents/software-engineer.md` (body note after line ~86); plan.md R4 + ST5 AC1 vs tasks/review.md ST5 narrative ("sanctioned")
  - **Why it matters**: The approved plan requires the 3 harness entries in the agents' frontmatter `tools:` maps; the implementation appends a system-prompt body note instead and the approved `ensure-tools-entry` patch never shipped. Consequences: (a) acceptance criterion not met as written; (b) `buildPermissions` (records.ts:63-83) derives the V2 ruleset from `tools` only, so the planner agents' permission rules contain no entries for `harness_plan_*` — whether `codemode` custom tools bypass per-agent permission checks is exactly the behavior the plan could not verify live (verification.md limitation), so the "body note is sufficient" claim is unproven.
  - **Evidence**: `grep -E 'plan_(read|update_status|create)' agents/software-architect.md` → only the body-note lines; frontmatter `tools:` map contains only `bash/read/write/edit`; `ensure-tools-entry` appears nowhere except plan.md (Core concepts + ST3/ST5 scope) — manifest.json has `append-body-note` instead.
  - **Fix**: Record the deviation as an explicit plan amendment (user-approved, with rationale) in plan.md before merge, and keep the live-host confirmation (`harness_plan_*` callable from the bundled planner agents) as a tracked open follow-up. If the tools must be unconditionally agent-callable, add the entries to the `tools:` maps via the originally planned `ensure-tools-entry` patch (mind the bare-name vs effective-id permission-matching question) or rely on codemode access once verified.

- **[P2] ST1 status marker never flipped; plan not closed in index.md**
  - **Location**: `docs/plans/dev-harness-phases-and-tools/plan.md:183` (`- **Status:** In Progress` under Sub-Task 1); `docs/plans/index.md:6` row still `Pending | Yes`
  - **Why it matters**: This plan ships the dual-status-marker contract; signing off with 5/6 sub-tasks Completed and one In Progress violates the plan's own lifecycle rules and the final-review "all sub-tasks Completed" gate. A resume run would re-enter ST1 despite its content being complete and reviewed (ST1 review: Approve).
  - **Evidence**: `grep -n "Status:" plan.md` → ST1 In Progress, ST2–ST6 Completed; index.md row `Pending | Yes`.
  - **Fix**: Flip ST1 to `Completed` and the index.md row to `Completed | No` as part of closeout (Final Integration & Verification step 6).

- **[P2] Verification record doesn't note the R4 deviation**
  - **Location**: `docs/plans/dev-harness-phases-and-tools/tasks/verification.md` (M2/M3 scope + "Open follow-ups")
  - **Why it matters**: The record is the closeout artifact a future reviewer reads; it claims M2/M3 scope verification without mentioning that the agent wiring mechanism differs from the approved plan (body note vs tools map) or the unverified permission-gating question.
  - **Fix**: Add a deviation line with rationale + the live-host follow-up (fold into P1 fix).

- **[P3] `resolvePlanPath` empty-root error message is misleading**
  - **Location**: `src/tools/plan-lifecycle.ts:240`
  - **Why it matters**: The message says "pass an explicit `path` input", but an explicit path is checked after the empty-root guard (`if (!workspaceRoot) throw`) and is also rejected — the suggested workaround cannot work; agents would loop on the same error. No CWD fallback occurs (guard is correct), so impact is cosmetic/operational only.
  - **Evidence**: `resolvePlanPath("", "s", "x.md")` throws the same "no workspace root" error despite `path` being provided.
  - **Fix**: Reword to "no workspace root available; cannot resolve plan paths safely (plugin location did not provide a directory)".

### Suggested next steps

- [ ] Record the R4 deviation + rationale as a plan amendment (or apply `ensure-tools-entry` as originally approved) before merge — P1
- [ ] Flip ST1 status in plan.md and the index.md row to Completed/No on closeout — P2
- [ ] Add the deviation + live-host tool-call follow-up to tasks/verification.md — P2
- [ ] Reword the empty-root error message — P3

### Semver recommendation

**Minor bump: 0.1.0 → 0.2.0.** This change adds user-visible features to the plugin (phased plan model, 3 new harness-namespace tools, agents shipped without `permission`). Per semver, feature additions in a 0.x line increment the minor version; nothing here is a patch-level fix (no bug fixes) and nothing breaks the plugin's public registration contract (6 agents / 12 skills / dynamic tool registration remains additive for hosts that support `ctx.tool`). A major would be inappropriate at 0.x pre-stability. Tag `v0.2.0` after closeout.

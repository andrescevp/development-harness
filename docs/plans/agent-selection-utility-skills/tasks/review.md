# Review — agent-selection-utility-skills

## Final Plan Review

**Plan slug:** `agent-selection-utility-skills`
**Plan:** `docs/plans/agent-selection-utility-skills/plan.md` (313 lines) · **SDD:** `sdd.md` (145 lines)
**Branch:** `feature/agent-selection-skills`
**Range reviewed:** `8696231` (develop) → working tree; plan commit `739938b` plus the uncommitted implementation (67 tracked files changed, 7 untracked paths / 8 files, no dependency changes)
**Review date:** 2026-11-08
**Reviewer:** `dh-final-reviewer` (bundled final-review capability, selected by the `dh-final-review` skill for the final-review role)
**Overall risk:** Low–Medium
**Verdict: Approve with comments** — no P0/P1 findings. Four non-blocking P2 items (one R3 completeness gap, one fast-mode hash/recording collision, one demo-docs/config documentation gap, one fast close-out bookkeeping gap) and four P3 polish items are recorded below. The implementation is coherent, gate-green, and consistent with the approved SDD/plan.

This verdict is binding for Sub-Task 5.2's review gate. Phase 5 remains `In Progress` because 5.2 also includes the merge; that is the expected pre-sign-off state (as in `docs/plans/pause-resume-plan-skills/tasks/review.md`).

### Runtime agent-selection record

`plan.md` has no `## Agent Selection` section: it was authored before Sub-Task 1.2 added the section to the template. Adding it now would change the `plan.md` body that `plan_fast.md:6` hashes (`source_sha256` strips only status lines — `src/tools/plan-fast-template.ts:49-54`), making the mirror stale and blocking a fast plan-end read. The selection is therefore recorded here, which R9 explicitly allows ("the plan's `## Agent Selection` table **or an explicit runtime selection record**"):

| Role | Selected agent | Why | Fallback |
|---|---|---|---|
| Final review | `dh-final-reviewer` | The only final-review persona in this repo (`agents/dh-final-reviewer.md`); no project-specific reviewer exists. | bundled final-review capability |
| Implementation / review | resolved per run by `dh-execute-plan-task` / `dh-review` from the plan table or the protocol | This plan has no table, so execution runs the protocol (runtime list → project config/dirs → global). | bundled implementation / review capability |

### Plan completion status

| Phase | Sub-task | Status | Notes |
|---|---|---|---|
| Phase 1 — Agent-selection contract | 1.1 Author the agent-selection protocol | Completed | `skills/dh-planning/references/agent-selection.md` (161 lines) |
| Phase 1 | 1.2 Add `## Agent Selection` to the plan template | Completed | Template, scaffold, fixture, 4 fast omitted lists |
| Phase 1 | 1.3 Update `dh-planning` to select and record agents | Completed | `skills/dh-planning/SKILL.md:33,76,101-104,110` |
| Phase 2 — Utility agent-to-skill migration | 2.1 Create `dh-execute-cli` | Completed | `skills/dh-execute-cli/SKILL.md` (123 lines); `agents/dh-executor.md` deleted |
| Phase 2 | 2.2 Create `dh-explore` | Completed | `skills/dh-explore/SKILL.md` (87 lines); `agents/dh-explorer.md` deleted |
| Phase 2 | 2.3 Replace executor/explorer references | Completed | Repo-wide `rg` clean; demo/docker/docs updated |
| Phase 3 — Delegation cleanup | 3.1 Execution and review delegation | Completed | `dh-execute-plan*`, `dh-review`, `dh-final-review`, `dh-simplify` |
| Phase 3 | 3.2 Docs, setup, semver, preflight, artifact, footers | Completed | 24 skill bodies share the generic doc-search footer |
| Phase 3 | 3.3 Agent definitions and harness docs | Completed | 5 agent files, `AGENTS.md`, `README.md`, `docs/LOADING.md`, `skills/index.md` |
| Phase 4 — Inventory, tests, docs | 4.1 Inventory counts and smoke checks | Completed | 5/24/29 everywhere; 12 tools unchanged |
| Phase 4 | 4.2 Agent-selection contract test | Completed | `src/__tests__/agent-selection.test.ts` (135 lines) |
| Phase 4 | 4.3 Documentation counts and tables | Completed | Audit regenerated; no stale 7/22 claims |
| Phase 5 — Validation and release | 5.1 Run the full validation gates | Completed | Re-run independently; all green (see Release Readiness) |
| Phase 5 | 5.2 Final review and merge | In Progress | This review is its review gate; merge/close-out remains |

**Per-phase completion:** Phase 1 — Completed (3/3); Phase 2 — Completed (3/3); Phase 3 — Completed (3/3); Phase 4 — Completed (3/3); Phase 5 — In Progress (1/2; 5.2 is this review). No phase was marked `Completed` with open sub-tasks, and no blocker was bypassed.

### Requirements verification

| Requirement | Status | Evidence |
|---|---|---|
| R1 — shared agent-selection protocol (discovery, classification, preference, fallback, recording) | **PASS** | `skills/dh-planning/references/agent-selection.md:13-29` (discovery), `31-46` (capability roles), `48-65` (ranking), `67-73` (ties), `75-83` (fallback), `85-106` (recording), `108-121` (re-validation), `123-137` (failure) |
| R2 — `dh-planning` inspects agents, selects, records `## Agent Selection`, no `@dh-*` | **PASS** | `skills/dh-planning/SKILL.md:33` (protocol rule), `76` (Select agents step), `101-104` (output template), `110` (Final Check); `rg '@dh-' skills/dh-planning` → 0 |
| R3 — every delegating skill uses the protocol; no hardcoded `@dh-*` | **PASS with P2 comment** | Zero `@dh-` in `skills/` and `agents/` (verified); protocol linked from `dh-planning`, `dh-execute-plan*`, `dh-review`, `dh-final-review`, `dh-coding`, `dh-contingency`, `dh-create-documentation`, `dh-setup`. `dh-simplify` launches review agents without the protocol — see P2-1 |
| R4 — executor/explorer agents removed; utility skills created | **PASS** | `agents/` has 5 files; `agents/dh-executor.md` / `dh-explorer.md` absent; `skills/dh-execute-cli/SKILL.md`, `skills/dh-explore/SKILL.md` parse and load (`agent-selection.test.ts:58-71`, `frontmatter.test.ts` corpus test) |
| R5 — all `@dh-executor`/`@dh-explorer` references become skill invocations | **PASS** | `rg '@dh-executor|@dh-explorer'` across the active surface → only the contract test's negative assertions (`src/__tests__/agent-selection.test.ts:59-60`); old agent bodies preserved in the skills with invocation grammar |
| R6 — behavior preserved (logged command, least privilege, exploration, planning, review, docs) | **PASS** | Executor rules and temp-log/head-tail strategy preserved (`dh-execute-cli/SKILL.md:21-102`); explorer rules preserved and expanded (`dh-explore/SKILL.md:19-67`); planning/implementation/review/docs flows keep their single-executor and ownership rules |
| R7 — 5 agents / 24 skills / 29 unique names; all counts updated | **PASS** | `src/cli/plugin-artifact.ts:33-34`; `scripts/lib/shared.mjs`; `pack-contract.mjs`; `pack-install.mjs`; `smoke-pack.mjs`; `docker-test.sh`; tests; audit `29 / 5/24`; 12 tools unchanged |
| R8 — AGENTS/README/LOADING/skills index/demo/config explain protocol + new skills | **PASS with P2 comment** | `AGENTS.md:83-109`; `README.md:196-222`; `docs/LOADING.md:180-193`; `skills/index.md:3,97-142`; demo docs/config updated counts but do not describe selection — see P2-3 |
| R9 — selection inspectable/deterministic for a run (table or runtime record) | **PASS** | Execution skills read `## Agent Selection` and re-validate (`dh-execute-plan:33,57`; `dh-execute-plan-task:19,52`; `dh-execute-plan-fast:44`; `dh-execute-plan-task-fast:35-40`; `dh-review:20`; `dh-final-review:22`); this plan's runtime record is the table above (plan predates the section; see hash note) |
| R10 — gates prove zero hardcoded refs, removed files, new skills, 5/24, full suite | **PASS** | Independent re-run: `rg` clean, build 5/24, test 46/721, typecheck/lint/dup/depcruise/links/audit/smokes green (Release Readiness) |

### Acceptance criteria coverage

| AC | Result | Evidence |
|---|---|---|
| AC1 — `rg "@dh-" skills/` empty | **PASS** | Command returns no matches (also `agents/`) |
| AC2 — removed agent files absent; new skills exist and load | **PASS** | `ls agents/` → 5; both `SKILL.md` parse via `parseFrontmatter` (`agent-selection.test.ts:63-71`); build/copy-assets reports 24 skills |
| AC3 — `dh-planning` references the protocol, populates the section, prefers project agents | **PASS** | `dh-planning/SKILL.md:33,76,101-104`; protocol ranking `agent-selection.md:48-65` |
| AC4 — execution/review/final-review/docs/setup/semver/preflight/artifact skills have no hardcoded references and use the utility skills | **PASS** | Zero `@dh-`; `dh-execute-cli` used by `dh-coding`, `dh-preflight`, `dh-artifact-check`, `dh-semver`, `dh-create-documentation`, `dh-setup`, `dh-pause-plan`, `dh-resume-plan`; `dh-explore` by `dh-contingency` |
| AC5 — inventory 5/24/29; build/smoke/audit/typecheck/lint/tests pass | **PASS** | Re-run evidence in Release Readiness; `reports/audit.md:13,18` |
| AC6 — docs/indexes list 5/24 and explain selection; no stale 7/22 | **PASS with P2 comment** | Primary docs explain it; `rg '7 agents|22 skills'` active surface → 0. Demo docs/config lack the protocol note (P2-3) |
| AC7 — template/scaffold include `## Agent Selection`; fast lists treat it as omitted | **PASS** | `phased-plan-template.md:80-86`, `plan-template.ts:99-105`, fixture `:51-53`; `plan-fast-template.ts:15-25`; `dh-execute-plan-fast:35`; `plan-fast-template.md:95`; `dh-review:50-53`; tests `mermaid-skill.test.ts:150-169` and `agent-selection.test.ts:93-111` |
| AC8 — contract test fails on reintroduced `@dh-*`, removed file, missing skill, count drift | **PASS** | `src/__tests__/agent-selection.test.ts:50-126`: walks all `skills/` + `agents/` files, checks removed paths, parses both skills, asserts 5/24/29. (It does not scan docs/config — see the Integration assessment observation) |

### Fast-mode bookkeeping

- `plan.md` and `plan_fast.md` status parity: **PASS** — 19/19 status lines identical; the `## Phases` region is byte-identical (18,425 chars each); both frontmatter `status: In Progress`; `active: true`.
- Source hash: **PASS** — the repository algorithm (`computeSourceSha256`, `src/tools/plan-fast-template.ts:49-54`) recomputes `776482f237fa9095b88f5151d14ee0de3a6ee19c1041151658b083deb3bbd4a4`, matching `plan_fast.md:6`; the mirror should report `stale: false`.
- Ledger append-only shape: **PASS** — 102 rows (6 `Plan` seed rows + 14×6 per-task rows + one duplicate 6-row block each for re-run 4.2/4.3), timestamps monotonic, header intact, no deletions; `updated: 2026-11-08`.
- Ledger end rows: **INCOMPLETE (P2-4)** — no `End gates` outcome rows yet; `dh-execute-plan-fast` Step 6.6 requires one per deferred/conditional check. This is downstream of the final review by design, but must be appended before Step 7 closes the plan.
- Plan-end alignment report: **MISSING (P2-4)** — `tasks/review-fast-final.md` is required by `dh-execute-plan-fast:42,133-134`; only the pre-execution `tasks/review-fast.md` exists.

### Findings

#### [P0] Blocking

None.

#### [P1] High

None.

#### [P2] Medium

##### P2-1 — `dh-simplify` delegates to review agents without the selection protocol

- **Location:** `skills/dh-simplify/SKILL.md:21-23`
- **Why it matters:** R3 requires every skill that delegates work to use the selection protocol. `dh-simplify` was in Sub-Task 3.1's scope, but its only change is the shared doc-search footer; the body still says "Launch Three Review Agents in Parallel" / "Use the Agent tool to launch all three agents" without resolving the review capability or linking `agent-selection.md`. A project-specific reviewer therefore cannot be honored in the simplify pass, which is the one delegating skill still outside the model.
- **Evidence:** `rg -l 'agent-selection' skills/` does not list `dh-simplify`; `git diff 8696231 -- skills/dh-simplify/SKILL.md` shows only the footer line; `rg '@dh-' skills/dh-simplify/SKILL.md` → 0 (no hardcoded ID, so low risk).
- **Fix:** Add one rule to Phase 2: "Resolve each review pass to the plan's selected review agent (or the bundled review capability) using `skills/dh-planning/references/agent-selection.md`; pass the same agent/capability to all three passes." Same optional pointer for `dh-code-ruler` (names "selected architecture agent" without the protocol path).

##### P2-2 — "Record the row" in `dh-final-review` can invalidate a fast mirror

- **Location:** `skills/dh-final-review/SKILL.md:22` (with `plan_fast.md:6` and `src/tools/plan-fast-template.ts:49-54`)
- **Why it matters:** The rule says that when `## Agent Selection` is absent, run the protocol and "record the row" in `plan.md`. In fast mode, `plan_fast.md` hashes the `plan.md` body with only status lines removed; adding a section changes the hash, so the mirror becomes stale and the next `dh_plan_fast_read` / plan-end sync is a stop-and-ask. This plan is exactly that case (no section, hash currently valid), so following the rule literally at close would break the mirror.
- **Evidence:** Recomputed hash matches `776482f2…` today; adding any body section changes it (`computeSourceSha256` filters only `- **Status:**` lines). `dh-execute-plan-fast:44` already says the mirror intentionally omits the section and only resolves roles from `plan.md`.
- **Fix:** Add a fast-mode clause: "When a `plan_fast.md` mirror exists, record the selection in `tasks/review.md` (runtime selection record) or the ledger; never edit `plan.md` content, which would change `source_sha256`." This review follows that rule (see Runtime agent-selection record).

##### P2-3 — Demo docs/config examples update counts but do not describe the new model

- **Location:** `demo-project/docs/index.md:14-16,58-67`; `demo-project/opencode.jsonc:33-63`; `opencode.example.jsonc:36-40`
- **Why it matters:** R8 names "the demo docs, and config examples" and Sub-Task 4.3 explicitly says "document selection" for those files. They now show 5 agents / 24 skills and list the five agents, but never mention the capability-based selection protocol or `dh-execute-cli` / `dh-explore`. A reader of the demo sees only the old "ask dh-software-architect" hint.
- **Evidence:** `rg 'agent-selection|dh-execute-cli|dh-explore' demo-project/docs/index.md demo-project/opencode.jsonc opencode.example.jsonc` → no matches; only counts/agent names changed.
- **Fix:** Add a short "Agent selection" paragraph (or link to `skills/dh-planning/references/agent-selection.md`) and one line naming the two utility skills to the demo index and the example config comments.

##### P2-4 — Fast close-out artifacts are not complete

- **Location:** `docs/plans/agent-selection-utility-skills/plan_fast_skip_checks.md:116`; `skills/dh-execute-plan-fast/SKILL.md:42,133-134,146-148`; `skills/dh-execute-plan-fast/references/plan-fast-skip-checks.md:88-100`
- **Why it matters:** Step 6 requires (a) `tasks/review-fast-final.md` from `dh-review` Plan Alignment Mode and (b) check-level `End gates` outcome rows for every deferred/conditional check before close. Neither exists yet: the ledger ends with Sub-Task 5.2's six per-task rows and contains zero `End gates` rows. Closing the plan without them leaves unresolved ledger rows, which the skill says blocks the close.
- **Evidence:** `rg -o '\| (Plan|Sub-Task [0-9.]+|End gates) \|' plan_fast_skip_checks.md` → only `Plan` (6) and `Sub-Task` (96); before this report, `tasks/` held only `review-fast.md` (no `review-fast-final.md`).
- **Fix:** Run `dh_plan_fast_sync` (`phase: plan-end`) and `dh-review` Plan Alignment Mode → `tasks/review-fast-final.md`; append end rows for `dh-simplify`, `dh-code-review`, `dh-domain-check` (conditional), `dh-preflight`, `dh-artifact-check`, and `dh-final-review` with `run: PASS`/`not applicable` and the report path; then Step 7 docs/index/status.

#### [P3] Low

##### P3-1 — `dh-setup` is 251 lines (limit 250)

- **Location:** `skills/dh-setup/SKILL.md` (audit `reports/audit.md:31`; base 248 → now 251 by split count)
- **Why it matters:** The plan's constraints say "Skill files stay ≤250 lines" (`plan.md:48`); the audit reports it as a warn-only size deviation. One line over, introduced by this change (3 added lines crossed the threshold).
- **Fix:** Trim one line (e.g., shorten the Step 4 bullet at `:242` or the doc-search footer), or explicitly accept the one-line overage.

##### P3-2 — Scaffold defaults to a placeholder table, not `None — no specialized agent required`

- **Location:** `src/tools/plan-template.ts:99-105` vs fixture `src/__tests__/fixtures/plans/phased-plan.md:51-53`
- **Why it matters:** Sub-Task 1.2 instruction says "default to `None — no specialized agent required` in the scaffold/fixture". The fixture does; the scaffold emits `| [role] | [agent or None] | ...`. The placeholder is consistent with other template fields, but it is a deviation from the instruction and could ship a placeholder table into generated plans.
- **Fix:** Either emit the `None` line in the scaffold when no roles are supplied, or document that the scaffold's placeholder table is the intended default and the planner replaces it.

##### P3-3 — Demo config still calls the bundled engineer "single task executor of the harness"

- **Location:** `demo-project/opencode.jsonc:41`
- **Why it matters:** Under the new model the **plan's selected** implementation agent is the single executor; the bundled engineer is a capability fallback. The description is stale.
- **Fix:** "bundled implementation capability (fallback); plan-selected agent executes tasks."

##### P3-4 — `review-fast.md` historical counts are now stale

- **Location:** `docs/plans/agent-selection-utility-skills/tasks/review-fast.md:104-105,223-226`
- **Why it matters:** It says the omission list has "eight `FAST_OMITTED_SECTIONS`" and records `plan_version fast-2`; the mirror is now `fast-3` with nine sections (`src/tools/plan-fast-template.ts:15-25`). It is a pre-execution snapshot, so this is historical, not current, but a reader may mistake it for the current state.
- **Fix:** Add a one-line "superseded by fast-3 / nine omitted sections" note when producing `review-fast-final.md`.

### Integration assessment

- **Cross-sub-task integration:** coherent. The protocol (1.1) feeds planning (1.3), the template/scaffold/fixture (1.2), execution/task/fast skills (3.1), review/final-review, docs/setup (3.2), agents/docs (3.3), inventory/tests/docs (4.1–4.3), and gates (5.1). All four fast omitted lists and the renderer constant agree. The demo config's removed `{file:../agents/dh-executor.md}` / `dh-explorer.md` entries would otherwise have failed at load; both are gone, and `demo.sh`'s `AGENTS` array is 5.
- **Regressions:** none found. The only src logic changes are count constants, one MCP tool description string, the plan-template section, and the fast omitted list; no parser/status-model/tool-name/MCP behavior change. `scripts/lib/shared.mjs` was reduced (317 → 311 lines); no new over-300 code file was introduced.
- **Test coverage:** 46 files / 721 tests pass, including the new 135-line contract test that covers the removed files, both new skills, the protocol sections, template/scaffold/fixture, fast omission lists, and 5/24/29. The contract test scans `skills/` + `agents/` only (not docs/config) — acceptable for AC1/AC8, but a stale `@dh-*` in docs would be caught only by the manual `rg` gate; noted as an observation, not a finding.
- **Scope compliance:** no `package.json` / `pnpm-lock.yaml` / dependency change; no MCP tool/server/CLI/package/env rename; no plan status-model change; no historical `docs/plans/**` rewrite (only this plan + its untracked mirror/ledger/tasks and the `docs/plans/index.md` row); no aliases for the removed agents.

### Release readiness

| Gate | Result | Evidence |
|---|---|---|
| `dh-artifact-check` (build/artifacts/deploy scripts) | **PASS** | `pnpm build` → `copy-assets` 5 agents / 24 skills, `dist/assets` complete; `smoke-load`, `smoke-mcp`, `smoke-install`, `smoke-pack` all pass (pack with the real Node path); `bash -n scripts/docker-test.sh`, `bash -n demo-project/demo.sh`, and `node --check` on changed `.mjs` files pass |
| `dh-preflight` (tests/lint/static analysis) | **PASS** | `pnpm test` 46/721; `pnpm typecheck`; Biome exit 0 (5 warnings/11 infos, pre-existing); Knip clean; jscpd 0 clones; dependency-cruiser 0 violations; link check 122 refs; `pnpm run audit` PASS (0 FAIL) |
| Docker scans | Not re-run | `scan:deps` remains the documented, accepted pre-existing exception; no dependency changes exist. Semgrep was not re-run because the diff contains no executable logic changes beyond count constants, a description string, and template text; the implementation's recorded Semgrep result is consistent. |
| Recommended version bump (`dh-semver`) | **Minor** | Finalize `0.5.0` from the existing `0.5.0-rc.1` (latest tag `v0.4.0`); if `0.5.0-rc.1` is already published, bump to `0.6.0`. The hard-cut removal of two agents is a breaking change for 0.x; record it as BREAKING in the changelog. Not re-run/tagged per fast-mode instructions. |
| Changelog generated | No | Deferred to the Step 7 `dh-semver` run; no tag created (verified: latest tag remains `v0.4.0`, branch at `739938b`). |

### Safety and rollback

- **Secrets:** none. High-signature scans of all changed/untracked files found no tokens, keys, or private keys; the audit reports 0 high-signature hits. No secrets were captured in this review.
- **Rollback:** the change is markdown/config/source with no data migration or persisted schema. `git revert` of the sign-off commit restores the 7-agent surface; installed users re-run `dev-harness install --force` (or uninstall), which re-verifies the asset counts and fails loudly on mismatch. The fast mirror/ledger are per-plan artifacts and can be regenerated with `dh_plan_fast_create` if needed.
- **Recovery:** `plan_fast_skip_checks.md` is append-only, so a bad row is corrected with a new row; no destructive migration exists.

### Suggested next steps

- [ ] P2-4 before close: produce `tasks/review-fast-final.md` and append the six `End gates` ledger outcome rows; then Step 7 docs/evolution/index/status.
- [ ] P2-1/P2-2/P2-3: apply the one-line selection note in `dh-simplify`, the fast-mode recording clause in `dh-final-review`, and the demo/example selection note (all non-blocking; can be a follow-up commit).
- [ ] P3-1: trim `dh-setup` to ≤250 lines (or record the accepted overage).
- [ ] P3-2/P3-3/P3-4: optional polish (scaffold default, demo config wording, historical review note).
- [ ] Commit the untracked artifacts (`plan_fast.md`, `plan_fast_skip_checks.md`, `tasks/review.md`, `tasks/review-fast.md`, `skills/dh-execute-cli/`, `skills/dh-explore/`, `skills/dh-planning/references/agent-selection.md`, `src/__tests__/agent-selection.test.ts`) in the sign-off commit, then merge `--no-ff` into `develop`.

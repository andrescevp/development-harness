---
title: "Final Plan Review — Web Research Agent and Skill"
slug: dh-research-agent-skill-final-review
description: "Binding plan sign-off for dh-research-agent-skill (R1–R9, AC1–AC8) against the full 422ab45..HEAD diff plus uncommitted remediation."
tags: [review, final-review, plan]
project: dev-harness-skills
stack: "Markdown harness assets + TypeScript tooling/tests"
created: 2026-11-16
updated: 2026-11-16
status: active
---

# Final Plan Review: Web Research Agent and Skill (dh-researcher + dh-research)

**Plan slug:** `dh-research-agent-skill`
**Review against:** `sdd.md` — R1–R9 and AC1–AC8
**Mode:** `dh-final-review`, fast (T2 verification; T3 record finalization follows sign-off)
**Branch / range:** `feature/dh-research-agent-skill` — `422ab45..HEAD` (`63be510`) plus the uncommitted remediation working tree
**Plan mirror:** `plan_fast.md` (`source_sha256` current, `stale: false`, `plan_version: fast-2`)
**Overall risk:** Medium
**Verdict:** **Approve with comments**

All 3 phases and 11 sub-tasks are `Completed`; every delegation value is valid;
no P0/P1 finding remains. Seven P2/P3 observations are recorded as comments —
none blocks sign-off, and all are close-out/documentation/test hardening items.

## Plan Completion Status

| Phase | Sub-task | Delegated agent | Status | Notes |
|---|---|---|---|---|
| 1 — Research assets and contract | 1.1 Create the dh-researcher agent asset | dh-software-engineer | Completed | `agents/dh-researcher.md` (104 lines): folded description, `mode: subagent`, no `tools`/`permission`, one-question/citation/confidence/boundaries rules |
| 1 | 1.2 Create the dh-research skill asset | dh-software-engineer | Completed | `skills/dh-research/SKILL.md` (192 lines): `allowed-tools: read, webfetch, websearch`; workflow, note/index templates, ownership handoff; `workspace-docs.md` rows added |
| 1 | 1.3 Add the optional Research plan section | dh-software-engineer | Completed | Template, scaffold, canonical fixture, `FAST_OMITTED_SECTIONS`, fast skill/reference, `dh-review` all updated in order Visual Context → Research → Agent Selection → Phases |
| 1 | 1.4 Establish the docs/research registry contract | dh-documentor | Completed | `docs/research/index.md`: frontmatter, purpose, `| Date | Topic | … |` header, empty registry, no plan-local folder |
| 2 — Runtime integration and inventory | 2.1 Add the optional research unblock step | dh-software-engineer | Completed | Exactly one `**Optional external-fact unblock**` line in each execution task skill; halt sentences intact |
| 2 | 2.2 Integrate research in planning/SDD/contingency | dh-software-engineer | Completed | `dh-planning` step 5 + bullet, `dh-grill-sdd` external-fact rule, `dh-contingency` method step + Safety line, agent-selection Research row |
| 2 | 2.3 Update inventory, tests, audit, CLI, smokes | dh-software-engineer | Completed | 6/27/33 across assets/frontmatter/registration/agent-selection tests, `EXPECTED_*`, `LOOP`, install harness, `pack-install`, `smoke-pack`, `install-smoke-checks`, TUI fixture |
| 2 | 2.4 Update project docs, metadata, changelog | dh-documentor | Completed | AGENTS, README, skills index, LOADING counts, `opencode.example.jsonc`, demo docs, CHANGELOG Unreleased; see P2-1 for the LOADING capability sentence |
| 3 — Verification and close-out | 3.1 Consolidate cross-cutting contract tests | dh-software-engineer | Completed | `src/__tests__/research-contract.test.ts` (25 tests) covers assets, registry, plan section, fast omission, execution unblock, planning integration |
| 3 | 3.2 Run the full verification gate + audit artifacts | dh-software-engineer | Completed | `preflight.md`, `artifact-check.md`, `reports/audit.*` regenerated; all commands exit 0 |
| 3 | 3.3 Write evolution and observation notes | dh-documentor | Completed | Both notes exist with frontmatter; both rows prepended to `docs/evolution/index.md`; links resolve |

**Per-phase completion:** Phase 1 — Completed (4/4 sub-tasks); Phase 2 —
Completed (4/4); Phase 3 — Completed (3/3). No phase was closed with open
sub-tasks; every status is `Completed` in both `plan.md` and `plan_fast.md`
(`dh_plan_fast_sync` aligned, no differences).

**Delegation contract:** every sub-task carries a non-empty
`Delegated to agent` value (`dh-software-engineer` for implementation/test
work, `dh-documentor` for registry/docs/close-out), all present in the plan’s
`## Agent Selection` table with a documented generic fallback.

## Execution Record (T2)

`## Execution Record` is present at `plan.md:487-513`, after
`## Final Integration & Verification` and outside `## Phases`. All contract
fields are present and consistent with the diff: standalone root
(`/home/andres/workspace/dev-harness-skills`), repository path `.`, branch
`feature/dh-research-agent-skill`, range `89f28b9..HEAD` (= `63be510`, the
implementation commit, plus the documented uncommitted remediation), summary,
architectural changes, and references that resolve. `Execution status` is
`In progress`, which is the expected T1 state; T3 finalization (status, final
commit range, index row) follows this sign-off. Two format deviations are
recorded as P2-2 for that T3 pass; they do not make the record stale or
inconsistent with the delivered diff.

## Requirements Verification

| Requirement | Status | Evidence |
|---|---|---|
| **R1** — sixth agent with source-cited research rules | PASS | `agents/dh-researcher.md`: `mode: subagent`, no `tools`/`permission`; Operating Rules 1–6 (one question, primary sources + URL/retrieval date, confidence labels, honest tooling, bounded pass, clean queries); Boundaries (no writes/code/commands); Safety (no invented URLs, untrusted pages) |
| **R2** — twenty-seventh skill with bounded workflow, template, report-back | PASS | `skills/dh-research/SKILL.md`: Core Rules, 7-step workflow (frame → queries → fetch → verify → compose → hand off → report), Note Template, Registry rules, Final Check; `src/__tests__/research-contract.test.ts` 25/25 |
| **R3** — single `docs/research/<topic>.md` registry + index; plan-local rejected | PASS | `docs/research/index.md` (only research index; `find docs -path '*research*'` shows no plan-local folder); skill “Where Notes Live”, agent Workspace First, `workspace-docs.md` rows; test rejects `docs/plans/<slug>/research/` |
| **R4** — optional `## Research` section; fast mirror omits it | PASS | `skills/dh-planning/references/phased-plan-template.md:100`, `src/tools/plan-template.ts:110-116`, fixture `phased-plan.md:51`; `FAST_OMITTED_SECTIONS` (`plan-fast-template.ts:24`); fast skill/reference and `dh-review` list it; rendered-mirror test asserts `` `## Research` `` |
| **R5** — documentation agent owns research writes; researcher composes | PASS | Skill step 6 and agent “Output and Handoff” hand the payload to `dh-documentor`/`dh-create-documentation`; caller fallback documented; `AGENTS.md:111-112`; execution skills say “the documentation owner registers the note”; `dh-research` grants no `write` (exact tool-set test) |
| **R6** — one optional bounded unblock in both execution task skills; halt kept | PASS | `skills/dh-execute-plan-task/SKILL.md:84` and `skills/dh-execute-plan-task-fast/SKILL.md:131`: browsing-gated, ONE cited pass, inconclusive → stop; hard-blocker sentences unchanged; exactly one `dh-research` occurrence per file |
| **R7** — planning/SDD/contingency delegate and cite; contingency safety | PASS | `dh-planning` workflow step 5 + research-links bullet; `dh-grill-sdd` external-fact rule; `dh-contingency` method step 3 + Safety “rated only on verified facts”; Research role added to `agent-selection.md` |
| **R8** — corpus/metadata/tests/audit/CLI/package smokes at 6/27/33 | PASS | `assets.test.ts`, `frontmatter.test.ts`, `registration.test.ts`, `agent-selection.test.ts` assert 6/27/33; `plugin-artifact.ts` 6/27; install harness 6/27; `shared.mjs` LOOP 27+6 (sorted); `pack-install`/`smoke-pack`/`install-smoke-checks` 6/27; audit report 33, loop membership 27/27 + 6/6 |
| **R9** — existing behavior preserved; no deps/registrations; QA green | PASS | `package.json`/`pnpm-lock.yaml` unchanged; plugin still registers agents/skills only (registration test tool touches 0); no `docs/evolve` change; reused gate results all pass (below) |
| **AC1** — assets parse/register; plugin reports 6 + 27 | PASS | `pnpm build`: `agents 6 | skills 27 SKILL.md + index.md`; registration test asserts both names; 33 uniqueness |
| **AC2** — registry exists; assets reject plan-local paths; no recollection-as-research | PASS | `docs/research/index.md` frontmatter + canonical header + “No notes registered yet”; “no source → `model knowledge` or drop”; test forbids the plan-local path |
| **AC3** — template/scaffold/fixture expose `## Research`; fast renderer allows omission | PASS | Order and “outside phases” asserted for template, rendered scaffold, and canonical fixture; `renderFastPlan` output contains the omission; three prose surfaces list it once |
| **AC4** — exactly one optional line per execution skill; no 2.4 framing | PASS | One line each (verified); agent/skill contain no `step 2.4` (tested); the remaining `2.4` strings are the pre-existing hard-blocker loop step in AGENTS/skills index/README |
| **AC5** — planning/SDD/contingency reference delegation/citation; safety rule | PASS | Three skills reference `dh-research`; `dh-contingency` contains “rated only on verified facts; missing evidence is labelled as an assumption…” |
| **AC6** — inventory 6/27/33 everywhere | PASS | Tests, CLI constants, install/pack smokes, audit lists, README/AGENTS/skills index/LOADING/demo/opencode.example; `rg` sweep finds no active `5 agents`/`26 skills`/`31` (historical notes and old changelog entries only) |
| **AC7** — full local gate passes | PASS | Reused: `pnpm test` 66 files/1116 tests; typecheck clean; build 6/27; `pnpm run audit` PASS (33, 27/27, 6/6, 0 FAIL); `lint:links` 404 refs, no dead links; `smoke-load`, `smoke-mcp` (12 tools), `smoke-install`, `smoke-pack` (392 files) pass; Docker `scan:deps` 0 / `scan:code` 0 |
| **AC8** — docs and close-out notes describe capability + ownership | PASS (comment) | README (features, agent/skill tables), AGENTS.md (role summary, research capability paragraph, docs contract), `skills/index.md`, CHANGELOG Unreleased, evolution + observation notes and index rows; `docs/LOADING.md` carries the 6/27 counts but no capability sentence — P2-1 |

No requirement is marked FAIL.

## Findings

### [P0] Blocking

_None._

### [P1] High

_None._

### [P2] Medium

- **`docs/LOADING.md` carries no research-capability sentence (AC8 enumeration)**
  - **Package:** `[workspace]`
  - **Location:** `docs/LOADING.md:35-38, 247-256, 373-375` (count updates only);
    `rg -i research docs/LOADING.md` → 0 hits.
  - **Why it matters:** AC8 names `docs/LOADING.md` among the docs that
    “describe the capability and ownership boundary.” Today LOADING only reports
    “6 agents / 27 skills”; a reader of the loading/troubleshooting guide cannot
    learn that `dh-research` exists, that notes live under `docs/research/`, or
    that `dh-documentor` owns persistence. The capability itself is documented
    in README/AGENTS/skills index/CHANGELOG/notes, so the intent of AC8 is met;
    this is the one enumerated surface that does not carry it.
  - **Evidence:** `docs/LOADING.md:252` “The plugin also registers 27 skills” with
    no mention of `dh-research`; `README.md:10,299,308`, `AGENTS.md:12-15,169-173`,
    and `skills/index.md:127,160` all describe it.
  - **Fix:** Add one sentence in the registration section, e.g. “27 skills,
    including `dh-research` (one bounded, cited research pass; notes at
    `docs/research/<topic>.md`, registry `docs/research/index.md`, persisted by
    the documentation owner).”

- **Execution Record is complete but uses a non-enumerated `Repository kind` and a one-bullet summary**
  - **Package:** `[workspace]`
  - **Location:** `docs/plans/dh-research-agent-skill/plan.md:492, 498-502`
  - **Why it matters:** `skills/dh-planning/references/execution-record.md:26`
    enumerates `workspace | nested project | submodule | worktree`; the record
    says `standalone` (the vocabulary of `## Workspace Impact`, not of the
    record contract — prior records use `workspace`). The same contract asks for
    a 2–5 bullet `Summary`; the record has one bullet. The record is otherwise
    complete, agrees with the diff, and is correctly `In progress` at T1, so this
    is a format/vocabulary deviation to fix in the T3 finalization, not a stale
    or inconsistent record.
  - **Evidence:** `plan.md:492` `- **Repository kind:** standalone`; `:498-502`
    single Summary bullet; `docs/plans/index.md` record table still has no row
    for this slug (also T3).
  - **Fix:** At T3 set `Repository kind: workspace`, expand `Summary` to 2–5
    bullets (assets, registry/format, execution integration, inventory/docs),
    finalize `Commit range`, add the `## Execution Records` row, and bump
    `plan_version`/`source_sha256` per the fast-mode record rule.

### [P3] Low

- **Evolution note retains stale figures after the remediation**
  - **Location:** `docs/evolution/2026-11-16-dh-research-agent-skill.md:45,47,53`
  - **Why it matters:** The note says the agent is “141 lines” with “ten
    operating rules” and the skill “191 lines.” After the remediation dedupe the
    agent is 104 lines / 6 rules and the skill is 192 lines, so the close-out
    note no longer matches the shipped assets. Line 51 also reads “the agent has
    no write boundary,” which should be “a no-write boundary” (the adjacent
    paragraph already correctly says the skill declares no write tool and the
    boundary is instructional for the agent).
  - **Fix:** Update the three figures/wording during T4 documentation close-out.

- **The contract suite no longer asserts “exactly one” research line per execution skill**
  - **Location:** `src/__tests__/research-contract.test.ts:184-190`
  - **Why it matters:** The remediation replaced `count(text, 'dh-research') === 1`
    with line-shape regexes. Both files do contain exactly one occurrence today
    (and AC4 is met), but a duplicated unblock block added later would still pass
    the suite. The prior assertion directly protected AC4’s “exactly one”.
  - **Fix:** Restore `expect(count(text, 'dh-research')).toBe(1)` (or assert the
    unblock-line count is 1) alongside the new shape assertions.

- **The scaffold placeholder is not regression-tested**
  - **Location:** `src/__tests__/research-contract.test.ts:137-159`;
    `src/tools/plan-template.ts:110-116`
  - **Why it matters:** The code-review P2 fixed the scaffold’s fabricated
    `node-eol` “verified” citation, but the suite only asserts that the section
    exists/orders correctly. Reintroducing the fabricated link would not fail a
    test (the template’s concrete example is inside a fenced block, so link
    checks do not catch it).
  - **Fix:** Add `expect(SCAFFOLD_TEXT).not.toContain('node-eol')` and
    `expect(SCAFFOLD_TEXT).toContain('None — no research consulted')`.

- **Residual wording in the research skill’s Core Rules vs the fixed Final Check**
  - **Location:** `skills/dh-research/SKILL.md:45-48` vs `:180-182`
  - **Why it matters:** The Final Check now correctly distinguishes researched
    findings (URL required) from labelled `model knowledge` (no invented URL),
    but the Core Rule still opens with “Every finding carries four things: the
    claim, the source URL, …” before the no-source fallback. A `model knowledge`
    row allowed by the same bullet and the template’s Confidence column still
    reads as non-conforming. Low risk, but it is the same pressure the P2 fix
    addressed.
  - **Fix:** Align the Core Rule with the Final Check: “Every finding carries a
    confidence label; every `verified`/`partially verified` finding has a source
    URL + retrieval date; `model knowledge` claims are labelled and carry no
    invented source.”

- **`skills/index.md` delegation roles omit research**
  - **Location:** `skills/index.md:163-166`
  - **Why it matters:** The index lists the resolvable roles as architecture,
    implementation, testing/QA, review, final-review, and documentation;
    `AGENTS.md:135-138` and `agent-selection.md` now include research. Minor
    consistency drift in the capability routing docs.
  - **Fix:** Add “research” to that sentence when the index is next edited.

## Package Coverage (workspace only)

- **Workspace root:** none — standalone repository (no `WORKSPACE.md` at the root
  or `docs/WORKSPACE.md`; the repository is workspace, package, plan and vault
  root).
- **Affected packages:** none (`## Workspace Impact` declares “None — standalone”).
- **Shared paths reviewed:** `agents/`, `skills/`, `src/`, `scripts/`, `docs/`,
  `AGENTS.md`, `README.md`, `CHANGELOG.md`, `reports/`, plus `opencode.example.jsonc`
  and `demo-project/` (both declared in Sub-Task 2.4).
- **Diff basis:** `git diff 422ab45..HEAD` (`63be510`) plus
  `git status --porcelain` working-tree changes (remediation) and the untracked
  `docs/plans/dh-research-agent-skill/tasks/*` evidence.
- **Unaffected packages:** none (single-root repository); no package was left
  unvalidated.

## Release Readiness (reused, not re-run)

| Gate | Result | Source |
|---|---|---|
| `pnpm test` | PASS — 66 files / 1116 tests | `tasks/preflight.md`, supplied run |
| `pnpm typecheck` | PASS — clean | `tasks/preflight.md` |
| `pnpm build` | PASS — agents 6 / skills 27 | `tasks/artifact-check.md` |
| `pnpm run audit` | PASS — 33 items, 27/27 skills, 6/6 agents, 0 FAIL | `reports/audit.md` |
| `pnpm lint:links` | PASS — 404 refs, no dead links | `tasks/preflight.md` |
| `smoke-load` / `smoke-mcp` / `smoke-install` / `smoke-pack` | PASS — 12 tools; 392 files, 6/27 | `tasks/artifact-check.md` |
| Docker `scan:deps` / `scan:code` | PASS — 0 issues / 0 findings | `tasks/preflight.md` |
| Fast alignment | PASS — `aligned: true`, no differences | plan-end `dh_plan_fast_sync` |

**Recommended version bump (reused, informational):** **minor → `v0.9.0`** —
additive capability (one agent, one skill, one registry contract, one optional
plan section, one optional execution step) with no breaking change; release
tagging remains out of scope per the plan.

## Security, Rollback, and Coverage

- **Secrets/privacy:** the diff adds no credentials, tokens, or personal data;
  the only absolute path is the required Execution Record `Workspace root` (and
  the pre-existing audit report `repo` field). The assets add explicit query
  privacy rules (no secrets/personal/internal identifiers) and treat fetched
  pages as untrusted data.
- **Rollback/recovery:** the change is additive and data-free — reverting
  `63be510` and the working-tree remediation restores 5/26; `docs/research/`
  can ship empty; no migrations or external state. Fast-mode rollback keeps the
  mirror/task artifacts for audit.
- **Test coverage:** happy paths and edge cases are covered by the 25-test
  contract suite plus updated inventory suites: asset shape/tool list, registry
  header, plan-section order/placement, fast-mirror omission (rendered), one
  research line + preserved halt, planning/contingency integration, registry
  docs rows. Regressions covered: legacy plans parse, registration hard cut,
  loop membership, CLI/package counts, links.

## Sign-off

**Verdict: Approve with comments.**

The plan fulfils R1–R9 and AC1–AC8 on the reviewed diff; the PR #4 review
comments are resolved as designed (single `docs/research/` registry + index,
plans link through optional `## Research`, one optional browsing-gated unblock
line in both execution task skills, no research “loop step 2.4” framing), and
ownership stays with the documentation agent while `dh-research` composes only
(no write tool). The P2 items are documentation/record finalization tasks for
T3/T4, not requirement failures; the P3 items are low-risk hardening of the
close-out notes and contract test.

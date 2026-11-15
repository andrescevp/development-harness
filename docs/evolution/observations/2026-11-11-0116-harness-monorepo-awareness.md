---
title: "Harness Monorepo Awareness — session learnings"
slug: harness-monorepo-awareness-session-learnings
description: "What worked and what did not while implementing and closing out the workspace-awareness plan: contract-first design, phase reviews, TDD fixtures, pause/resume, stale bundles, cgr assumptions, handoff limits and residual single-root guidance."
kind: observation
id: obs-20261111-0116-harness-monorepo-awareness
date: 2026-11-11
agent: "dh-documentor"
project: "dev-harness-skills"
stack: "Markdown skills + TypeScript inventory/test tooling"
plan: "harness-monorepo-awareness"
tags: [observation, topic/harness, topic/workspace, topic/monorepo, topic/skills]
feature: "Harness Monorepo Awareness"
epic: "Workspace awareness"
created: 2026-11-11
updated: 2026-11-11
confidence: 0.75
status: active
---

# Observation: Harness Monorepo Awareness — session learnings

## Overview

Standard-mode execution of `harness-monorepo-awareness` (4 phases / 16
sub-tasks) on `feature/harness-monorepo-awareness`, with per-phase reviews and a
final review. The plan was paused once after Phase 2 (8/16) and resumed later
from `handoff.md`; the final review returned **Approve with comments** with
no P0/P1 findings. These learnings cover the contract-first approach, the phase
reviews that caught real defects, the pause/resume handoff, the documentation
close-out, and the friction that remains in the harness itself.

## What Worked

- **A normative contract before implementation.** Writing
  [`workspace-contract.md`](../../plans/harness-monorepo-awareness/workspace-contract.md)
  first — four roots, A1–A9, a ten-row decision table, error templates and the
  standalone fallback — gave every later sub-task a single citation. Phase
  reviews could verify R1/R9 against exact sections instead of re-deriving
  intent, and the contract's §11 consumption map made the sixteen sub-tasks
  traceable.
- **TDD-shaped structural tests over the real corpus.** The workspace suites
  read the actual skills, agents, templates and fixtures rather than snapshots:
  `workspace-anchor.test.ts` (40 tests, decision rows and a temp-dir split
  fixture), `workspace-plan-contract.test.ts` (legacy/new parser equality and
  the index append regression), `workspace-gates-scope-rules.test.ts`,
  `workspace-docs-graph-version-worktree.test.ts`,
  `workspace-monorepo-fixtures.test.ts` (seven layouts) and
  `workspace-agents.test.ts`. The T2 run measured 53 files / 937 tests.
- **Phase reviews caught defects that tests alone missed.** Phase 2a returned
  **Request changes** for a real P1: the new `## Execution Records` table was
  placed after `## Plans`, so `dh_plan_create`'s `O_APPEND` wrote plan rows into
  the wrong table. The fix moved records before plans and added a regression
  test that seeds the real two-table index. Phase 2b found missing
  `shared_paths` and uncommitted-diff coverage; Phase 3 found the interactive
  `cgr --workspace` assumption and the missing `## Package Scope` in the handoff
  template; Phase 4a found the machine-path guard blind spot and the
  keyword-only R1–R9 coverage map. All fixes stayed small and were re-reviewed.
- **Pause/resume did its job.** The handoff at 8/16 recorded the phase/sub-task,
  149 content lines (within the ≤150 target), branch, dirty-path fingerprint,
  `next_action` and validation state. Resume stamped `status: resumed`, kept the
  pause snapshot for audit and continued at Phase 3 without re-planning or
  losing the working tree. No status was changed by the pause itself.
- **The contract's T1/T2/T3 provenance split worked.** T1 wrote the execution
  record with a deliberately provisional commit range; T2 verified every field
  against the diff and flagged only the provisional range; T3 finalized
  `Completed`, the real `7e2eb14..425cc77` range and the index row. This kept
  the sign-off honest: the final review did not have to accept an
  already-finalized record it had not seen.
- **Documentation-first close-out reduced drift.** Updating `AGENTS.md`,
  `README.md`, `docs/LOADING.md`, `skills/index.md` and `CHANGELOG.md` in 4.3,
  then running the final review, meant the T4 notes could cite an already
  consistent user-facing surface rather than rewrite it.
- **Explicit environment evidence.** The final review recorded the
  `smoke-pack` PATH caveat (real `node` before the `~/.local/bin/node` shim)
  and the Docker-scan reuse from 4.2 instead of claiming a fresh full-gate run.
  The note set can therefore distinguish observed checks from reused evidence.

## What Didn't

- **The built-bundle test can pass against a stale `dist`.** `registration.test.ts`
  imports `dist/plugin.js` and only asserts that the file exists before
  registering agents/skills (`src/__tests__/registration.test.ts:8-9,67-74`).
  Ad-hoc `pnpm test` without a preceding `pnpm build` can therefore validate an
  older bundle. `pnpm qa:check:full` orders `build` before the smokes/tests, but
  targeted phase runs and quick local test loops do not. This is a test-signal
  gap, not a product defect: the final build/assets check was green.
- **The `cgr` workspace assumption was wrong.** Phase 3 documented
  `cgr start --workspace <name> --update-graph` as a batch sync. Upstream
  behavior is to sync each repository and then open the interactive assistant,
  which can block a non-interactive setup or leave an assistant session open.
  The reference now separates the interactive named-workspace form from the
  batch per-repo `cgr start --repo-path <repo> --update-graph` path
  ([`review-phase3.md`](../../plans/harness-monorepo-awareness/tasks/review-phase3.md)).
- **The 250-line skill cap and the 150-line handoff target create compression
  pressure.** `dh-pause-plan/SKILL.md` ended at 248/250 lines, and the fix for
  `## Package Scope` reflowed two prose blocks into long single lines — a P3
  readability regression. `handoff-template.md` is 208 lines while the handoff
  content target is ≤150, so package scope had to be summarized. The template
  assertion initially matched the overview bullet rather than the template block,
  which is exactly the kind of "green but absent" failure the cap encourages.
- **Single-root leftovers survived the sweep.** Four skills still carry bare
  `./docs/plans` or root-only `CODE_RULES.md` wording (`dh-contingency`,
  `dh-mermaid`, `dh-execute-plan-task`, `dh-execute-plan-task-fast`), the
  `dh-setup`-generated `## Dev Harness` block omits the anchor, and several
  consumers name only root `WORKSPACE.md` rather than accepting the documented
  `docs/WORKSPACE.md` fallback. The global contract covers these cases in
  principle; the files themselves do not say so (final review P2-2/P2-3,
  P3-1).
- **Plan status bookkeeping lagged the implementation across phases.** Phase
  reviews repeatedly found deliverables already present while statuses were
  still `Pending`/`In Progress` (Phase 3's 3.2–3.5, Phase 4a's 4.1/4.2). The
  loop requires statuses to be updated after review, but the lag made each
  review spend time on bookkeeping and made the phase boundary less crisp.
- **The fast mirror's `source_sha256` needed an explicit T1/T3 refresh rule.**
  Phase 2a found that record edits change the plan body and can leave a fast
  mirror stale; the rule is now documented for T1 and T3. This plan ran in
  standard mode, but the same trap will recur in fast mode.
- **`smoke-pack` is host-sensitive.** With the default PATH, `node` resolves to
  the nvm shim, which fails under the smoke's isolated `HOME`; the packed MCP
  tool-list check fails even though the package is fine. The final review and
  4.2 both needed the real Node `bin` directory first. This is pre-existing and
  outside the plan's code, but it makes "full gate green" environment-dependent.

## Decisions

- **Stop on mismatch; never "repair" a split by creating a plan directory.**
  The contract's §6 templates name both roots and both plan dirs; the only
  recovery is restarting at `W`. A user may authorize read-only inspection
  under mismatch, never a write.
- **Keep `## Plans` last in `docs/plans/index.md`.** The P1 append corruption
  proved that an append-based writer and a human-readable table order are one
  invariant, not a style choice. The regression test seeds the real two-table
  index so a future reorder fails loudly.
- **Additive sections, no schema change.** `## Workspace Impact` and
  `## Execution Record` are optional for legacy plans; `parsePlan` ignores them.
  This preserved the "no legacy plan/parser regression" completion item.
- **Treat `cgr --workspace` as interactive.** Batch indexing uses per-repo
  `--repo-path ... --update-graph`; `--workspace` stays for stats/export/MCP and
  scoped queries, and every answer states the index scope.
- **Defer the residual P2/P3 items with a recorded reason rather than expand
  the plan.** The final review approved with comments; the four single-root
  skills and the setup-generated block are follow-up work, not reasons to
  reopen a completed phase.
- **Do not delete the pre-existing empty `demo-project/docs/plans`.** It is
  untracked, predates the plan and is exactly the "foreign/legacy directory"
  case the contract says to report, not clean up.
- **No tag during close-out.** The recommended `v0.7.0` bump stays local and
  user-confirmed; the close-out only records the recommendation.
- **Restore generated audit reports after gate runs.** `pnpm run audit` rewrites
  `reports/audit.{json,md}`; restoring them keeps the T4 diff limited to the
  notes and the evolution index (the same practice the prior close-out used).

## Follow-ups

- Fix the four single-root skills and add a structural test that every skill
  writing under `docs/plans` cites the workspace anchor; add the anchor block to
  the `dh-setup`-generated `## Dev Harness` section.
- Standardize the map discovery phrase to "`WORKSPACE.md`, else
  `docs/WORKSPACE.md`" across planning, gates, coding, code-ruler and the
  handoff template.
- Strengthen the R7 coverage needles (graph, worktree, pause/resume, domain),
  add per-row decision-table verdict assertions, and add a fixture-driven
  setup→gate→review integration test (or record it as a documented manual
  check).
- Add the independent-policy semver output variant, the package mirror step in
  `obsidian-push.md`, the affected-packages question in `dh-planning`, the
  `Dependencies` source for `dh-domain-check`, and the realpath wording in the
  setup checklist.
- Remove the duplicate T3 step in `dh-execute-plan` and keep one source of
  truth for the record/index finalization.
- Harden `smoke-pack`/`checkMcp` for isolated-HOME nvm-shim hosts (preserve
  `NVM_DIR` and the real Node `bin` path) or make the Docker test image the
  documented gate path.
- Add a guard that `dist` is not older than `agents/`/`skills/` before the
  built-bundle tests run, so a quick `pnpm test` cannot bless a stale bundle.
- Merge per Git Flow, run `dh-semver` (recommended `v0.7.0`), tag locally only
  after explicit confirmation, and add the evolution note link to the execution
  record `References` if the executing skill has not already done so.

## Related

- Plan: [harness-monorepo-awareness](../../plans/harness-monorepo-awareness/plan.md)
- Evolution: [2026-11-11-harness-monorepo-awareness](../2026-11-11-harness-monorepo-awareness.md)
- Final review: [tasks/review.md](../../plans/harness-monorepo-awareness/tasks/review.md)
- Phase 3 review: [tasks/review-phase3.md](../../plans/harness-monorepo-awareness/tasks/review-phase3.md)
- Phase 4a review: [tasks/review-phase4a.md](../../plans/harness-monorepo-awareness/tasks/review-phase4a.md)
- Handoff: [handoff.md](../../plans/harness-monorepo-awareness/handoff.md)
- Contract: [workspace-contract.md](../../plans/harness-monorepo-awareness/workspace-contract.md)

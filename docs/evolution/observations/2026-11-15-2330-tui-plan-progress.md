---
title: "TUI Plan Progress — session learnings"
slug: tui-plan-progress-session-learnings
description: "What worked and what did not while shipping the TUI plan-progress part in fast mode: contract-first design, the host load probe, pure view models, fast-mode gates, the missing TTY pixels, fast-mirror hashing after T1/T3 and the ledger end-gate bookkeeping."
kind: observation
id: obs-20261115-2330-tui-plan-progress
date: 2026-11-15
agent: "dh-documentor"
project: "dev-harness-skills"
stack: "TypeScript + Solid/OpenTUI + OpenCode TUI plugin API"
plan: "tui-plan-progress"
tags: [observation, topic/tui, topic/opencode, topic/plans, topic/fast-mode]
feature: "TUI Plan Progress"
epic: "Plan observability"
created: 2026-11-15
updated: 2026-11-15
confidence: 0.75
status: active
---

# Observation: TUI Plan Progress — session learnings

## Overview

Fast-mode execution of `tui-plan-progress` (4 phases / 14 sub-tasks) on
`feature/tui-plan-progress`, from a verified API note and a normative progress
contract through the data layer, Solid/OpenTUI components, build/installer
wiring and docs, with the six end gates run once at plan end. The environment
had no TTY/interactive OpenCode session, the host was `2.2.7` while the repo
typed against `2.0.20`, and fast mode deferred per-task checks into
`plan_fast_skip_checks.md`. The final review approved with comments (no P0, no
code changes); live pixels remain the one deferred verification.

## What Worked

- **API notes before the contract, contract before code.** Sub-task 1.1 pinned
  the exact slot/panel/command/storage/session APIs and the host-vs-typing
  version skew in [`tui-api-notes.md`](../../plans/tui-plan-progress/tui-api-notes.md);
  1.2 turned that into the 17-section
  [`progress-contract.md`](../../plans/tui-plan-progress/progress-contract.md)
  (module boundary §2, deterministic selection §4.4, refresh budgets §9,
  read-only guarantee §10, states §11, consumption map §15). Every later
  sub-task could cite a section instead of re-deriving intent, and the T2 code
  review found only one contract/code mismatch (P3 → P2) rather than design
  ambiguity.
- **The host load probe answered the expensive question early.** The 1.3 spike
  prepended a deliberate `throw new Error("TUI-SPIKE-PROBE")` to the built
  artifact; the host logged `plugin operation failed … error=TUI-SPIKE-PROBE
  … role=cli`, proving it **evaluates our code** and resolves bare
  `@opencode/plugin/tui` and `@opentui/solid/jsx-runtime` through its
  `opentui:runtime-module:*` rewrite without any `node_modules`. That settled
  peer-vs-bundle before 4.1 (host singletons external, `yaml` bundled) and gave
  the exact import list later asserted by `test/tui-bundle.test.ts`.
- **Pure view models were the only testable UI surface — and they were enough
  to keep the contract honest.** Headless JSX is unavailable
  (`@opentui/core/testing` throws "OpenTUI native FFI is not available for this
  runtime yet"), so the card and panel were split into `sidebar-model` /
  `panel-model` / `panel-sections` plus thin components. 11 test files
  (2,225 lines) and 8 fixtures cover selection, counts, checklists, review and
  ledger derivation, windowing/cursor clamping, debounce/poll and the
  view-model states (S1–S8). The full suite reported 65 files / 1,085 tests.
- **Read-only was enforced structurally, not by discipline.** No `fs` write
  API and no `storage.store` in `src/tui`, a dedicated
  dependency-cruiser `tui-read-only` rule, `resolvePlanPath` rejecting
  `..`/separators, `assertNoSymlinks` + `O_NOFOLLOW`, a symlinked-plan test, and
  an artifact scan for writer symbols (`appendPlanIndexRow`, `writeFileSync`,
  `createFastPlan` = 0 occurrences). Reviews could verify the guarantee with
  grep/depcruise instead of reading every renderer.
- **Fast mode kept 14 sub-tasks moving without losing the gates.** Six checks
  per implemented sub-task were recorded as deferred (13 × 6 = 78 per-task
  rows) and run once at plan end; the code review still found no P0/P1 and the
  alignment review found byte-identical `## Phases` regions after status
  stripping. Deferral did not hide a defect in this plan.
- **Server isolation held.** The fourth single-entry tsdown build plus optional
  peers kept `dist/plugin.js` at 200,961 B (same as before the plan), and
  `smoke-load`/`smoke-mcp` stayed green. The feature is additive enough to roll
  back by reverting `5dd085f`.
- **T2 re-ran every gate instead of trusting T1.** It rebuilt the bundle,
  re-checked the artifact imports/size, re-ran the smokes and the audit, and
  independently recomputed the fast-mirror hash. That is what caught the
  `2.2.7` documentation drift and the stale mirror.
- **Docs landed in 4.3, before the final review.** README, `docs/LOADING.md`,
  `AGENTS.md` and `CHANGELOG.md` were already consistent when the T4 notes
  were written, so the close-out could cite them rather than rewrite them.

## What Didn't

- **No TTY meant the core UI could not be verified.** The sidebar card mounts
  only inside a session, opening a session needs a model turn, and headless
  rendering is impossible in Node. The spike therefore saw no sidebar pixels,
  and AC1–AC3 closed only at "model/bundle level". The plan carries
  `Completed with deferrals` and one unchecked completion item. This is honest,
  but it leaves the release dependent on a manual session check and means the
  width clamp, theme contrast and key bindings are still unobserved.
- **`plan_fast.md` went stale twice while the sync reported alignment.** The T1
  execution-record edit flipped four checkboxes in `plan.md`, changing the body
  hash: the mirror declared `source_sha256: 24ac9a5e…` while recomputation gave
  `2238f16e…`. `dh_plan_fast_sync` still reported `aligned: true,
  differences: []` because structural/status parity was intact — only
  `stale: true` revealed it, and the mirror's copied "unchanged" verification
  block was false. T3 needed `fast-2` → `fast-3`, a recopy of the block and a
  rehash. Structural parity and mirror freshness are different signals.
- **The plan-end ledger outcomes were an afterthought.** The six standard gate
  results were absent until the final review raised P1-2, so the ledger's
  `unresolved` set listed all six checks and this plan's own `/plan-progress`
  panel would have shown six unresolved checks after close. They were then
  appended in a single batch (rows stamped 22:27) while the final review report
  is timestamped 23:25 and the plan closed at 23:27: the ledger records the
  bookkeeping moment, not when the gates actually ran. The plan-end alignment
  review (22:49) also predated the T1 record edit (23:15), so it described a
  `plan.md` that no longer existed until T4 re-checked the sync.
- **Two P2 gaps are "derived for display" dead ends.** `PlanState.warnings`
  (`pin-stale`, `workspace-root-override`, `scan-truncated`,
  `completed-plan-active`, `slug-mismatch`, index warnings),
  `PlanState.errors`, `selection.truncated` and `LedgerState.rowsShown` are all
  computed, and no component reads them in the ready/selector/empty states. The
  practical worst case is the workspace-root override: the card can show a
  different plan tree than the `dh` tools use, silently.
- **The contract and the code disagreed on a MUST NOT.** §2/§10.2 forbid
  `src/tui` importing `plan-io.ts`, but the read path imports its
  `readPlanFile`; the depcruise rule documents the exception while the binding
  document still forbids it. It was P3 in the code review and P2 in the final
  review — exactly the kind of debt a "verified by review" MUST NOT creates.
- **The 300-line rule was breached in a test file.**
  `src/cli/__tests__/plugin-artifact.test.ts` reached 302 lines while every
  production file stayed under the cap. No automated check enforces the limit
  for code files (the existing assertions cover agent and skill files), so only
  review caught it.
- **Docs drifted after the `2.2.7` bump.** `tui-api-notes.md` §16 still records
  the 966 B spike artifact with two imports, no `yaml` and `theme@2.0.20`
  (delivered: 291,965 B, three host imports, bundled `yaml`, `2.2.7`); the
  `AGENTS.md` layout omits `src/tui/`; `docs/LOADING.md` still says
  `v2.0.18` in its verification section while the skew note requires
  `≥ 2.2.7`; the Docker image stays pinned to `2.0.18` and only exercises the
  server part. 4.3 had already been marked `Completed` when T2 found this.
- **`pnpm test` depends on a built `dist/`.** `test/tui-bundle.test.ts` imports
  the bundle and fails on a clean tree; the full gate hides it by building
  first, but a quick `pnpm test` after `pnpm clean` does not.
- **Refresh/render work is duplicated.** `PlanPanel` rebuilds the full body
  four times per update and `SidebarPlan` computes the card twice
  (`createMemo` would fix both), the 2 s poll also runs while `fs.watch` is
  attached, and the sidebar width is read through a plain accessor so a resize
  may not refresh until the next store change.
- **Fast-template/ledger friction is real.** The fast template lists nine
  end-gate items; the mirror merged docs + semver and appended the ledger as
  item 8, forcing the alignment review to classify a semantic deviation as
  cosmetic. Gate outcomes had no natural insertion point until the end.

## Decisions

- **Reconcile the `plan-io` exception in documentation, not by moving code.**
  `readPlanFile` is the single read path used by the tools; a second read-only
  helper would duplicate it. The contract amendment is recorded as P2-3 and is
  a docs task (this close-out does not edit `progress-contract.md`).
- **Ship the documented deferral instead of spending a model turn for
  pixels.** The host probe proved the load path, the artifact contract test
  proves the imports, and the view models prove the rendering inputs; a manual
  session check remains the only honest way to close AC1–AC3.
- **Keep host peers external and bundle only `yaml`.** It preserves the
  host's reactivity/context singleton and keeps server-only installs
  dependency-free; the probe showed the host resolves the bare specifiers.
- **Pin `@opencode/plugin` 2.2.7.** Matching the host typings is worth the
  rebuild and the full smoke gate; leaving `2.0.20` would keep the TUI typed
  against a version the host no longer runs.
- **Run fast mode with end gates only.** Deferring per-task review kept the
  14 sub-tasks flowing; the end-gate reviews caught the real issues (stale
  mirror, ledger, docs drift) without per-task overhead.
- **Enforce read-only with dependency rules and filesystem guards.** A
  convention comment would not survive a future contributor; the depcruise
  rule and symlink rejection do.
- **Restore generated audit reports after gate runs.** `pnpm run audit`
  rewrites `reports/audit.{json,md}`; restoring them keeps the T4 diff limited
  to the notes and the evolution index.
- **Do not tag at close-out.** The semver recommendation (`v0.8.0`, minor) is
  recorded; tagging stays a user-confirmed step.

## Follow-ups

- Render `PlanState.warnings`/`errors` and `selection.truncated` in the
  ready/selector/empty panel and add a sidebar hint when warnings exist; render
  up to 20 ledger rows (`check · scope · disposition`, clipped reason) with a
  truncation marker (P2-1/P2-2).
- Amend `progress-contract.md` §2/§10.2 to record the reviewed
  `readPlanFile`/`plan-io` exception (or extract a read-only reader used by both
  the tools and the TUI) (P2-3).
- Work the P3 batch: trim
  `src/cli/__tests__/plugin-artifact.test.ts` under 300 lines; keep filesystem
  paths out of issue messages; render alignment verdicts even without a ledger;
  parse quoted YAML dates with `parseFrontmatter`; complete refresh telemetry
  (`pending`, manual `mode`, 250 ms warning); restore the `mtimeMs` tie-break
  and drop the duplicate sort/stat; wrap the panel/sidebar models in
  `createMemo`; add one `@opentui/core` override (or record why the duplicate
  is accepted) and document the `glob`/`minimatch` override widening; skip
  `tui-bundle.test.ts` when `dist/tui.js` is absent.
- Refresh `tui-api-notes.md` §16 to the delivered artifact, add `src/tui/` to
  the `AGENTS.md` layout, reconcile the `docs/LOADING.md` `v2.0.18` reference
  with the `≥ 2.2.7` requirement, and decide whether the Docker test image
  moves past `2.0.18` (it currently only covers the server part).
- Run the manual TUI session check at the workspace root (card, panel, refresh,
  empty state, multiple-plan selector, `f`/`r`/`Esc`/`1…9`) and record it before
  claiming a visual pass.
- Add a fast-mode guard that fails on a stale `source_sha256` before the plan
  can close (not only on structural drift), and append each end-gate outcome
  as the gate runs rather than in a batch.
- Link these notes from the plan's `## Execution Record` → `References` at the
  next plan touch (this close-out is read-only on `docs/plans`).
- Merge per Git Flow, run `dh-semver` (recommended `v0.8.0`), rename
  `[Unreleased]` to `[0.8.0]`, and tag locally only after explicit
  confirmation.

## Related

- Plan: [tui-plan-progress](../../plans/tui-plan-progress/plan.md)
- Evolution: [2026-11-15-tui-plan-progress](../2026-11-15-tui-plan-progress.md)
- Contract: [progress-contract.md](../../plans/tui-plan-progress/progress-contract.md)
- API notes: [tui-api-notes.md](../../plans/tui-plan-progress/tui-api-notes.md)
- Final review: [tasks/review.md](../../plans/tui-plan-progress/tasks/review.md)
- Code review: [tasks/review-code.md](../../plans/tui-plan-progress/tasks/review-code.md)
- Alignment review: [tasks/review-fast-final.md](../../plans/tui-plan-progress/tasks/review-fast-final.md)
- Diagram: [architecture.md](../../plans/tui-plan-progress/diagrams/architecture.md)

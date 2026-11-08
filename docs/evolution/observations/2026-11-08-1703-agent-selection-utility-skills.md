---
title: "Agent Selection and Utility Skills — session learnings"
kind: observation
id: obs-20261108-1703-agent-selection-utility-skills
date: 2026-11-08
agent: "dh-documentor"
project: "dev-harness-skills"
stack: "Markdown skills + TypeScript inventory/test tooling"
plan: "agent-selection-utility-skills"
tags: [observation, topic/agents, topic/skills, topic/harness]
feature: "Agent Selection and Utility Skills"
epic: "Capability-based delegation"
created: 2026-11-08
updated: 2026-11-08
confidence: 0.7
---

# Observation: Agent Selection and Utility Skills — session learnings

## Overview

Fast-mode execution of `agent-selection-utility-skills` (5 phases / 14
sub-tasks) on `feature/agent-selection-skills`, with per-task review, simplify,
code review, preflight, and artifact checks deferred to plan end. The change is
mostly skill/documentation surfaces plus inventory constants; the final review
returned Approve with comments (no P0/P1). These learnings cover the selection
contract, the fast mirror/hash behavior, and host-specific smoke behavior;
close-out notes were written after the final review.

## What Worked

- **Protocol-first design.** Writing `agent-selection.md` and the plan
  `## Agent Selection` table before touching delegation prose gave reviewers a
  single contract to test; R1/R2/R9 passed with line-level evidence.
- **Structural contract test over the real corpus.**
  `src/__tests__/agent-selection.test.ts` (135 lines) checked the actual
  `skills/` and `agents/` trees rather than prose snapshots; it covers the
  invariants that matter (no `@dh-`, removed files, parseable skills,
  template/fast-list agreement, 5/24/29).
- **Two review layers.** The pre-run fast alignment caught the
  `source_sha256` mismatch before the loop started; the final review then found
  the P2 gaps (`dh-simplify`, fast-mode recording, demo docs) and P3 polish.
  No P0/P1, and the fixes stayed small.
- **Fast ledger + status parity.** The append-only
  `plan_fast_skip_checks.md` (111 rows at close-out: 102 deferred per-task rows
  plus nine end-gate rows) and byte-identical `## Phases` regions made deferred
  gates auditable.
- **Mechanical count migration.** The 7→5 agents / 22→24 skills change was
  driven by explicit constants (`EXPECTED_AGENT_COUNT`, `EXPECTED_SKILL_COUNT`),
  smoke messages, and grep gates; the audit settled at 29 / 5/24 with 12 tools
  unchanged.
- **Close-out re-validation.** `pnpm test` (46/721), `pnpm build` (5/24
  assets), `audit` (0 FAIL), and `check-links` (no dead references) were re-run
  after the P2/P3 edits.

## What Didn't

- **Hash algorithm drift.** The pre-run mirror recorded `1982e54a…` — the hash
  of the plan body including the delimiter newline and blank line — while the
  runtime `computeSourceSha256` strips one leading newline and computes
  `776482f2…`. `dh_plan_fast_read` would have reported `stale: true` and
  stopped the fast run at Step 3. Fixed by recomputing with the runtime tool and
  bumping `plan_version` to `fast-3`; the prose-vs-implementation drift remains.
- **smoke-pack + isolated HOME + nvm shim.** `checkMcp` builds its child env
  from `getDefaultEnvironment()` plus only `HOME`, dropping `NVM_DIR` and the
  real Node path. On this host `/home/andres/.local/bin/node` is a shim that
  resolves `$HOME/.nvm`; with the temp HOME it exits 127 (`node-shim: no nvm
  install provides 'node' under /tmp/.../home/.nvm/versions/node`). The final
  review passed `smoke-pack` with the real Node path; a close-out repeat failed
  the MCP tool-list check until `NVM_DIR` was exported and the nvm Node `bin`
  directory was prepended to `PATH`. This is a host workaround, not a repo fix
  yet.
- **Deferred gates push contract gaps to the end.** P2-1 (`dh-simplify`
  outside the selection protocol) and P2-3 (demo docs) were predictable from
  the requirements but only surfaced in the final review because fast mode
  defers per-task checks. Acceptable for a docs/skills change, but R3/R8
  coverage would be tighter with a mid-plan spot check.
- **Contract test coverage boundary.** The test scans `skills/` and `agents/`
  only; a stale `@dh-*` in docs/config would only be caught by the manual `rg`
  gate.
- **Generated audit snapshot staleness.** The audit report predated the P3-1
  trim and still showed `dh-setup` at 251 lines while the file was 249;
  regenerating at close-out produced 0 size warnings and 468 resolved
  cross-references.
- **Bookkeeping lag.** `plan.md` is `Completed` but `docs/plans/index.md`
  still shows `Pending`, and the branch is not merged; the planning workflow
  owns those updates.
- **P3-4 not annotated.** `tasks/review-fast.md` still carries `fast-2` /
  eight-section historical counts; low impact because it is a pre-execution
  snapshot.

## Decisions

- **Protect the fast mirror.** Never edit `plan.md` body content in fast mode
  to record a selection; use `tasks/review.md` as the runtime selection record
  (R9 explicitly allows it). This became the P2-2 rule in `dh-final-review`.
- **Runtime hash wins.** Use `computeSourceSha256(plan.md)` as the source of
  truth for `source_sha256`; fix the mirror value rather than editing the plan.
- **Hard cut, no aliases.** Removed utility agents stay removed; bundled
  agents remain capability fallbacks, not named delegation targets.
- **Fix small review findings inline.** P2-1/P2-2/P2-3 and P3-1/P3-2/P3-3
  were applied as one-line/small edits before close-out; P3-4 was left as
  optional historical polish.
- **Treat the nvm-shim failure as an environment workaround.** Keep the repo
  scripts unchanged during close-out; propose the env hardening as a follow-up
  rather than expanding plan scope.

## Follow-ups

- Merge into `develop` (`--no-ff`), update the plans index row, and run
  `dh-semver` for the 0.5.0 minor bump with a BREAKING entry for the removed
  agents.
- Harden `scripts/lib/pack-install.mjs` `checkMcp`: pass `NVM_DIR` and/or the
  real Node `bin` path, or launch the MCP bin through `process.execPath`; add a
  regression check for isolated-HOME nvm-shim hosts.
- Align `planBody`/`computeSourceSha256` with the documented "text after the
  closing `---`" wording, or tighten the reference text; add a hash fixture
  covering leading-newline variants.
- Extend `agent-selection.test.ts` to docs/config, or add a docs `rg '@dh-'`
  gate to the QA script.
- Annotate `tasks/review-fast.md` as superseded by `fast-3` / nine sections if
  historical clarity is needed.
- Re-run the full `pnpm qa:check:full` (with the accepted `scan:deps` Docker
  exception) before tagging.

## Related

- Plan: [agent-selection-utility-skills](../../plans/agent-selection-utility-skills/plan.md)
- Evolution: [2026-11-08-agent-selection-utility-skills](../2026-11-08-agent-selection-utility-skills.md)
- Final review: [tasks/review.md](../../plans/agent-selection-utility-skills/tasks/review.md)
- Fast plan-end alignment: [tasks/review-fast-final.md](../../plans/agent-selection-utility-skills/tasks/review-fast-final.md)

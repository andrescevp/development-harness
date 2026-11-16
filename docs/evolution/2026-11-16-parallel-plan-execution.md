---
title: "Evolution — Parallel Plan Execution"
slug: parallel-plan-execution-evolution
description: "How the harness gained explicit parallel metadata, a shared DAG scheduler, worker mode, and hybrid isolation."
tags: [evolution, orchestration, parallelism]
project: "dev-harness-skills"
created: 2026-11-16
updated: 2026-11-16
stack: "Markdown skills + TypeScript MCP/TUI tooling"
feature: "Parallel Plan Execution"
epic: "Orchestration"
status: active
---

# Evolution — Parallel Plan Execution

## Overview

Plan execution moved from a strictly sequential phase/sub-task walk to an
explicit DAG scheduler shared by standard and fast modes. Plans declare
dependencies, parallel eligibility, file scopes, and isolation; the
orchestrator stays the only writer of statuses, ledger rows, and commits.

## What Changed

- **Schema:** phases gained `Parallelizable` and `Depends on`; sub-tasks gained
  `Parallelizable`, `Depends on`, `Files/Scope`, and `Isolation`. Missing fields
  default to `no`/`None`/`None`/`shared`, so legacy plans are unchanged.
- **Parser:** `plan-sections.ts` restricts parsing to the `## Phases` region and
  ignores fenced examples; `plan-metadata.ts` owns field parsing/defaults.
  `PlanPhase`/`PlanSubTask` expose the new fields through `plan_read`.
- **Scheduler contract:** `skills/dh-execute-plan/references/parallel-scheduler.md`
  defines validation, readiness, max 3 workers (hard cap 8), review fan-in,
  failure drain, worker envelope, isolation, and resume. Both orchestrators
  link it; there is no second algorithm.
- **Worker mode:** `dh-execute-plan-task`/`-fast` accept `parallel-worker` plus
  an exact sub-task id, implement/validate only, and return
  `{subTask, agent, status, filesChanged, validation, blockers, notes}`.
- **Orchestrators:** `dh-execute-plan` and `dh-execute-plan-fast` dispatch from
  the ready set. The orchestrator marks statuses before dispatch, runs reviews,
  closes phases only when all sub-tasks are complete, and serializes commits.
- **Isolation:** shared worktree only for disjoint declared scopes; overlap or
  unknown scope serializes; `Isolation: worktree` uses a dedicated
  branch/worktree with ordered integration and blocking conflicts.
- **Readers:** `plan_read` exposes metadata, `plan_create` scaffolds it, and the
  TUI tracks all active sub-tasks (`+K`, `Active: N tasks`).
- **Planning:** `dh-planning` teaches the defaults, dependency/cycle checks,
  disjoint-scope rule, and worktree isolation; the template and canonical
  fixture include the fields.

## Validation

- 77 test files / 1249 tests pass.
- Typecheck, build, Biome, knip, jscpd (0 clones), dependency-cruiser, links.
- Audit PASS: 6 agents, 27 skills, 12 MCP tools, 0 high-signature secrets,
  0 junk.
- Smoke-load/MCP/install/pack pass; OSV 669 packages 0 issues; Semgrep 90 rules
  0 findings.
- Parser covers legacy plans, CRLF, `None`, invalid values, missing fields,
  fenced phantom headings, and scaffold round-trips.

## Limits

- Independence is only as accurate as the declared metadata; the scheduler does
  not infer file scope.
- Shared-worktree tasks can still interfere through build outputs, caches,
  ports, or lockfiles; use worktree isolation for tooling-heavy work.
- Worktree integration is ordered and conflict-blocking; there is no automatic
  conflict resolution or auto-deletion.
- The scheduler runs in one session on one machine; no distributed queue.
- Concurrency is capped at 8 regardless of plan metadata.

## Follow-ups

- Consider a frontmatter `parallelism` override surfaced in tooling (currently
  orchestrator/plan metadata only).
- Add a benchmark comparing sequential vs parallel wall-clock/token cost.
- Consider opt-in scope discovery as a planning aid (never as the safety
  contract).

## Related

- [Plan](../plans/parallel-plan-execution/plan.md)
- [Scheduler contract](../../skills/dh-execute-plan/references/parallel-scheduler.md)
- [Planning template](../../skills/dh-planning/references/phased-plan-template.md)

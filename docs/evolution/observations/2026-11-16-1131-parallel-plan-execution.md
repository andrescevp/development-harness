---
title: "Observation — Parallel Plan Execution Session Learnings"
slug: parallel-plan-execution-observation
description: "Session learnings from adding explicit parallel scheduling and worker modes to the harness."
tags: [observation, orchestration, parallelism]
project: "dev-harness-skills"
created: 2026-11-16
updated: 2026-11-16
stack: "Markdown skills + TypeScript MCP/TUI tooling"
feature: "Parallel Plan Execution"
epic: "Orchestration"
status: active
---

# Observation — Parallel Plan Execution

## What Worked

- **Explicit metadata beats inference.** `Parallelizable`, `Depends on`,
  `Files/Scope`, and `Isolation` gave the scheduler a machine-checkable
  contract without pretending to understand semantic independence.
- **One scheduler reference, two adapters.** Keeping readiness/isolation in a
  single `parallel-scheduler.md` prevented the standard and fast orchestrators
  from drifting.
- **Orchestrator-only writes.** Workers returning an envelope removed the plan
  status race entirely; serialization became a design property, not a lock.
- **Fence-aware parser hardening.** Restricting parsing to `## Phases` and
  ignoring fenced examples eliminated phantom phases from plan examples — a
  latent bug exposed while validating this plan.
- **Hybrid isolation.** Disjoint shared work keeps the fast path; worktrees
  cover overlap without forcing every task into a branch.

## What Was Tricky

- **Scope declarations are the safety boundary.** `Files/Scope: None` must
  serialize; underestimating build/test side effects is the main residual risk.
- **Multiple `In Progress` is a new normal.** Every reader/resume path that
  assumed one active task had to be revisited (TUI, sync, handoff).
- **Worktree lifecycle.** Integration order, conflicts, and cleanup need
  explicit rules; automatic deletion is unsafe.
- **Fast-mode serialization.** Ledger rows and dual status writes must be
  orchestrator-only; per-worker writes would race.
- **Plan text vs parser.** Examples inside fenced blocks can look like real
  phases; the parser must ignore them.

## Decisions

- Default concurrency 3, hard cap 8.
- Workers never commit in shared worktrees; the orchestrator serializes commits.
- Worktree tasks integrate in dependency/plan order; conflicts block and preserve
  the worktree.
- Legacy plans remain sequential through defaults; no migration required.
- Phase completion still requires every sub-task `Completed`; no phase closes
  around a blocker.

## Follow-ups

- Benchmark sequential vs parallel execution and token cost.
- Consider a planning-time scope overlap linter / opt-in discovery aid.
- Consider surfacing concurrency in plan frontmatter and the TUI.
- Add a failure-injection test for worktree conflict handling in a follow-up.

---
title: Domain & Architecture Check — Parallel Plan Execution
slug: parallel-plan-execution-domain-check
description: Bounded-context and SOLID validation for the parallel orchestration plan.
tags: [domain-check, plan]
project: dev-harness-skills
stack: Markdown skills + TypeScript MCP/TUI tooling
created: 2026-11-16
updated: 2026-11-16
status: active
---

# Domain & Architecture Check: Parallel Plan Execution

## Bounded Contexts Touched

| Context | Module(s) | Risk |
|---|---|---|
| Plan format and parser | template, `src/tools/plan-lifecycle.ts`, scaffold, fixture | High |
| Scheduling/orchestration | `skills/dh-execute-plan*`, scheduler reference | High |
| Task execution | `skills/dh-execute-plan-task*` worker mode | Medium |
| Planning | `skills/dh-planning` decomposition guidance | Medium |
| Isolation/worktrees | `skills/dh-create-worktree`, orchestrator integration | High |
| Readers/tools | `src/mcp`, `src/tui` | Medium |
| Verification/docs | tests, README/AGENTS/LOADING/CHANGELOG | Low |

Standalone harness repository; these are module boundaries, not domain
aggregates.

## Cross-Context Concerns

- **Scheduler ↔ plan format:** the scheduler can only trust explicit metadata;
  parser defaults must preserve legacy sequential behavior.
- **Orchestrator ↔ worker:** status/ledger ownership must be one-sided. Workers
  cannot write plan files; the orchestrator serializes writes and commits.
- **Shared worktree ↔ worktree isolation:** scope declaration is the only
  safety signal. Unknown/overlapping scopes must serialize or isolate; build
  artifacts/ports remain a documented residual risk.
- **Standard ↔ fast orchestrators:** one scheduler reference, two adapters. Fast
  mode differs only in gates/ledger timing, not readiness/isolation.
- **Readers:** multiple `In Progress` is a new normal; TUI/plan tools must not
  assume a single active task.

## SOLID Compliance

| Principle | Change | Status | Note |
|---|---|---|---|
| SRP | Parser, scheduler, worker, isolation, readers | ✅ | Each unit owns one concern; scheduler contract is separate from both orchestrators. |
| OCP | New metadata + scheduler; legacy plans unchanged | ✅ | Missing fields default to sequential; no rewrite of the phased model. |
| LSP | No inheritance/type hierarchy | ✅ | Parser fields are additive; structural skill contracts. |
| ISP | Workers receive a sub-task brief/envelope only | ✅ | Workers do not get scheduling/status responsibilities. |
| DIP | Orchestrators depend on the scheduler contract; workers on the task brief | ✅ | Both standard/fast link the same reference; no duplicated algorithm. |

## Verdict

Proceed with caution.

## Blocking Issues

None. The tracked risks are inaccurate scope declarations, shared-worktree
build/test interference, and worktree merge conflicts; all are covered by
explicit policy, serialization fallbacks, and failure-drain tests in the plan.

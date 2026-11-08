---
title: Pause and Resume Plan Skills
slug: pause-resume-plan-skills
description: Add explicit pause/resume capabilities to the harness so a phased plan can stop safely and continue with full session context via a durable handoff artifact.
tags: [sdd, design, harness, plans]
project: dev-harness-skills
stack: markdown skills + TypeScript inventory/test tooling
created: 2026-11-07
updated: 2026-11-07
status: proposed
---

# Software Design Document: Pause and Resume Plan Skills

## Problem Statement

Long-running plans routinely span multiple sessions, agents, and days. The
harness can already resume from `plan.md` status markers (first `In Progress`
phase, then its first `In Progress`/`Pending` sub-task), but it loses the
session context needed to continue safely: what was being attempted, why
decisions were made, which files are dirty, what validation was already run,
and what the next concrete action is.

Without that context, stopping a plan risks duplicate work, lost reasoning,
accidental overwrites, or blindly continuing over a workspace that no longer
matches the paused state. The harness needs explicit pause and resume
lifecycle skills. Pause must produce a durable handoff artifact beside the
plan; resume must validate the artifact, detect drift, rehydrate context, and
then re-enter the existing execution loop.

## Goals / Non-Goals

- **Goals:** Give users an explicit, safe way to stop a plan and continue it
  later; preserve reasoning and workspace state across sessions; detect
  material drift before work resumes; keep the existing 3-status plan model
  and MCP tools untouched; make pause/resume first-class bundled skills with
  automated contract enforcement.
- **Non-goals:** Adding a `Paused` phase/sub-task status; changing the plan
  parser, status vocabulary, or MCP tools; auto-committing, stashing,
  resetting, or checking out; background daemons or cross-agent locking;
  commands/prompts; migrating existing plans; automatic resume at session
  start.

## Requirements

- **R1:** A bundled `dh-pause-plan` skill exists with pause, suspend, stop,
  end-session, and handoff triggers, and a deterministic safe pause workflow.
- **R2:** A bundled `dh-resume-plan` skill exists with resume, continue,
  pick-up-where-I-left-off, and handoff triggers, and a validated resume
  workflow.
- **R3:** Pause writes `docs/plans/<plan-slug>/handoff.md` beside `plan.md`.
  The artifact has a versioned contract and records the plan position,
  progress, completed and in-flight work, decisions, blockers, validation
  state, uncommitted changes, and ordered next steps.
- **R4:** Pause is read-only with respect to code and plan state: it does not
  change phase/sub-task statuses, commit, stash, reset, check out, or switch
  branches. Re-pausing refreshes the snapshot and appends history instead of
  destroying prior context.
- **R5:** Resume validates the handoff contract and detects material drift
  using branch, HEAD ancestry, worktree state, plan content hash, and merge
  conflicts. Material drift stops and asks; work is never discarded.
- **R6:** Resume treats `plan.md` as the source of truth for task status,
  rehydrates a concise context summary, marks the handoff consumed with a
  resume log, and delegates execution to `dh-execute-plan` resume mode rather
  than reimplementing the loop.
- **R7:** `dh-execute-plan` detects a paused handoff and redirects to
  `dh-resume-plan`; `dh-execute-plan-task` recommends pausing when a hard
  blocker stops execution.
- **R8:** The plan status model stays exactly `Pending | In Progress |
  Completed`; no frontmatter pause flag, parser change, or new MCP tool is
  introduced.
- **R9:** The bundled inventory, registration assertions, installer/smoke
  checks, audit inputs, and documentation move from 17 to 19 skills in one
  consistent change.
- **R10:** An automated contract test guards the handoff template's required
  frontmatter fields and sections, both skills' references to it, and the
  absence of a fourth plan status.
- **R11:** A scripted rehearsal (clean pause, re-pause, drift, already-resumed,
  non-git) and the full repository QA gate prove the behavior and prevent
  regressions.
- **R12:** Harness documentation presents pause/resume as cross-cutting
  lifecycle skills and the plans index tracks this plan.

## Scope

- **In scope:** the two skills; the handoff template and lifecycle; the
  execute-plan/execute-plan-task integration; the 19-skill inventory updates;
  the contract test; rehearsal evidence; documentation and release gates.
- **Out of scope:** plan-status model changes; new MCP tools; destructive git
  automation; background persistence; multi-agent locking; commands/prompts;
  rewriting historical plans or reports; publishing/tagging without approval.

## Constraints

- Skills are markdown instructions; no runtime dependency may be added.
- Skill files stay under the repository's 250-line audit limit; supporting
  material goes into `references/`.
- `handoff.md` is committed with the plan (`docs/plans` is tracked); npm pack
  must continue to exclude `docs/`.
- Git is optional: non-git workspaces must degrade gracefully and be marked
  unverifiable rather than failing the pause.
- Handoff content must never include secrets, tokens, environment values, or
  full diffs.
- Existing plan behavior and MCP tool contracts must remain backward
  compatible.

## Risks and Edge Cases

- **Secret leakage:** a handoff could capture env values or credentials.
  Mitigation: redaction rules plus a secret-pattern scan before reporting.
- **False-positive drift:** unrelated work can make the workspace differ.
  Mitigation: classify clean/explainable/material and ask before acting.
- **Stale handoff vs edited plan:** the plan may have advanced after the
  pause. Mitigation: `plan_sha256` plus plan-vs-handoff reconciliation, with
  plan status winning.
- **Count drift:** 17 appears in code, tests, smoke scripts, and docs.
  Mitigation: one inventory pass plus a stale-count grep gate.
- **Cross-skill reference breakage:** relative reference paths may not survive
  bundling. Mitigation: verify packed assets; duplicate critical field
  expectations in the resume skill if needed.
- **Concurrent sessions:** no lock is provided. Mitigation: detect drift and
  warn instead of overwriting.
- **Ambiguous active plan or sub-task:** never guess; record the ambiguity or
  ask the user.
- **Already-resumed handoff:** re-running resume must report the consumed
  state instead of silently executing again.

## Acceptance Criteria

- **AC1:** Pausing an in-progress plan creates `handoff.md` with the versioned
  frontmatter and every required section; `plan.md` is byte-identical and no
  commit/stash/reset/checkout occurred.
- **AC2:** Re-pausing refreshes the snapshot and appends a Pause History row
  while preserving prior rows.
- **AC3:** The handoff contains no secret-like values and records uncommitted
  paths only, not diffs or file contents.
- **AC4:** Resuming a clean handoff validates it, prints the rehydration
  summary, marks `status: resumed` with `resumed_at` and a history row, then
  invokes `dh-execute-plan` resume mode.
- **AC5:** Resuming with branch/HEAD/plan-hash drift stops and asks; no
  destructive git command runs.
- **AC6:** Resuming an already-resumed handoff reports it as consumed and does
  not execute silently.
- **AC7:** Multiple paused plans cause resume to list and ask; a non-git
  workspace pauses with unverifiable git fields and resumes with a warning.
- **AC8:** `dh-execute-plan` with a paused handoff redirects to
  `dh-resume-plan` instead of starting from plan statuses.
- **AC9:** The plan parser still accepts only `Pending | In Progress |
  Completed`; existing plan tests pass unchanged in behavior.
- **AC10:** All inventory gates report 19 skills, and the handoff contract
  test fails when a required field or section is removed.
- **AC11:** The full QA gate passes and rehearsal evidence covers clean,
  drift, already-resumed, and non-git scenarios.
- **AC12:** Harness docs and the plans index are consistent; npm pack contents
  remain unchanged except for the two new skill assets.

## Open Questions

- Should `handoff.md` be committed by default? Assumed yes because
  `docs/plans` is tracked; revisit if teams prefer local-only handoffs.
- Should clean resume always delegate immediately, or wait for a confirmation
  step? Assumed immediate delegation with a summary; ask only on material
  drift.
- Should `docs/plans/index.md` expose a paused value? Assumed no; the handoff
  status is the pause signal and the index schema stays unchanged.

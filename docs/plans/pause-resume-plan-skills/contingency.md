---
title: "Contingency Analysis: Pause and Resume Plan Skills"
slug: pause-resume-plan-skills
description: Compare sidecar handoff, plan-frontmatter pause, and fourth-status designs for pausing and resuming phased plans.
tags: [contingency, plan, harness]
project: dev-harness-skills
created: 2026-11-07
updated: 2026-11-07
---

# Contingency Analysis: Pause and Resume Plan Skills

## Architectural Decision Areas

1. **Pause state representation** — where the fact "this plan is paused" lives:
   a sidecar artifact, plan frontmatter, or the phase/sub-task status model.
2. **Handoff lifecycle** — whether the handoff is kept, marked consumed,
   archived, or deleted after resume.
3. **Resume entry point** — explicit `dh-resume-plan`, implicit detection in
   `dh-execute-plan`, or a new MCP tool.
4. **Drift evidence** — git branch/HEAD/worktree plus plan hash, timestamps
   only, or a full diff snapshot.
5. **Contract ownership** — one canonical template under the pause skill, a
   shared reference under both skills, or generated code in the MCP server.

## Plan A: Sidecar Handoff with Explicit Resume — Recommended

### Approach

1. Keep `plan.md` as the only task-state store; pause never edits statuses or
   frontmatter. `docs/plans/<slug>/handoff.md` is the pause signal.
2. Pause resolves the active plan/sub-task, collects read-only git evidence,
   hashes `plan.md`, reads open review findings, and writes a versioned
   handoff with ordered next steps and an append-only pause history.
3. Resume resolves the paused handoff, validates version/slug/sections and
   `status: paused`, then compares branch, HEAD ancestry, worktree, plan hash,
   and merge conflicts. Material drift stops and asks.
4. Plan statuses win over handoff claims; resume summarizes context, marks the
   handoff `resumed` with a log entry, and delegates to `dh-execute-plan`
   resume mode.
5. `dh-execute-plan` detects a paused handoff and redirects to
   `dh-resume-plan`; `dh-execute-plan-task` recommends pausing on hard
   blockers.

### Risk: Low

- Handoff could leak secrets if redaction fails; mitigated by rules and a
  pattern scan.
- Drift detection can false-positive; mitigated by classification and asking.
- Handoff can go stale relative to the plan; mitigated by plan hash and
  reconciliation.

### Complexity: M (about 2–3 focused implementation passes)

- One template reference, two skills, two integration edits, one test, one
  inventory/docs sweep, one rehearsal.

### Trade-offs

- **Gain:** zero impact on the parser/MCP contract; cheap to adopt; easy to
  inspect and commit with the plan; resume remains explicit and safe.
- **Sacrifice:** paused state is not visible in plan status/frontmatter; a
  separate artifact must be maintained; consumers must know to look for it.

## Plan B: Plan-Frontmatter Pause Flag

### Approach

1. Add `paused: true` / `paused_at` to `plan.md` frontmatter, with the same
   sidecar handoff for context.
2. Pause edits frontmatter and writes the handoff; resume clears the flag
   after validation.
3. `dh-execute-plan` checks the flag and redirects to resume.
4. Keep the 3-status phase/sub-task model.

### Risk: Medium

- Every writer of plan frontmatter must preserve the new keys.
- A forgotten clear leaves a plan permanently "paused".
- Parser tests and tooling need frontmatter-aware assertions.

### Complexity: M (similar scope plus parser/test changes)

- Template, parser metadata handling, tests, docs, and recovery for stale
  flags.

### Trade-offs

- **Gain:** pause visible in the plan itself and easy to query without reading
  handoff files.
- **Sacrifice:** mutates the source-of-truth plan and adds state that can
  desynchronize from the handoff; contradicts the "pause is read-only"
  safety property.

## Plan C: Fourth `Paused` Status

### Approach

1. Add `Paused` to the phase/sub-task status domain.
2. Pause flips the active sub-task (or phase) to `Paused`; resume flips it back
   to `In Progress`.
3. Update parser, status tool, template, execution selection, review/final
   review, tests, and all docs.
4. Keep a handoff for context.

### Risk: High

- Breaks the documented 3-status contract and every consumer that enumerates
  statuses.
- Phase lifecycle gains a third transitional state with unclear close rules.
- MCP tool enum and installer/smoke fixtures must change in lockstep.

### Complexity: L (cross-cutting parser/tool/test/doc migration)

- Parser and MCP changes, lifecycle semantics, migration notes, test rewrites,
  and downstream skill updates.

### Trade-offs

- **Gain:** pause is first-class in the status model and can gate execution
  naturally.
- **Sacrifice:** high regression surface for a session-lifecycle concern;
  conflates task completion state with execution-session state.

## Recommendation

**Proceed with Plan A** — it delivers the requested pause/resume workflow
with the smallest contract surface: the 3-status plan model and MCP tools stay
untouched, while the handoff carries exactly the session context that plan
status cannot express.

Adopt Plan B only if stakeholders require pause visibility inside `plan.md`
itself and accept plan mutation plus stale-flag recovery. Adopt Plan C only if
the plan lifecycle must represent pause as a first-class task state and all
consumers (parser, MCP tool, skills, tests, docs) can be migrated together.

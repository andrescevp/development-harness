---
title: "Web Research Agent and Skill — session learnings"
slug: dh-research-agent-skill-session-learnings
description: "What worked and what did not while porting PR #4 fresh: rewriting a conflicting 7-agent PR onto the current corpus, sweeping 6/27/33 through tests, CLI, smokes, and docs, keeping note writes with the documentation agent, enforcing source-citation discipline, and closing the fast-mode omission gap for a new top-level plan section."
kind: observation
id: obs-20261116-0110-dh-research-agent-skill
date: 2026-11-16
agent: "dh-documentor"
project: "dev-harness-skills"
stack: "Markdown agents/skills + TypeScript inventory and test tooling"
plan: "dh-research-agent-skill"
tags: [observation, topic/research, topic/agents, topic/skills, topic/fast-mode]
feature: "Web Research Agent and Skill"
epic: "Research capability"
created: 2026-11-16
updated: 2026-11-16
confidence: 0.7
status: active
---

# Observation: Web Research Agent and Skill — session learnings

## Overview

Port of PR #4 onto `develop` in fast mode: 3 phases / 11 sub-tasks adding
`dh-researcher`, `dh-research`, the `docs/research/` registry, an optional
`## Research` plan section, one optional execution unblock line, planning
integration, an inventory sweep from 5/26/31 to 6/27/33, a contract suite, and a
full verification gate. The PR was conflicting and based on an older 7-agent
corpus, so it served as design input only. Two review comments shaped the
outcome: a single research registry with documentation-agent ownership, and an
optional execution unblock instead of a "loop step 2.4".

## What Worked

- **Fresh port beat resolving a stale branch.** The PR's intent was re-written
  against the current corpus instead of rebasing it: `@dh-explorer` and
  `@dh-executor` became the `dh-explore` and `dh-execute-cli` skills, the 2.4
  framing was dropped, and the review comments were designed in rather than
  patched on. The result was a 40-file tracked diff (+460/−249) plus four new
  content files, with no conflict resolution and a reviewable scope.
- **The SDD captured PR review evidence before implementation.** The two review
  comments, the 7-agent mismatch, and the reject-alternatives list were recorded
  in [`sdd.md`](../../plans/dh-research-agent-skill/sdd.md) and the plan's
  Requirements Snapshot. Every later sub-task could cite R1–R9 and AC1–AC8
  instead of re-litigating the design, and the stale-corpus trap was visible
  from the first sub-task.
- **The count sweep was mechanical and exhaustive.** `rg` across `src/`,
  `scripts/`, `docs/`, `AGENTS.md`, `README.md`, `skills/index.md`, and
  `demo-project/` found every 5/26/31 surface: five test files, the TUI
  checklist fixture/test, CLI `EXPECTED_*`, the install-harness fixture,
  install-command assertions, `LOOP` lists, pack smokes and their comments, and
  project docs. Audit loop membership reported 27/27 skills and 6/6 agents on
  the first regenerated run.
- **The sweep exposed a latent pack-smoke bug.** `scripts/smoke-pack.mjs`
  asserted 26 skills but its mismatch message tested `skillCount !== 25`; the
  count edit corrected the off-by-one. A stale count is not always a doc
  problem — sometimes it hides a check that could never fail with the right
  message.
- **Ownership held because the researcher is instructed not to write.** The
  skill grants only `read, webfetch, websearch`; the contract test asserts that
  list. The payload-plus-row handoff to
  `dh-documentor`/`dh-create-documentation` kept `docs/research/` under the same
  documentation contract as every other generated doc, and the caller fallback
  covers sessions where nested delegation is unavailable.
- **Citation discipline was designed into the template, not left to judgment.**
  The note template forces Question/Caller/Date/Tools, a Findings table with
  source URL + retrieval date + confidence per row, Implications, Sources, and
  an overall Confidence. The rules add "no source means no finding", version
  pins, explicit conflict reporting, and "fail loudly" when no browsing tool
  exists. The contract test pins the phrases that keep that structure from
  eroding.
- **The fast omission gap was closed on four surfaces.** `Research` went into
  `FAST_OMITTED_SECTIONS` and into the prose lists in `dh-execute-plan-fast`,
  its template reference, and `dh-review` Plan Alignment Mode. The contract test
  asserts exactly one backticked `## Research` in each omission surface, and
  that the section sits before `## Agent Selection` and outside `## Phases` in
  the template and scaffold.
- **The verification gate is broad enough to catch packaging drift.**
  `smoke-install`, `smoke-pack` (392 files), and the Docker scans all ran, so the
  new assets were proven to travel through the managed installer and npm
  tarball, not just through source mode.

## What Didn't

- **A fresh port still copies structure that must be re-read.** The PR text
  assumed 7 agents and a loop step; both were wrong for this corpus. Porting
  sentence-by-sentence without checking the contract would have smuggled in
  removed agent names and a rejected integration model. The contract test now
  forbids `@dh-explorer`/`@dh-executor`, plan-local research paths, and any
  `step 2.4` mention, but that guard exists because the risk was real.
- **Counts live in more places than a test failure reveals.** Prose, comments,
  fixture text, smoke messages, CLI error strings, and demo docs all asserted
  5/26/31. Tests would have caught the numeric assertions but not the stale
  prose; only the explicit `rg` sweep did. A partial sweep could have left a
  green test run and a misleading README.
- **The fast-alignment omission list is duplicated by design.** A new top-level
  section must be added to `FAST_OMITTED_SECTIONS` *and* to three prose
  surfaces. Structural `dh_plan_fast_sync` compares phases, statuses, and
  sub-task fields — it does not know that a missing omission list entry will
  make the alignment review flag the section. The pre-execution review had to
  reason about `## Research` before Sub-Task 1.3 formally allowed it.
- **The documentation handoff is enforced by prose and the skill's tool list,
  not by the runtime.** The agent is instructed not to persist and the skill
  grants no `write` tool, but "hand the payload to the documentation owner"
  depends on the caller resolving that owner. The fallback (return the payload
  to the caller) keeps the workflow usable, at the cost of two possible writers
  if a future edit grants the researcher a write tool.
- **Citation presence is testable; citation accuracy is not.** The suite can
  assert that a source URL and retrieval date are required. It cannot tell
  whether the page says what the note claims, whether the retrieval date is
  real, or whether `model knowledge` was used honestly. Source quality remains a
  review and sampling problem.
- **The registry ships empty.** That is honest — no research question has been
  run — but it means the note template, the index row, and the topic-collision
  rule are not yet exercised against real content. The first live note is the
  real test.
- **Plan-local research paths are rejected, but plans still need discipline.**
  The `## Research` section is link-only and carries no status markers; a plan
  author who pastes findings into the plan instead of linking a note recreates
  the second source of truth the review comment rejected.

## Decisions

- **Port, do not rebase.** The PR branch was left untouched; the design intent
  was re-implemented on `develop`. This avoided a conflict-heavy branch and
  removed stale agent names instead of preserving them.
- **Compose in the researcher, persist in the documentor.** The split keeps the
  documentation-ownership contract intact and gives the researcher a
  least-privilege boundary: no writes, no commands, no code.
- **One optional line in each execution skill.** Research is not a gate and not
  a loop step. The line is browse-gated, one pass, and subordinate to the
  existing halt — if evidence is inconclusive, the sub-task still stops.
- **`## Research` stays outside the phases region.** That keeps the parser and
  legacy plans unchanged, and it justifies the intentional fast-mirror
  omission.
- **No search MCP or dependency.** Use what the host exposes; when nothing is
  available, fail loudly rather than fabricating a source.
- **Empty registry over seeded examples.** PR and SDD evidence stays in the
  plan; the registry starts clean so no row pretends to be a research note.
- **Keep corpus counts in the inventory tests, not the contract suite.** The
  contract suite pins research behavior; 6/27/33 stays in the existing asset,
  frontmatter, registration, CLI, and smoke surfaces so there is one place to
  change when the corpus moves again.

## Follow-ups

- **Next corpus change:** sweep counts before running the gate with
  `rg -n "6 agents|27 skills|33" src scripts docs AGENTS.md README.md skills/index.md demo-project`
  and include fixture text, CLI error strings, and smoke messages — not just
  assertions.
- **Next top-level plan section:** update `FAST_OMITTED_SECTIONS`, the fast
  skill, the fast template reference, and `dh-review` Plan Alignment Mode in the
  same change, then add one contract assertion per surface. Consider deriving the
  prose lists from a shared source so the four places cannot drift.
- **First live research note:** verify the template, the registry row, and
  topic-collision handling against a real question; amend the skill template if
  the shape needs adjustment rather than hand-editing a one-off note.
- **Source-quality sampling:** when a note drives a decision, spot-check one
  citation per note and confirm the retrieval date; treat `model knowledge`
  findings as assumptions until a primary source exists.
- **Deferred capability work:** decide whether `dh-setup` should audit for a
  search-capable MCP, whether `dh-review`/`dh-code-review` need research for
  CVE/API claims, and whether research notes need a retention policy.
- **PR #4:** decide whether to close it as superseded and link this plan, or
  keep it as historical design input. Do not revive its 7-agent text.
- **Release:** run `dh-semver` at plan end; no version is claimed in this note.

## Related

- Plan: [dh-research-agent-skill](../../plans/dh-research-agent-skill/plan.md)
- Evolution: [2026-11-16-dh-research-agent-skill](../2026-11-16-dh-research-agent-skill.md)
- SDD: [sdd.md](../../plans/dh-research-agent-skill/sdd.md)
- Fast alignment review: [tasks/review-fast.md](../../plans/dh-research-agent-skill/tasks/review-fast.md)
- Components diagram: [diagrams/components.md](../../plans/dh-research-agent-skill/diagrams/components.md)
- Agent: [dh-researcher.md](../../../agents/dh-researcher.md)
- Skill: [skills/dh-research/SKILL.md](../../../skills/dh-research/SKILL.md)
- Registry: [docs/research/index.md](../../research/index.md)

# Handoff Template (authoritative format contract)

Canonical format for `handoff.md` (written by `dh-pause-plan`, consumed by
`dh-resume-plan`) at `docs/plans/<plan-slug>/handoff.md`; keep the test in sync.

## Contract overview

- **Sidecar, not a second plan.** `plan.md` stays the source of truth for task status; the handoff never overrides it.
- **Session continuity.** Records where execution stopped, why, what is in flight, what was decided, what was validated, and how to continue.
- **One handoff per plan.** Re-pausing refreshes the snapshot and appends
  history; earlier rows are never discarded.
- **Git is optional.** Unknown values are `null`; resume degrades to `plan_sha256` plus file evidence.

## Versioning

- `handoff_version: 1` is current. Bump it **only** for breaking changes:
  removed/renamed fields or sections, altered status/history semantics; additive changes do not bump it.
- `dh-resume-plan` accepts only `1`. A missing, non-integer, or unknown/higher
  version is a hard stop: report it; never guess a mapping or migration.

## Frontmatter fields

Quote timestamps and `subtask_index` (`"2.3"`); ISO-8601 UTC with `Z` is required.

| Field | Type | Meaning and when the value is `null` |
|---|---|---|
| `handoff_version` | integer | Contract version; `1` today. |
| `plan_slug` | string | Plan slug; matches the plan frontmatter `slug` and the `docs/plans/<slug>/` directory. |
| `plan_path` | string | Repo-relative path to the plan, e.g. `docs/plans/example-plan/plan.md`. |
| `status` | string | `paused` or `resumed`; see Status lifecycle. |
| `created` | string | First handoff write; never changes on re-pause. |
| `updated` | string | Latest write; equals `paused_at` while paused. |
| `paused_at` | string | Latest pause timestamp. |
| `resumed_at` | string \| null | Consuming resume timestamp; `null` while `status: paused`. |
| `branch` | string \| null | Current git branch; `null` when git is unavailable or HEAD is detached (record the short SHA in Snapshot). |
| `base_commit` | string \| null | Full 40-hex SHA of `HEAD` at pause; `null` when git is unavailable. |
| `worktree_dirty` | boolean \| null | Whether non-handoff, non-`*.tmp` worktree paths exist; content is covered by `worktree_fingerprint`; `null` when git is unavailable. |
| `worktree_fingerprint` | string \| null | Lowercase SHA-256 over sorted `status<TAB>path<TAB>blob-SHA` lines for the recorded paths (`DELETED` when missing; untracked directories expanded with `git ls-files --others --exclude-standard`, `DIR_EMPTY` when empty), excluding the handoff and `*.tmp`; `null` when git or a hashing tool is unavailable (path set/content unknown). |
| `plan_sha256` | string \| null | Lowercase SHA-256 of `plan.md` (`sha256sum` / `shasum -a 256`); `null` when no hashing tool exists. |
| `phase_index` | integer \| null | 1-based phase number, e.g. `2`; `null` when no phase is active. |
| `subtask_index` | string \| null | Sub-task id `"N.M"`, e.g. `"2.3"`; `null` when no sub-task is active. |
| `progress` | string | `"completed/total"` sub-tasks, e.g. `"4/12"`. |
| `next_action` | string | One imperative line: the first thing the next session must do. |
| `blocked` | boolean | `true` when a hard blocker or P0/P1 finding stopped the loop. |
| `tags` | list | Fixed literal: `[handoff, plan]`. |
| `project` | string | Project name; matches the plan frontmatter `project`. |

## Required sections

- `## Snapshot` — 2–4 sentences: plan, position, why paused, branch/worktree state, git availability; retained after resume as the pause-point audit snapshot (resume does not rewrite it).
- `## Current Position` — phase/sub-task index, title and status, previous completed, next in order, `progress`, ambiguity.
- `## Work Completed` — one line per completed sub-task: outcome plus paths and review/commit ids (never contents).
- `## Work In Flight` — files touched, intent, exact stopping point, what remains.
- `## Uncommitted Changes` — paths + content fingerprint, grouped modified/added/deleted/untracked with a one-line purpose, excluding the handoff and `*.tmp`; `worktree_dirty`/`worktree_fingerprint` reflect the remaining paths; `None` when clean, `Unverifiable` without git.
- `## Decisions and Rationale` — decisions and why; constraints the next session must respect.
- `## Blockers and Risks` — hard blockers, P0/P1 findings with their review path, risks, user input needed.
- `## Validation State` — commands actually run with observed pass/fail/not run, and what to re-run. Never invent results.
- `## Next Steps` — ordered numbered steps; step 1 matches `next_action`.
- `## Resume Checklist` — checkbox gates resume verifies before execution.
- `## Pause History` — append-only history table (columns below).

## Status lifecycle

`paused` → `resumed`. Pause writes/refreshes a paused handoff; resume stamps
`status: resumed` and `resumed_at` when execution is about to start and keeps
the file for audit. Re-pause refreshes every snapshot field, sets
`status: paused`, resets `resumed_at: null`, and **appends** a `re-paused`
row — prior rows are never deleted, reordered, or rewritten. An already
`resumed` handoff is consumed: report it, never silently reuse it. Resume
changes only `status`, `resumed_at`, `updated`, and the history row; the
paused narrative remains the record. Content changes to a recorded dirty path
are material on resume even when the path set is unchanged.

Pause History columns: `Timestamp` | `Event` (`paused` | `resumed` | `re-paused`) | `Position` (`Phase N / Sub-Task N.M`, `—` if missing) | `Note` (no secrets, diffs, or contents).

## Safety and redaction rules

- Never record secrets, tokens, API keys, passwords, auth headers, private
  keys, connection strings, or environment variable **values** (names only).
- Never paste full diffs, file contents, or large command output — record
  paths, commit ids, and one-line summaries.
- No customer/personal data and no URLs with embedded credentials.
- Record only observed validation results: unrun = `not run`, unavailable
  tools = `unavailable`. Never fabricate a pass.
- Source material containing a secret → write `[redacted]` and note it in
  `## Snapshot`.
- Scan before reporting success; inspect every match and redact real values
  (generic prose about secrets is expected):
  `rg -ni "api[_-]?key|secret|password|bearer\s|token|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY" docs/plans/<plan-slug>/handoff.md`

## Template

```markdown
---
handoff_version: 1
plan_slug: example-plan
plan_path: docs/plans/example-plan/plan.md
status: paused
created: "2026-11-07T09:15:00Z"
updated: "2026-11-07T15:42:00Z"
paused_at: "2026-11-07T15:42:00Z"
resumed_at: null
branch: feature/example-plan-execution
base_commit: 4f2c9ab7d1e8c3a5b6d0e9f8a7c6b5d4e3f2a1b0
worktree_dirty: true
worktree_fingerprint: 3f786850e387550fdab836ed7e6dc881de23001b9f1f2f1a3c4d5e6f708192a3
plan_sha256: 9b1d2f3a4c5e6b7a8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b
phase_index: 2
subtask_index: "2.3"
progress: "4/12"
next_action: "Read docs/plans/example-plan/tasks/review.md and fix finding R-3."
blocked: true
tags: [handoff, plan]
project: example-app
---

## Snapshot

Paused during Phase 2 (Harness workflow integration), Sub-Task 2.3, after
`dh-review` produced one P1 finding. 4 of 12 sub-tasks are `Completed`;
branch `feature/example-plan-execution`, 3 uncommitted paths. Git evidence
was available at pause; no drift check since.

## Current Position

- Phase: 2 — Harness workflow integration (`In Progress`)
- Sub-Task: 2.3 — Align pause/resume wording (`In Progress`)
- Previous completed: 2.2 — Update AGENTS.md and skills index
- Next in order: 2.4 — Rehearse pause and resume
- Progress: 4/12 sub-tasks `Completed` (Phase 1 done; Phase 2 at 2/4)
- Ambiguity: none detected

## Work Completed

- 1.1 Authored the handoff contract — `skills/dh-pause-plan/references/handoff-template.md`; review clean.
- 1.2 Authored the pause skill — `skills/dh-pause-plan/SKILL.md`; commit `a1b2c3d`.
- 2.1 Added the paused-handoff guard — `skills/dh-execute-plan/SKILL.md`.
- 2.2 Updated `AGENTS.md` and `skills/index.md` to list both lifecycle skills.

## Work In Flight

- 2.3 started: hard-blocker bullet in `skills/dh-execute-plan-task/SKILL.md`
  now recommends `dh-pause-plan`; stopped there.
- Remaining: apply the same wording to the failure path, then lint + contract test.

## Uncommitted Changes

- Modified: `skills/dh-execute-plan-task/SKILL.md` — blocker path recommends pause.
- Modified: `src/__tests__/handoff-contract.test.ts` — section assertions, not run yet.
- Untracked: `docs/plans/example-plan/tasks/rehearsal-notes.md` — scratch log.

No diffs or file contents; `git status --porcelain` listed 3 paths.

## Decisions and Rationale

- Sidecar kept, plan statuses untouched — avoids a parser/status change (R8).
- `plan_sha256` instead of plan content — detects edits without duplicating truth.
- Stopped at the P1 finding — loop step 2.4 halts on a blocked sub-task.

## Blockers and Risks

- **BLOCKER:** P1 R-3 in `docs/plans/example-plan/tasks/review.md` — resume
  accepts an unknown major version instead of stopping; 2.3 stays open.
- Risk: the project-scope `dh` MCP server may be disconnected; reconnect it before relying on `dh_plan_read`.
- User input: not required unless R-3 forces a contract change.

## Validation State

- `pnpm test -- handoff-contract` — fail, 1 assertion (unknown major version),
  observed `2026-11-07T15:35:00Z`; `pnpm build` not run, re-run it on resume.
- `pnpm lint:biome` — pass at `2026-11-07T15:30:00Z`, before the last edit.

## Next Steps

1. Read `docs/plans/example-plan/tasks/review.md` and fix finding R-3.
2. Re-run `pnpm test -- handoff-contract`, then `pnpm lint:biome` and `pnpm build`.
3. Run `dh-review`; mark 2.3 `Completed` only with no P0/P1 findings.
4. Continue with Sub-Task 2.4 (pause/resume rehearsal).

## Resume Checklist

- [ ] `handoff_version` is `1`; `status` is `paused`; slug/path resolve.
- [ ] Branch is `feature/example-plan-execution`; HEAD descends from `4f2c9ab`.
- [ ] Worktree matches recorded paths; `sha256sum docs/plans/example-plan/plan.md` equals `9b1d2f3a…`.
- [ ] Plan wins: statuses reconciled, none moved backwards.
- [ ] Blocker R-3 resolved or explicitly accepted by the user.
- [ ] Validation re-run before editing code.
- [ ] On start: set `status: resumed`, stamp `resumed_at`, append history.

## Pause History

| Timestamp | Event | Position | Note |
|---|---|---|---|
| 2026-11-07T09:15:00Z | paused | Phase 1 / Sub-Task 1.1 | Initial pause before drafting. |
| 2026-11-07T10:05:00Z | resumed | Phase 1 / Sub-Task 1.1 | Continued with `dh-execute-plan`. |
| 2026-11-07T12:20:00Z | re-paused | Phase 1 / Sub-Task 1.2 | End of morning session. |
| 2026-11-07T13:40:00Z | resumed | Phase 1 / Sub-Task 1.2 | Continued execution. |
| 2026-11-07T15:42:00Z | re-paused | Phase 2 / Sub-Task 2.3 | Blocked by P1 finding R-3. |
```

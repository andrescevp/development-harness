---
title: Pause/Resume Rehearsal
slug: pause-resume-rehearsal
description: End-to-end rehearsal of dh-pause-plan and dh-resume-plan in throwaway git and non-git workspaces, including drift and degraded modes.
created: 2026-11-07
updated: 2026-11-07
tags: [rehearsal, handoff]
project: dev-harness-skills
status: completed
---

# Pause/Resume Rehearsal

## Goal and Setup

Prove the pause/resume instructions work end-to-end without touching production
code or the real plan. The main scratch workspaces:

- `/tmp/dh-pause-rehearsal` — `git init`, local user, base commit `8a6e3f2`
  containing `docs/plans/demo-plan/plan.md` (4 sub-tasks: 1.1 `Completed`,
  1.2 `In Progress`, 1.3 `Pending`, 2.1 `Pending`) and `src/feature.txt`.
  After the commit: `src/feature.txt` modified (in-flight) and `notes-wip.md`
  untracked.
- `/tmp/dh-pause-rehearsal-nogit` — the same plan, no git repository.

`dh_plan_read` was unavailable in the scratch workspaces, so the documented
manual fallback (phased markers) was used. Steps 0–5 of both skills were
followed; the drift checks were evaluated exactly as Step 2 describes. Neither
workspace included an `sdd.md`: the resume skill reads it only when present, so
this exercises the absent-SDD path; resume validation does not require an SDD,
so no separate assertion is needed.

## Scenario Results

| # | Scenario | Command(s) | Expected | Observed | Result |
|---|---|---|---|---|---|
| A | Clean pause | pause Steps 0–5 | handoff paused at 1.2, 1/4, hashes match, no plan changes | all asserted true | PASS |
| B | Re-pause | pause again | `created` preserved, `re-paused` appended | `paused` → `re-paused`; 2 rows | PASS |
| C | Plan-hash drift | edit 1.3 to `In Progress`; resume Steps 0–2 | plan hash material; STOP; handoff stays paused | `plan_hash=material`; STOP | PASS |
| D | Branch drift | `git switch -c other-branch`; resume Steps 0–2 | branch material; STOP | `branch=material` (`master -> other-branch`) | PASS |
| E | HEAD drift touching recorded work | commit `src/feature.txt`; resume Steps 0–2 | ancestor diff intersects recorded path → material | `ancestry=material` (`src/feature.txt`) | PASS |
| E2 | Re-pause after commit | pause again | new baseline records new HEAD | `base_commit=565ce1f…`; 3 rows | PASS |
| F | Clean resume + consume | resume Steps 0–5 | clean; position 1.2; `resumed` + history; delegate | clean; `resumed`; delegation recorded | PASS |
| G | Already resumed | resume again | reports consumed; no silent execution; no hash change | `already_resumed`; hashes unchanged | PASS |
| H | Non-git degradation | pause + resume validation without git | null git fields; hash present; unverifiable + ask | nulls; `unverifiable`; ask | PASS |
| I | Content-only drift (same paths) | edit already-dirty `src/feature.txt`; validate; edit `notes-wip.md`; validate | fingerprint mismatch → material; STOP | `d7b64f5c…` → `a945e5f5…` / `e7e53b0d…`; material | PASS |

## Key Evidence

### A — Clean pause

```
status: paused
plan_slug: demo-plan
phase_index: 1
subtask_index: "1.2"
progress: "1/4"
blocked: false
branch: master
base_commit: 8a6e3f23f11a5b824ad3371a90d4ae1d93b6c19a
worktree_dirty: true
worktree_fingerprint: d7b64f5c0c0dfa8ec012ed0f889c15143979345d7f4e41e8657b9d15b6f69d44
plan_sha256: 87acdbf2ef3a82c806adb7f42d56f67ac55cdf612f4078407c57c728e47f2e89
created: 2026-11-07T05:07:24Z
updated: 2026-11-07T05:07:24Z
```

After pause: HEAD unchanged, `plan.md` SHA-256 unchanged, commit count still 1,
no stash, and the only new path was `docs/plans/demo-plan/handoff.md`. All 11
sections present, 20 frontmatter keys, history contained one `paused` row.
Pre-pause status was ` M src/feature.txt` + `?? notes-wip.md`; the handoff
recorded both paths (and not `rc/feature.txt`). The handoff file itself was
excluded from the path list — it is the artifact, not in-flight work. The
original A run predates `worktree_fingerprint`; the value shown is the
equivalent scenario-I pause fingerprint for the same path set (paths + content).

### B — Re-pause

```
| 2026-11-07T05:07:24Z | paused    | Phase 1 / Sub-Task 1.2 | Initial pause before continuing. |
| 2026-11-07T05:09:57Z | re-paused | Phase 1 / Sub-Task 1.2 | Snapshot refreshed after re-pause. |
```

`created` stayed `2026-11-07T05:07:24Z`; `updated` advanced to
`2026-11-07T05:09:57Z`; the first row was preserved byte-for-byte.

### C — Plan-hash drift

Edited only Sub-Task 1.3 (`Pending` → `In Progress`), then ran resume Steps 0–2
without executing:

```
drift: branch=clean, ancestry=clean, worktree=explainable, conflicts=clean, plan_hash=material
plan_hash: 87acdbf2ef3a… -> 5670d5ace77c…
overall: material | action: STOP and ask: continue anyway, re-pause, or abort
handoff_status: paused
```

The handoff hash was unchanged by validation (read-only). `plan.md` was
restored by `cp` from a backup (not `git checkout`); SHA-256 returned to
`87acdbf2…`.

### D — Branch drift

```
branch=material | master -> other-branch
overall: material | action: STOP and ask: continue anyway, re-pause, or abort
handoff_status: paused
```

Switched back to `master` with `git switch master`.

### E — HEAD drift touching recorded work

Committed the recorded in-flight file (`src/feature.txt`), so
`base_commit 8a6e3f2` became an ancestor of HEAD `565ce1f`:

```
ancestry=material | commits touch recorded paths: src/feature.txt
overall: material | handoff_status: paused
```

Re-paused after the commit to establish a legitimate new baseline:

```
event: re-paused
base_commit: 565ce1f3aca1424396693d7caa12de9ee2aecef5
worktree_dirty: true
history: paused, re-paused, re-paused (3 rows)
```

Post-re-pause validation was fully clean: `branch=clean, ancestry=clean,
worktree=clean, conflicts=clean, plan_hash=clean`.

### F — Clean resume + consume

Pre-consume validation: contract valid, `overall: clean`, position
`Phase 1 / Sub-Task 1.2`, progress `1/4`.

```
status: resumed
resumed_at: 2026-11-07T05:14:50Z
updated: 2026-11-07T05:14:50Z
history: paused, re-paused, re-paused, resumed (4 rows)
delegation: Run `dh-execute-plan` in resume mode for docs/plans/demo-plan/plan.md (slug: demo-plan).
```

The plan hash and all plan statuses were unchanged; the consumed handoff still
had all 11 sections. The execution loop was **not** started in the scratch
repo — only the delegation instruction was recorded.

### G — Already resumed

```
consumed: true | already_resumed: true | status: resumed | delegation: null
```

Handoff and plan SHA-256 values were identical before and after.

### H — Non-git degradation

```
status: paused
branch: null
base_commit: null
worktree_dirty: null
worktree_fingerprint: null   # git unavailable: path set/content unknown
plan_sha256: 87acdbf2ef3a82c806adb7f42d56f67ac55cdf612f4078407c57c728e47f2e89
```

Resume validation: `branch=unverifiable, ancestry=unverifiable,
worktree=unverifiable, conflicts=unverifiable, plan_hash=clean`;
`overall: unverifiable`; `action: Ask for confirmation before proceeding`;
handoff remained `paused`. The body recorded `Git unavailable` and
`Unverifiable (no git)`.

### I — Content-only drift (same paths)

Recorded at pause: paths `src/feature.txt` + `notes-wip.md`,
`worktree_fingerprint: d7b64f5c…b6f69d44`. Editing `src/feature.txt` again
kept the path set but changed the content:

```
path_set_equal: true
fingerprint: d7b64f5c… -> a945e5f5…
plan_hash: clean
worktree: material (content fingerprint differs)
overall: material | action: STOP and ask | handoff: paused
```

Editing `notes-wip.md` next: same path set, fingerprint
`d7b64f5c… -> e7e53b0d…`, material, handoff `paused`. Restoring both files by
copy (no destructive git) returned the fingerprint to `d7b64f5c…` and validation to `clean`.

## Post-clarification Checks

Scratch `/tmp/dh-pause-clarify`: `git init`, tiny phased plan (1.1
`Completed`, 1.2 `In Progress`), clean base commit. A focused script applied
the clarified pause rules and inspected the written handoff.

**(a) Only the handoff untracked.** After pause: `worktree_dirty: false`;
`## Uncommitted Changes` = `None.`; the handoff is excluded from the path list.

**(b) `scratch.tmp` present (untracked).** Raw status: handoff + `scratch.tmp`;
both excluded; `listed_paths: []`; `worktree_dirty: false`; not listed in
`## Uncommitted Changes`.

**(c) Manual body edit, then re-pause.** Set `KEEP-COMPLETED-ENTRY`,
`KEEP-DECISION-ENTRY`, and `MANUAL IN-FLIGHT EDIT`. After re-pause: both KEEP
entries preserved, Work In Flight regenerated, history `paused, re-paused,
re-paused`, `created` preserved, `worktree_dirty: false`.

**(d) Untracked directory expansion.** `?? wip/` expanded to `wip/a.txt` +
`wip/b.txt`; fingerprint `1f750a17…`, changing `wip/a.txt` produced
`e759b9ef…` (differs).

## Resolved Ambiguities and Deviations

- **Snapshot prose after resume — resolved by** the `handoff-template.md`
  Status lifecycle and `## Snapshot` bullet plus `dh-resume-plan` Step 5:
  resume changes only `status`, `resumed_at`, `updated`, and the history row;
  the Snapshot remains the pause-point audit record.
- **Handoff path vs worktree dirt — resolved by** `dh-pause-plan` Step 2
  (worktree evidence) and Step 3 (Uncommitted Changes), plus the template
  `worktree_dirty` and `## Uncommitted Changes` bullets: exclude `handoff.md`
  and `*.tmp`; `worktree_dirty` reflects the remaining paths and is `false`
  when only the handoff is untracked.
- **Re-pause body refresh — resolved by** the `dh-pause-plan` Step 3 re-pause
  rule: regenerate Snapshot, Current Position, Work In Flight, Uncommitted
  Changes, Blockers and Risks, Validation State, and Next Steps; preserve
  `created`, history, and the Work Completed / Decisions entries unless they
  changed.
- **Drift check overlap — resolved by** `dh-resume-plan` Step 2 plan-hash
  precedence: a `plan_sha256` mismatch is material and overrides any worktree
  "explainable" classification for `plan.md`.
- **Content-only drift (P2) — resolved by** the additive `worktree_fingerprint`
  field (template, pause Step 2, resume Step 2): same paths + changed content is material.
- **Method (deviation note).** The steps were executed with a small local
  rehearsal helper (scratch only) that composed the handoff and evaluated the
  drift checks; the skills themselves were not invoked through an agent runner.
  An initial helper bug (porcelain leading-space trim) briefly recorded a
  truncated path; the scratch workspace was recreated from the base plan and
  all evidence above is from the corrected run. No production files or skills
  were changed.

## Cleanup

All scratch workspaces (`/tmp/dh-pause-rehearsal`,
`/tmp/dh-pause-rehearsal-nogit`, `/tmp/dh-pause-clarify`,
`/tmp/dh-pause-fingerprint`) were removed after capturing this evidence.

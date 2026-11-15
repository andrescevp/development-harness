# Execution Record contract

Every executed plan records where the work really happened. The authoritative
copy always lives at the workspace-root plan root (`docs/plans/<slug>/plan.md`);
a mirrored copy inside a nested repo/worktree is non-authoritative. A
package-local `docs/plans` directory is never created (workspace contract §3,
§7).

## Placement

- `## Execution Record` is a top-level section in `plan.md`, after
  `## Final Integration & Verification` and **outside** `## Phases`; the
  parser ignores it.
- Legacy plans without the section stay valid and parseable. It becomes
  mandatory once the plan is executed (T1).
- One record per plan: a re-execution or continuation updates the same record —
  never append a second one.

## Fields (all required once executed)

| Field | Content |
|---|---|
| `Execution status` | `In progress` \| `Completed` \| `Completed with deferrals` \| `Not executed` |
| `Executed at` | `YYYY-MM-DD` when the record was first written (T1); T3 may update it to the finalization date |
| `Workspace root` | Absolute path used for the run |
| `Repository kind` | `workspace` \| `nested project` \| `submodule` \| `worktree` |
| `Repository path` | Workspace-relative path that received the commits; `.` for the workspace root |
| `Branch / worktree` | Branch and worktree path when not the main checkout |
| `Commit range` | `<base>..<head>` (short SHAs; provisional at T1) |
| `Plan path` | `docs/plans/<slug>/plan.md` — the authoritative copy |
| `Mirrored plan path` | Optional non-authoritative copy; `none` when absent. Never created by the harness unless the user asks, and it must link back to the authoritative plan |
| `Summary` | 2–5 bullets: what shipped |
| `Architectural changes` | ADRs/contracts/interfaces created or changed, or `None` |
| `References` | Review, handoff, evolution note and ADR links |

Never record secrets, tokens, environment dumps, or full diffs. Paths inside the
workspace are workspace-relative; absolute paths only for outside artifacts,
marked as references.

## Plans index row (`docs/plans/index.md`)

The index keeps one `## Execution Records` table; append one row per executed
plan (never a second table, never a row in the plan-status table):

| Slug | Executed in (repo/path) | Plan path | Mirrored plan path | Summary | Architectural changes | Date |
|---|---|---|---|---|---|---|
| `<slug>` | `<repository kind>: <workspace-relative path>` | `docs/plans/<slug>/plan.md` | `none` or the copy path | 2–5 flattened bullets | `None` or the change | `YYYY-MM-DD` |

The row MUST point to the authoritative plan path; a mirrored copy is named in
addition, never instead. The `## Plans` table stays **last** so
`dh_plan_create`'s EOF append lands in it; the `## Execution Records` table
precedes it.

## Timing (mandatory order)

| When | What | Writer |
|---|---|---|
| **T1** — execution loop ends (all sub-tasks `Completed`), before final review | Write `## Execution Record` with every field; `Execution status: In progress` | `dh-execute-plan` / `dh-execute-plan-fast` |
| **T2** — `dh-final-review` sign-off | Verify T1 exists, is complete and consistent with the diff — blocking finding if not | `dh-final-review` |
| **T3** — after `Approve` / `Approve with comments`, before the plan is marked `Completed` | Set `Execution status` (`Completed` / `Completed with deferrals`), finalize `Commit range` and `Executed at`, add or update the index row | `dh-execute-plan` / `dh-execute-plan-fast` |
| **T4** — documentation close-out | Link the evolution note and the mirrored plan path | `dh-create-documentation` |
| **T5** — re-execution/continuation | Update the same record; never append a second | the executing skill |

A resumed plan keeps its first `Executed at` and records the final commit range.
A blocked plan keeps `Not executed` until sign-off exists. A missing or stale
record is a blocking finding, not a P3 note.

## Fast mode

`plan_fast.md` omits `## Execution Record` (it only mirrors `## Phases` and the
final verification). Writing or finalizing the record changes the `plan.md`
body, so after T1 **and after T3** recompute `source_sha256` and bump
`plan_version` in `plan_fast.md` before the next alignment/equality gate — the
documented record realignment, not a hash-mismatch stop. Never copy the record
into the mirror.

Normative source: [`workspace-contract.md`](../../../docs/plans/harness-monorepo-awareness/workspace-contract.md)
§3 and §7.

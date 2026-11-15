# Package scope — affected-package fingerprints in pause/resume

`dh-pause-plan` and `dh-resume-plan` treat unrelated workspace changes as
out-of-scope noise instead of drift. The scope comes from the plan, the paths
from the workspace map; a standalone repository keeps the repo-wide fallback.

## Scope source

| Input | Used for |
|---|---|
| `## Workspace Impact` in `plan.md` | Affected packages (declared, never inferred from the cwd) |
| `Shared paths` line in that section | Root/shared files the plan legitimately touches |
| `WORKSPACE.md`, else `docs/WORKSPACE.md` → `## Packages` | Package path for each name |
| `git status --porcelain=v1`, `git diff --stat` | Dirty paths to classify |

Read order: plan section → map → git. A workspace plan without
`## Workspace Impact` is a hard stop at pause: ask which packages are affected;
never fall back to "all packages" silently.

## Classification

| Path | Class | Effect on resume |
|---|---|---|
| Under an affected package path | **in scope** | Compared; a change is material |
| Listed in `Shared paths` or a root file the plan names | **in scope (shared)** | Compared; a change is material |
| Under an unaffected package | **out of scope** | Reported separately; never drift |
| Under no package and not shared | **unattributed** | Reported as a drift candidate; ask |

Never hide a dirty path that belongs to the plan; never promote an unrelated
package's dirt to drift.

## Package fingerprint

Fingerprint the affected scope with the same primitive as
`worktree_fingerprint`:

1. Path set: `git status --porcelain=v1 -- <affected paths and shared paths>`
   (expand untracked directories with `git ls-files --others
   --exclude-standard`), excluding `handoff.md` and `*.tmp` exactly as
   `worktree_fingerprint` does.
2. For each path, one line `status<TAB>path<TAB>content-hash`, where the hash is
   `git hash-object -- <path>`, or `DELETED` when the file is missing.
3. Sort the lines, join them with newlines, SHA-256 the block → lowercase
   64-hex.
4. Record one fingerprint per affected package (paths under it) plus one for the
   shared/root paths. `null` when git or a hashing tool is unavailable — mark it
   `unverifiable`, never clean.

For a submodule or gitlink path, `git hash-object` fails: record
`gitlink:<sha>` from `git ls-tree HEAD -- <path>` plus
`git -C <path> rev-parse HEAD` when the submodule is initialized; otherwise
record `SUBMODULE_UNVERIFIABLE` and require confirmation.

The repo-wide `worktree_fingerprint` stays as it is (compatibility); the package
fingerprints add scope, they do not replace it.

## Handoff field

Add an optional `## Package Scope` section to `handoff.md`. It is additive, so
`handoff_version` stays `1` and handoffs without it still validate:

```markdown
## Package Scope

- Scope source: `docs/plans/<slug>/plan.md` → `## Workspace Impact`
- Workspace map: `WORKSPACE.md` (present)
- Affected: `apps/web` (fingerprint `9f3c…`), shared `docs/` (fingerprint `1a2b…`)
- Out of scope (dirty, not drift): `services/api` (fingerprint `77de…`)
- Unattributed dirty paths: none
- Fallback: package scope available
```

Rules:

- An absent section (legacy handoff) means the repo-wide fallback; resume must
  not fail on it.
- `Out of scope` is informational: resume lists it and continues; it never
  lowers the plan's own dirty-file check.
- `Unattributed dirty paths` other than `none` require user confirmation before
  resuming.

## Resume comparison

1. Recompute the affected/shared fingerprints first; a difference is
   **material**, even when the repo-wide set and hash look explainable.
2. Recompute the out-of-scope fingerprints; a difference there is
   **explainable** — report "out-of-scope package changed", do not block.
3. Plan hash and branch/HEAD rules are unchanged and still material.
4. No `## Package Scope` section → today's repo-wide comparison, unchanged.

## Repo-wide fallback

**Standalone** (no map or markers): do not write `## Package Scope`; compare the
full recorded path set exactly as today. Never require a standalone repository
to add a map or a workspace impact section.

**Detected workspace with a plan missing `## Workspace Impact`:** hard stop at
pause (see Scope source). Do not silently fall back to the repo-wide comparison;
only legacy handoffs without the section use the repo-wide fallback, and resume
reports it as unverified scope.

## Validation checklist

- [ ] The affected packages came from the plan and their paths from the map.
- [ ] Every dirty path is classified as in scope, shared, out of scope, or
      unattributed.
- [ ] Affected and shared fingerprints use the documented line format and
      lowercase 64-hex (or `null` + unverifiable).
- [ ] Unrelated dirty packages are reported separately and not treated as
      drift.
- [ ] Dirty files that belong to the plan are never hidden.
- [ ] The section is additive: old handoffs still validate; no version bump.
- [ ] The repo-wide fallback was used when no map/impact existed.
- [ ] Standalone repositories kept the whole-worktree fingerprint.

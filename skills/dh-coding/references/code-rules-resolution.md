# CODE_RULES resolution

`dh-coding` enforces code rules and `dh-code-ruler` creates or refreshes them.
In a workspace, rules inherit: the root `CODE_RULES.md` holds the defaults and a
package's own `CODE_RULES.md` overrides them for files inside that package.
Standalone repositories keep exactly one file — the project-root
`CODE_RULES.md`.

## Precedence (explicit, never merged)

| File being written | Resolved rules | Why |
|---|---|---|
| `apps/web/src/cart.ts` with `apps/web/CODE_RULES.md` present | `apps/web/CODE_RULES.md` | The nearest package root owning the file wins |
| `apps/web/src/cart.ts` without a package file | root `CODE_RULES.md` | Package inherits the root defaults |
| `apps/web/docs/guide.md` | `apps/web/CODE_RULES.md` then root | Package docs are package-owned; root still applies to what the package file does not state |
| `docs/plans/<slug>/plan.md`, `AGENTS.md`, `README.md` | root `CODE_RULES.md` | Workspace-owned artifacts |
| `pnpm-workspace.yaml`, root `package.json`, `turbo.json`, `nx.json`, `go.work`, root `Cargo.toml` | root `CODE_RULES.md` | Workspace config is never package-owned |
| `packages/core/deep/nested/file.ts` where both `packages/core` and `packages/core/deep` are packages | `packages/core/deep/CODE_RULES.md` | Longest matching package prefix (deepest package root) wins |
| Any file, no map, no package file | root `CODE_RULES.md` | Standalone / single-root behavior |

Two files never merge into one synthetic rule set. The package file wins for its
files; the root file still applies everywhere else. A rule stated in both is
resolved by precedence, not averaged.

## Package-root discovery

1. Read `WORKSPACE.md` (or `docs/WORKSPACE.md`) at the workspace root and take
   the `Path` column of its `## Packages` table.
2. Match the target file against those paths and keep the **longest** prefix
   (deepest package) — this is the only path rule.
3. Read `{package}/CODE_RULES.md` when it exists; otherwise read the root
   `CODE_RULES.md`.
4. Map absent: walk upward from the file's directory to the workspace root and
   take the first `CODE_RULES.md` found (nearest wins). Do not walk above the
   workspace root.
5. No file anywhere: do not invent rules — invoke `dh-code-ruler` (root file,
   or the package file when the map declares package overrides) and then
   implement.

Never infer a package root from a directory name, a `package.json` alone, or the
shell cwd; the map (plus the declared `## Workspace Impact`) is the source of
truth.

## Reporting the resolved file

Every implementation report states what governed the change:

```markdown
**Rules:** `apps/web/CODE_RULES.md` (package) + root `CODE_RULES.md` defaults
**Precedence:** package file wins for `apps/web/**`; root applies elsewhere
```

Standalone reports one line: `**Rules:** CODE_RULES.md (project root)`.

## Conflicts

| Situation | Action |
|---|---|
| Package rule contradicts a root rule | Apply the package rule to package files; report the divergence (file + rule + line) and recommend aligning the root or the package |
| Root rule forbids something the package rule requires | Treat it as a conflict, not a silent override: report it and ask which wins before implementing |
| Two packages disagree | Not a conflict — each package file governs its own files |
| The code contradicts the resolved rules | Follow the rules; flag the code and propose a rules refresh via `dh-create-documentation` |

A conflict is reported once per rule pair, never resolved by merging sentences.

## Worked example

```text
/repo                          ← workspace root: CODE_RULES.md (defaults)
├── apps/web                   ← CODE_RULES.md (React: hooks order, no default exports)
└── services/api               ← no CODE_RULES.md (inherits the root file)
```

- Editing `apps/web/src/cart.ts` → `apps/web/CODE_RULES.md`; the root file still
  supplies anything the package file does not state. Report both, precedence
  explicit.
- Editing `services/api/app/orders.py` → root `CODE_RULES.md` only.
- Editing `docs/plans/checkout-flow/plan.md` → root `CODE_RULES.md`.
- `apps/web/CODE_RULES.md` says "no default exports" while the root says
  "follow the framework convention" → conflict reported; the package rule wins
  for `apps/web/**` and the root sentence is flagged for alignment.

Standalone: one root file, no package layer, no conflict table to apply.

## Validation checklist

- [ ] The target file's package was resolved from `WORKSPACE.md`, not from the
      cwd or the directory name.
- [ ] The resolved `CODE_RULES.md` path(s) are named in the implementation
      report.
- [ ] Package rules win for package files; root rules cover shared/root files
      and packages without their own file.
- [ ] No two rule files were merged silently; conflicts are reported with the
      rule pair.
- [ ] A missing rules file triggered `dh-code-ruler` instead of invented rules.
- [ ] Standalone repositories still resolve the single project-root file.

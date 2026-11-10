---
name: dh-domain-check
description: >
  Map tasks to DDD bounded contexts and validate SOLID as a pre-implementation gate; flag boundary violations, produce verdict. Use after planning, to validate architecture, check SOLID, or bounded context check.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write
metadata:
  audience: developers
  workflow: development
---

## Core Rules

- Read `./docs/plans/<plan-slug>/plan.md` (or current task scope) to understand what will change
- Read the project's `AGENTS.md` for architectural conventions if it exists
- In a workspace, read `WORKSPACE.md` (else `docs/WORKSPACE.md`) and map contexts
  from the package graph before any top-level directory heuristic
- Otherwise scan the project directory structure to identify bounded contexts by module/domain boundaries
- If the project has no explicit DDD structure, note it and skip bounded-context mapping — do not force-fit
- Check each SOLID principle; only flag violations with a plausible failure path
- Do not block progress on minor style preferences or naming disagreements
- Write output to `./docs/plans/<plan-slug>/tasks/domain-check.md`

## SOLID Validation Guide

For each planned change, check:

- **S**ingle Responsibility: Does each unit (class, module, sub-task) have exactly one reason to change?
- **O**pen/Closed: Are we extending behavior without modifying existing tested abstractions?
- **L**iskov Substitution: Would new types break substitutability with their base types?
- **I**nterface Segregation: Are we adding fat interfaces that force clients to depend on methods they don't use?
- **D**ependency Inversion: Are new dependencies on abstractions, not concretions?

## Graph-Assisted Boundary Discovery

When `dh-setup` indexed the project, use the `dh-code-query` skill to ground
the context map instead of relying only on directory names:

- `cgr graph importers` / `callers` to expose cross-module dependencies and
  actual usage edges.
- `cgr graph implementors` / `overrides` to test LSP/ISP claims.
- `cgr graph tests-reaching` to see which contexts have coverage at the
  boundary.

Verify every row in the source; fall back to the directory scan below when the
project is not indexed or the graph is stale.

## Bounded Context Discovery

In a workspace the **package graph** is the first source of bounded contexts;
use top-level directories only when no map exists:

1. Read `WORKSPACE.md` (else `docs/WORKSPACE.md`) → `## Packages` (paths,
   stacks, dependencies) and the root `AGENTS.md`.
2. Map each context to its package path(s); a package boundary is a context
   boundary unless the map or an ADR says otherwise.
3. Read the plan's `## Workspace Impact`; a change that reaches a package outside
   the affected list is a cross-context concern to flag.
4. Confirm cross-package dependencies with the code graph
   (`importers`/`callers`) before claiming a boundary violation.
5. Standalone (no map) or unindexed project — fall back to directory heuristics:
   - Look for top-level directories that represent distinct domains (e.g., `auth/`, `billing/`, `catalog/`)
   - Identify shared kernel modules used across contexts (e.g., `common/`, `shared/`, `lib/`)
   - Check for anti-corruption layers (translation between contexts)
   - Flag any sub-task that reads/writes across context boundaries without an explicit integration pattern

## Output Template

```markdown
# Domain & Architecture Check: [Task Title]

## Bounded Contexts Touched
| Context | Module(s) | Risk |
|---|---|---|
| [Name] | `path/to/module` | Low / Med / High |

## Cross-Context Concerns
- [Any boundary violations, integration risks, or missing anti-corruption layers]

## SOLID Compliance
| Principle | Sub-Task / Change | Status | Note |
|---|---|---|---|
| SRP | [change description] | ✅ / ⚠️ / ❌ | [brief explanation] |
| OCP | [change description] | ✅ / ⚠️ / ❌ | [brief explanation] |
| LSP | [change description] | ✅ / ⚠️ / ❌ | [brief explanation] |
| ISP | [change description] | ✅ / ⚠️ / ❌ | [brief explanation] |
| DIP | [change description] | ✅ / ⚠️ / ❌ | [brief explanation] |

## Verdict
Clear to proceed / Proceed with caution / Architecture concern (blocking)

## Blocking Issues (if any)
- [Only if ❌ flagged with concrete impact and remediation suggestion]
```

## Safety

- Do not modify any code files
- Write only to `./docs/plans/<plan-slug>/tasks/domain-check.md`
- If no plan exists, ask the user to run `/plan` first
- A "proceed with caution" verdict is not a failure — it means be aware of the noted risks

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).

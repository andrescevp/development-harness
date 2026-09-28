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
- Scan the project directory structure to identify bounded contexts by module/domain boundaries
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

## Bounded Context Discovery

To identify bounded contexts:
1. Look for top-level directories that represent distinct domains (e.g., `auth/`, `billing/`, `catalog/`)
2. Identify shared kernel modules used across contexts (e.g., `common/`, `shared/`, `lib/`)
3. Check for anti-corruption layers (translation between contexts)
4. Flag any sub-task that reads/writes across context boundaries without an explicit integration pattern

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

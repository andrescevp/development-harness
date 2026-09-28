---
name: dh-code-ruler
description: >
  Interview + code analysis to generate {project_root}/CODE_RULES.md (style
  guide, design patterns, security/performance constraints, stack best
  practices; websearch allowed). Executed by dh-software-architect;
  dh-coding runs it when absent. Use to create or refresh code rules.
license: MIT
compatibility: opencode
allowed-tools: read, write, edit, bash, glob, websearch
metadata:
  audience: developers
  workflow: design
---

# Code Ruler

Produce the project's strict rules contract at `{project_root}/CODE_RULES.md`
by grilling the user and analyzing the codebase. `dh-coding` enforces this
file; `dh-code-ruler` is executed by `dh-software-architect` (or invoked by
`dh-coding` when the file is missing).

## When to use

- `{project_root}/CODE_RULES.md` does not exist → create it (dh-coding step 2).
- The rules have drifted from the code or the stack changed → refresh it.
- The architect needs a precise rule contract before planning/implementation.

## Workflow

1. **Locate** `{project_root}/CODE_RULES.md`. If it exists and is fresh, offer
   a refresh instead of a rewrite; if it is missing, create mode.
2. **Grill (interview)** — ask ONLY what is missing, numbered and focused:
   - Stack & tooling: languages, frameworks, package manager, build/lint/test
     setup.
   - Style: formatting preferences, naming conventions, file/module layout,
     import rules, comments policy.
   - Patterns: patterns to enforce, patterns to forbid (anti-patterns),
     layering/bounded-context constraints.
   - Security-sensitive areas: auth, user data, uploads, secrets, external
     integrations, deployment/pipeline concerns.
   - Performance-sensitive paths: hot endpoints, large data operations,
     caching, concurrency, budgets.
   - Enforcement: which checks/linters must back each rule, and hard numbers
     (limits, thresholds).
3. **Analyze the code** before writing: sample representative modules, tests,
   configs, and docs. Extract de-facto conventions (naming, structure, import
   style, error handling, test patterns) and existing constraints from
   linter/formatter configs (biome/eslint, ruff, phpcs/phpstan...), `tsconfig`/
   `pyproject.toml`/`composer.json`, `AGENTS.md`, README, and `docs/`. Mark
   anything inferred as an assumption; never invent rules the codebase does
   not support.
4. **Research stack best practices** — websearch when needed and possible:
   official/community guides for the detected stack (e.g. JS/TS: biome +
   TypeScript conventions; Python: PEP 8/ruff; PHP: PSR-12/phpstan; Go:
   gofmt/effective go) and fold the relevant recommendations into the rules.
5. **Generate** `{project_root}/CODE_RULES.md` with the MANDATORY sections
   below. Keep it concise and enforceable (aim ≤ 200 lines; rules are backed
   by concrete checks or commands).
6. **Verify**: the file parses, each rule maps to a check where possible, and
   the configured QA gate (qa:check / lint / tests) still reflects the rules.

## CODE_RULES.md structure (mandatory)

```markdown
# CODE_RULES.md — <project>

> Source of truth for this project's coding rules (dh-code-ruler).
> `dh-coding` enforces this file; keep it updated via `dh-create-documentation`.

## Code Style Guide
- <naming, formatting, file layout, imports, comments, line limits (<300 code-only)>

## Design Patterns
- <patterns to enforce; patterns to forbid; layering/bounded-context rules>

## Security Constraints and Checks
- <constraints + the checks that enforce them (osv/semgrep/bandit, validation, secrets)>

## Performance Constraints and Checks
- <constraints + the checks/budgets that enforce them (N+1, pagination, caching, memory)>

## Best Practices for the Stack
- <stack-specific recommended practices, with sources when researched>
```

## Rules

- Never copy whole guideline documents: distill strict, project-specific
  rules backed by the interview, the code analysis, or the researched guide.
- Preserve user statements verbatim where they define constraints or scope.
- Every rule should be actionable: either a check/command exists to enforce
  it, or the rule names the review gate that validates it.
- If the user has no preference, derive the rule from observed code convention
  and mark it as inferred.

## Verification Checklist

- [ ] `{project_root}/CODE_RULES.md` exists with all 5 mandatory sections
- [ ] Rules traceable to interview answers, code analysis, or researched sources
- [ ] Enforcement mapped (commands/gates) per rule where possible
- [ ] No invented rules; assumptions marked
- [ ] Mirrors the project's actual configs (linters, toolchain, docs)

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to `@dh-documentor` — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
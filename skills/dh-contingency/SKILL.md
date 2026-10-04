---
name: dh-contingency
description: >
  Generate architectural alternatives (Plan A/B/C) with trade-off analysis before committing to a path: identify decision areas, rate risk and complexity, and recommend one plan. Use when multiple plausible approaches exist, to compare architecture options, or during planning. Output: ./docs/plans/<plan-slug>/contingency.md.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write
metadata:
  audience: developers
  workflow: development
---

Evaluate architectural decision points and produce a small set of concrete alternatives with explicit risk, complexity, and trade-offs. Executed by `@dh-software-architect`; invoked by `dh-planning` when more than one plausible approach exists, and consumed by `dh-artifact-check` for planned deployment paths.

**Output contract:** write the analysis to `./docs/plans/<plan-slug>/contingency.md` (create the plan directory when it does not exist yet).

## Core Rules

- Run the analysis only when multiple plausible approaches genuinely exist — do not manufacture alternatives for a single viable path.
- Identify the architectural decision areas first, then map each alternative against all of them.
- Keep each plan concrete: components, modules, data flow, integrations, and migration/deployment impact.
- Rate every plan on three axes: **Risk**, **Complexity** (S/M/L plus rough effort), and **Trade-offs** (gains vs sacrifices).
- Recommend exactly one plan and justify it against the requirements and constraints; read `./docs/plans/<plan-slug>/sdd.md` when it exists.
- Keep alternatives mutually exclusive and genuinely different — not variations of the same approach.
- Do not write implementation code, modify source files, or edit plan documents.
- Write only to `./docs/plans/<plan-slug>/contingency.md`.

## Method

1. Read the request, plus `./docs/plans/<plan-slug>/sdd.md` and `./docs/plans/<plan-slug>/plan.md` when they exist — extract constraints, acceptance criteria, and out-of-scope items every alternative must respect.
2. Survey existing project patterns, modules, and dependencies; delegate to `@dh-explorer` when the codebase is unfamiliar.
3. List the architectural decision areas where approaches diverge (data model and versioning, backend vs frontend responsibilities, integration boundaries, deployment topology, and similar).
4. Define 2–3 coherent plans. Each plan states how it resolves every decision area; label the strongest candidate as recommended.
5. Assess each plan: Risk (likelihood and impact), Complexity (size and rough effort), Trade-offs (what is gained, what is sacrificed).
6. Recommend one plan, naming the conditions under which an alternative becomes preferable.
7. Save the report using the output template below to `./docs/plans/<plan-slug>/contingency.md`.

## Output Template

```markdown
# Contingency Analysis: [Feature / Plan Title]

## Architectural Decision Areas
1. **[Area]** — [why multiple approaches exist]
2. **[Area]** — [why multiple approaches exist]

## Plan A: [Name] — Recommended
### Approach
1. [Concrete steps covering every decision area]
### Risk: Low / Medium / High
- [Main risks and failure modes]
### Complexity: S / M / L ([rough effort])
- [Work breakdown per area]
### Trade-offs
- **Gain:** [what improves]
- **Sacrifice:** [what is given up]

## Plan B: [Name]
### Approach
- [same shape as Plan A]
### Risk: Low / Medium / High
- [...]
### Complexity: S / M / L ([rough effort])
- [...]
### Trade-offs
- **Gain:** [...]
- **Sacrifice:** [...]

## Plan C: [Name]
### Approach
- [same shape as Plan A]
### Risk: Low / Medium / High
- [...]
### Complexity: S / M / L ([rough effort])
- [...]
### Trade-offs
- **Gain:** [...]
- **Sacrifice:** [...]

## Recommendation
**Proceed with Plan A** — [rationale tied to requirements and constraints].
Adopt Plan B only if [condition]; adopt Plan C only if [condition].
```

## Safety

- Never present an alternative without naming its risks and failure modes.
- Never recommend an approach that violates requirements or skips validation.
- Do not expose secrets, credentials, or tokens in the analysis.
- If only one approach is viable, state that explicitly and skip the comparison instead of forcing alternatives.

## Final Check

- Every decision area is covered by every plan.
- Risk, complexity, and trade-offs are present for each plan.
- The recommendation names the winning plan and the conditions that would change it.
- The report is saved at `./docs/plans/<plan-slug>/contingency.md`.

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to `@dh-documentor` — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).

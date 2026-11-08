# Agent Selection Protocol (authoritative)

Every harness skill that delegates work resolves a **capability** to an
**agent** instead of naming a fixed agent. The chosen agent is recorded in the
plan's `## Agent Selection` table so the run is inspectable, reviewable, and
repeatable.

Use this protocol whenever a skill says "delegate to the architecture agent",
"use an implementation agent", "run the review", "hand off documentation", or
similar. Skills describe the role and capability; this protocol resolves it
against the current environment.

## 1. Discovery

Enumerate agents in this order:

1. **Runtime agent list** — the subagent/agent list the current runtime exposes
   (subagent tool catalog, agent list command, or equivalent). This is the
   authoritative availability source.
2. **Project configuration** — `opencode.jsonc` / `opencode.json` agent blocks
   and project agent directories such as `.opencode/agents/` (plus runtime
   equivalents such as `.claude/agents/` when present).
3. **Global agent definitions** — user-level agent directories and runtime
   configuration outside the project.

If enumeration is unavailable, state the limitation in the selection record
(for example: "Discovery: runtime list unavailable; used project config and
exposed subagents") and select only from agents the runtime actually exposes.
Never assume an agent exists because a previous run or another machine had it.

## 2. Capability roles

Select with stable role names; reuse the same names in the plan table.

| Role | Capability to match |
|---|---|
| Architecture / design | architectural patterns, DDD, boundaries, trade-offs |
| Implementation / engineering | code changes, refactors, debugging, tests |
| Testing / QA | test strategy, language- or framework-specific guidance |
| Review | scoped correctness/security review of changed code |
| Final review | plan-wide sign-off against requirements and gates |
| Documentation | docs, guides, README, API references |
| Domain specialist | project or domain expertise the plan explicitly needs |

Select only the roles the plan actually delegates. Unused roles stay out of the
table.

## 3. Ranking

Rank candidates by evidence, strongest first:

1. **Project-specific agent with matching domain instructions** — scoped to
   this project and its description/project instructions match the role.
2. **Specialized project agent** — project-scoped and capable, but without
   domain-specific instructions.
3. **Bundled harness capability fallback** — an agent the runtime exposes that
   covers the capability without project-specific instructions.

Use the agent's description, project instructions (`AGENTS.md`, configuration,
agent files), declared tools/permissions, and domain vocabulary as evidence.
A familiar **name is supporting evidence only**, never the sole criterion:
"engineer" in a name does not prove implementation capability, and an
unfamiliar name does not disqualify an agent whose description matches.

Record the winning evidence in the `Why` column.

## 4. Tie handling

- Prefer the more specific match: narrower scope, closer domain, explicit
  project instructions.
- If still tied, ask the user which agent to use, then record the decision and
  its reason. Do not break the tie silently.
- If the user is unavailable, stop and report the tie instead of guessing.

## 5. Fallback

If no project-specific agent fits, use the bundled harness agent that exposes
the capability. The fallback is whatever the environment exposes with the
matching capability — skills describe it generically ("bundled architecture
capability", "bundled review capability") and never hardcode bundled agent IDs.

A fallback still has to pass discovery in the current runtime. If the fallback
is absent too, go to **Failure behavior**.

## 6. Recording

Record one row per delegated role in the plan's `## Agent Selection` section,
before `## Phases`:

```markdown
## Agent Selection

| Role | Selected agent | Why | Fallback |
|---|---|---|---|
| Architecture | billing-architect | Project agent; description names DDD and billing bounds. | bundled architecture capability |
| Documentation | docs-writer | Project agent; owns the project docs vault. | bundled documentation capability |
```

Rules:

- `Selected agent` is the exact runtime identifier discovered in step 1.
- `Fallback` names the capability, not a specific agent ID.
- Keep the table in `plan.md`; the fast mirror intentionally omits it.
- When no delegation is needed, write `None — no specialized agent required`
  under the heading instead of an empty table.
- If discovery was limited, add a one-line note under the table.

## 7. Re-validation before execution

Before execution starts — and again on resume — verify every agent named in
`## Agent Selection` still exists in the current runtime:

- **Present:** proceed with the recorded choice.
- **Missing, renamed, or disabled:** re-run discovery and ranking for that
  role, update the row with the new agent and `Why`, and tell the user. If the
  replacement changes what the plan assumed (scope, acceptance criteria,
  permissions), ask before continuing.
- **Table absent or stale:** run the full protocol again before delegating.

Never silently substitute an agent and never keep executing against a missing
one.

## 8. Failure behavior

Stop and report the gap when:

- no project-specific agent and no bundled capability covers the role;
- a plan names an agent that is unavailable and no capability-equivalent
  substitute exists;
- enumeration is impossible and the runtime's exposed list does not cover the
  role;
- a tie cannot be resolved with the available evidence and the user cannot
  decide.

Report the role, the candidates considered, and the missing capability. Never
invent an agent, never approximate one from a name, and never silently degrade
to "no delegation" when the plan requires a delegated result.

## Decision flow

1. Identify the capability role for the delegated step.
2. Discover agents: runtime list → project config/directories → global
   definitions.
3. Filter to candidates whose description/instructions match the role.
4. Rank: project + domain > specialized project > bundled fallback.
5. Tie → prefer specificity; still tied → ask the user and record it.
6. No candidate → stop and report the missing capability (never invent one).
7. Record the row in `## Agent Selection`.
8. Re-validate presence before execution; update and ask on contract impact.

## Worked record

A plan with project agents for architecture, implementation, and documentation,
and no project-scoped reviewer:

| Role | Selected agent | Why | Fallback |
|---|---|---|---|
| Architecture | billing-architect | Project agent; description names DDD and the billing bounded context. | bundled architecture capability |
| Implementation | backend-engineer | Project agent; PHP/Symfony instructions match the repository. | bundled implementation capability |
| Review | bundled review capability | No project-scoped reviewer; the runtime exposes a review-capable agent whose description matches scoped code review. | bundled review capability |
| Documentation | docs-writer | Project agent; owns the project docs vault. | bundled documentation capability |

---
title: "Contingency Analysis: Agent Selection and Utility Skills"
slug: agent-selection-utility-skills
description: Compare a shared selection protocol, a dedicated selector tool/skill, and hardcoded fallback overrides.
tags: [contingency, plan, harness, agents]
project: dev-harness-skills
created: 2026-11-08
updated: 2026-11-08
---

# Contingency Analysis: Agent Selection and Utility Skills

## Architectural Decision Areas

1. **Agent discovery** — runtime agent list, project config/agent directories,
   or a new registry tool.
2. **Selection policy ownership** — a shared reference, a dedicated
   selector skill, or per-skill inline rules.
3. **Recording the choice** — plan `## Agent Selection` section, per-sub-task
   fields, or ephemeral runtime logs.
4. **Utility migration** — convert executor/explorer to skills, keep them as
   agents with skill wrappers, or keep them as agents only.
5. **Compatibility** — hard cut, aliases, or a deprecation window.

## Plan A: Shared Selection Reference + Plan Table — Recommended

### Approach

1. Add `skills/dh-planning/references/agent-selection.md` with discovery,
   capability classification, preference rules, fallback rules, and a
   `## Agent Selection` table template.
2. `dh-planning` inspects the runtime/config agent list, selects the best
   agent per role, and records choices/rationale/fallback in the plan.
3. Execution/review/final-review/docs skills read that table; if absent, they
   run the protocol at runtime and record the choice.
4. Convert executor/explorer to `dh-execute-cli`/`dh-explore` skills; delete
   their agent files and replace `@` references with skill invocations.
5. Update inventory 5 agents / 24 skills, tests, docs, and reports.

### Risk: Medium

- Selection depends on the host exposing agents; config/directory fallback
  mitigates.
- Plan tables can become stale; execution re-validates availability.
- Two-agent-to-skill migration changes counts and references across the repo.

### Complexity: M (about 3–4 implementation passes)

- Reference and template, utility skills, repo-wide reference cleanup,
  inventory/tests/docs, validation.

### Trade-offs

- **Gain:** project-specific agents are usable; no hardcoded agent IDs;
  choices are reviewable in the plan; utility roles fit the skill model.
- **Sacrifice:** selection adds planning overhead; execution is less
  deterministic unless the plan table is authoritative; host enumeration
  varies.

## Plan B: Dedicated Agent-Selection Skill or MCP Tool

### Approach

1. Add a `dh-select-agent` skill or an MCP `agents_list`/`select_agent` tool
   that queries the runtime registry and returns ranked candidates.
2. All skills call the selector instead of embedding the protocol.
3. Record the selected agent in the plan or task context.
4. Still migrate executor/explorer to skills.

### Risk: Medium-High

- A new tool/skill must be supported by every host; MCP cannot enumerate
  OpenCode agents portably.
- Adds inventory and API surface for a capability already available through
  the runtime agent list.

### Complexity: M–L

- New tool/skill, tests, host compatibility, docs, and fallback behavior.

### Trade-offs

- **Gain:** centralized, testable selection logic; consistent ranking.
- **Sacrifice:** new API surface and host dependency; more moving parts than a
  reference-based protocol.

## Plan C: Keep Hardcoded Agents with Project Overrides

### Approach

1. Keep `@dh-*` delegation in skills.
2. Add optional plan/config fields that override the agent per role.
3. Keep executor/explorer as agents with skill wrappers.
4. Update docs to describe overrides.

### Risk: Low–Medium

- Does not satisfy the requirement to remove hardcoded references.
- Overrides can drift from the actual runtime agent list.
- Utility agents remain registry entries.

### Complexity: S–M

- Override schema, docs, and a few skills.

### Trade-offs

- **Gain:** minimal disruption; deterministic defaults.
- **Sacrifice:** project-specific agents remain second-class; hardcoded IDs
  persist; does not meet the request.

## Recommendation

**Proceed with Plan A.** It removes hardcoded agent IDs, makes project-specific
agents first-class through a discoverable protocol, records choices in the plan
for auditability, and converts the two utility roles to skills without adding a
new host-dependent API.

Adopt Plan B only if hosts can expose a reliable agent registry and ranking
must be enforced centrally. Adopt Plan C only if removing hardcoded references
is explicitly waived.

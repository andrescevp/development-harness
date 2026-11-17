---
title: "Research Index"
slug: research-index
description: "Newest-first workspace registry of research notes: one row per note, with the question, confidence, and plan that used it."
tags: [research, index]
project: "dev-harness-skills"
created: 2026-11-16
updated: 2026-11-17
stack: "Markdown skills + TypeScript inventory/test tooling"
feature: "Web Research Agent and Skill"
epic: "Research capability"
status: active
---

# Research Index

## Overview

The single workspace registry for research notes — newest first, one row per
note, and each row links its note. Notes are evidence artifacts owned by the
documentation agent (`dh-documentor` via `dh-create-documentation`): the
researcher composes the note payload and the proposed row, and the
documentation agent persists both.

| Date | Topic | Question | Confidence | Used by | Note |
|---|---|---|---|---|---|
| 2026-11-17 | security-auditor-standards-2026 | Which authoritative standards, frameworks and testing guides should define an enterprise security auditor for web, API, desktop, mobile and agentic/MCP systems as of November 2026, with exact versions and URLs? | verified | plan: security-auditor | [security-auditor-standards-2026](./security-auditor-standards-2026.md) |
| 2026-11-17 | security-probing-tooling-2026 | Which non-destructive security testing tools and frameworks are appropriate in 2026 for authorized web, API, desktop, mobile and agentic/MCP assessments? | partially verified | plan: security-auditor | [security-probing-tooling-2026](./security-probing-tooling-2026.md) |

## Where Notes Live

- Notes live at `docs/research/<topic>.md`, one question per file; this index
  is the only registry.
- Plans link a note from their `## Research` section with
  `../../research/<topic>.md`.
- Plan-local research folders are not used: no note lives under
  `docs/plans/<slug>/research/`.

## Related

- [dh-research](../../skills/dh-research/SKILL.md) — workflow, note template,
  and registry rules.

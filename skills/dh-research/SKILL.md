---
name: dh-research
description: >
  Run a bounded, source-cited web research pass and record it as a
  research note: question, sources with retrieval dates, findings, and
  confidence. Use when planning needs current ecosystem facts (versions,
  EOL, API changes, comparisons) or when a hard blocker (loop step 2.4)
  gets one external evidence attempt before halting. Output:
  ./docs/plans/<plan-slug>/research/<topic>.md (or ./docs/research/<topic>.md
  outside a plan).
license: MIT
compatibility: opencode
allowed-tools: read, write, webfetch, websearch
metadata:
  audience: developers
  workflow: development
---

Answer one question about the outside world with verifiable evidence, then stop. The skill is executed by `@dh-researcher`; planning skills (`dh-planning`, `dh-contingency`, `dh-grill-sdd`), implementation (`dh-execute-plan-task` → bolted onto the 2.4 blocker rule), and review skills delegate to it. `dh-setup` may audit for a search-capable MCP but never runs this skill.

## Core Rules

- One skill run = one question. Re-ask the requester if the question is ambiguous instead of researching a guess.
- Primary sources first: official docs, changelogs, release notes, RFCs, vendor advisories, project repositories. Secondary sources lead the way in but do not carry conclusions alone.
- Every finding carries a claim, a source URL, and a retrieval date. No source, no finding — mark it model knowledge or drop it.
- State tool availability honestly: if `webfetch` and no search MCP exist, fetch known URLs; if nothing is available, the run fails without an answer — never fabricate.
- Bounded: a blocker research attempt is ONE pass. If the evidence does not resolve the blocker, report and let the loop halt for user guidance.

## Workflow

1. Frame: write the question, the caller, and the decision it feeds into the note header.
2. Plan queries: list the 2–5 searches most likely to answer it (spaces not dashes for search engines, version pins in queries).
3. Search and fetch: use `webfetch` and any configured search-capable MCP; batch independent fetches.
4. Verify: prefer primary sources to confirm each claim; note conflicts between sources instead of hiding them.
5. Record: write the research note (template below).
6. Report back: direct answer first, top findings with citations, confidence, path to the note.

## Output Template

```markdown
# Research: [topic]

- **Question:** [the one research question]
- **Caller:** [agent/skill]
- **Date:** [YYYY-MM-DD]
- **Tools used:** [webfetch | search MCP name | none available]

## Findings

| # | Claim | Source (URL + retrieval date) | Confidence |
|---|---|---|---|
| 1 | [claim] | https://… (2026-10-18) | verified / partially verified / model knowledge |

## Implications

- [What this changes for the plan, sub-task, or blocker decision]

## Sources

- [URL list with dates]
```

Notes live next to their plan (`docs/plans/<slug>/research/`) so planning artifacts stay self-contained; without a plan, they land in `docs/research/`.

## Blocker Integration (loop step 2.4)

When a hard blocker is reached, the loop may delegate ONE research attempt
with the blocker reason as the question (known issue? changelog entry?
migration guide?). Findings go into the note and return to the caller; the
loop still halts and asks the user for guidance, or resumes — both driven by
the researched evidence, not by guess-work.

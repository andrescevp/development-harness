# Evolution & Observation Notes

Custom directive for `dh-create-documentation`: after a plan completes, a
release ships, an architecture change lands, or a session produces reusable
learnings, write BOTH an **evolution note** and an **observation note**, then
register them in the evolution index. This replaces the external `evolve` and
`state-sync` workflow for plan close-out.

## Location and naming

All notes live under `{project_root}/docs` — never under `docs/plans/`:

```
{project_root}/docs/evolution/
  index.md
  <YYYY-MM-DD>-<slug>.md                    # evolution notes
  observations/
    <YYYY-MM-DD>-<HHMM>-<slug>.md           # observation notes
```

- `<slug>` is lowercase, hyphenated, and descriptive (`auth-token-rotation`).
- `<HHMM>` is 24-hour local time; it keeps same-day observations unique.
- `docs/evolve/` is **historical**: never migrate, delete, or rewrite it. New
  notes go to `docs/evolution/`.
- Never write notes (or edit statuses) under `docs/plans/` — plan files belong
  to the planning skills.

## Evolution note

Records **how the software evolved**: what changed, why, the architecture and
modules touched, how it was validated/released, and what remains.

Template (`{project_root}/docs/evolution/<YYYY-MM-DD>-<slug>.md`):

```markdown
---
title: "Auth token rotation"
kind: evolution
id: evo-20261108-auth-token-rotation
date: 2026-11-08
project: "my-app"
stack: "TypeScript / Node 24"
plan: "auth-token-rotation"
version: "1.4.0"         # released version/tag; null when unreleased
tags: [evolution, topic/auth]
feature: "Auth token rotation"
epic: "Auth hardening"
created: 2026-11-08
updated: 2026-11-08
---

# Evolution: Auth token rotation

## Overview

One paragraph: what shipped and the user or operational impact.

## What Changed

- Key behavior, API, schema, config, or dependency changes.
- Link commit ranges, PRs, or plan sub-tasks instead of pasting diffs.

## Decisions and Rationale

- Decision — why it was chosen — alternatives rejected.

## Architecture and Modules

- Affected bounded contexts, modules, and data flows.
- Add a mermaid diagram when the change alters a flow.

## Validation and Release

- Tests, QA gate, preflight, artifact check, rehearsal, and release evidence
  actually observed.
- Version/tag and deploy notes when applicable.

## Follow-ups

- Deferred work, known risks, and who owns the next step.

## Related

- Plan: [auth-token-rotation](../plans/auth-token-rotation/plan.md)
- Observation: [2026-11-08-1430-auth-token-rotation](./observations/2026-11-08-1430-auth-token-rotation.md)
- Release: [v1.4.0](https://example.com/releases/v1.4.0)
```

Rules:

- Every evolution note starts with `# Evolution: <title>` and carries the
  standard document frontmatter (`title`, `tags`, `project`, `created`,
  `updated`, `stack`, `feature`, `epic`) plus an `## Overview` section.
- `id` is `evo-<YYYYMMDD>-<slug>` and matches the filename date/slug.
- `tags` start with `evolution`, then `topic/<topic>` entries.
- `version` is a quoted string or `null` — never a bare number.
- `plan` holds the plan slug; use `null` when no plan applies.
- Link the plan, the matching observation note, and the release/tag when they
  exist.
- Record only validation that was **observed**; never claim checks that did
  not run.
- No secrets, credentials, tokens, full diffs, or full file contents.

## Observation note

Records **session learnings**: what worked, what didn't, decisions, and
follow-ups — not a transcript dump.

Template
(`{project_root}/docs/evolution/observations/<YYYY-MM-DD>-<HHMM>-<slug>.md`):

```markdown
---
title: "Auth token rotation — session learnings"
kind: observation
id: obs-20261108-1430-auth-token-rotation
date: 2026-11-08
agent: "dh-software-engineer"
project: "my-app"
stack: "TypeScript / Node 24"
plan: "auth-token-rotation"
tags: [observation, topic/auth]
feature: "Auth token rotation"
epic: "Auth hardening"
created: 2026-11-08
updated: 2026-11-08
confidence: 0.7          # optional, between 0.3 and 0.9
---

# Observation: Auth token rotation — session learnings

## Overview

Session scope, plan slug, and the conditions that shaped the work.

## What Worked

- Concrete practices, tools, or patterns, each with evidence (command, test,
  or review result).

## What Didn't

- Friction, failed approaches, and root causes. Describe behavior, not people.

## Decisions

- Decisions made mid-session and their rationale; link the evolution note for
  shipped outcomes.

## Follow-ups

- Actions for the next session or plan, with enough context to act without
  this transcript.

## Related

- Plan: [auth-token-rotation](../../plans/auth-token-rotation/plan.md)
- Evolution: [2026-11-08-auth-token-rotation](../2026-11-08-auth-token-rotation.md)
```

Rules:

- Keep the standard document frontmatter (`title`, `tags`, `project`, `created`, `updated`, `stack`, `feature`, `epic`) in addition to the observation-specific fields; start with `# Observation: <title>` and include an `## Overview` section.
- `id` is `obs-<YYYYMMDD>-<HHMM>-<slug>` and matches the filename.
- `agent` names the agent or role that produced the learning.
- `confidence` is optional and must be between `0.3` and `0.9`.
- Sanitize secrets and personal data; summarize evidence instead of pasting
  logs.
- Cite concrete evidence; avoid blame, speculation, and transcript dumps.
- Link the plan and the matching evolution note.

## Evolution index

`{project_root}/docs/evolution/index.md` lists every note, newest first:

```markdown
---
title: "Evolution Index"
tags: [evolution, index]
project: "my-app"
created: 2026-11-08
updated: 2026-11-08
stack: "TypeScript / Node 24"
feature: "Auth token rotation"
epic: "Auth hardening"
---

# Evolution Index

## Overview

Newest-first register of evolution and observation notes for this project.

| Date | Type | Title | Plan/Release | Link |
|---|---|---|---|---|
| 2026-11-08 | evolution | Auth token rotation | plan: auth-token-rotation / v1.4.0 | [evo-20261108-auth-token-rotation](./2026-11-08-auth-token-rotation.md) |
| 2026-11-08 | observation | Auth token rotation — session learnings | plan: auth-token-rotation | [obs-20261108-1430-auth-token-rotation](./observations/2026-11-08-1430-auth-token-rotation.md) |
```

- The index carries the standard document frontmatter (`title`, `tags`,
  `project`, `created`, `updated`, `stack`, `feature`, `epic`), starts with
  `# Evolution Index`, and has an `## Overview` section.
- One row per note; insert new rows at the top (newest first).
- `Type` is `evolution` or `observation`.
- `Plan/Release` names the plan slug and/or the version/tag.
- Every `Link` target must resolve relative to the index file.

## Workflow

1. **Collect evidence** — read the plan, final review, preflight/QA output,
   artifact-check or rehearsal results, and `git log`/tags for the plan. Use
   only what was observed.
2. **Write the evolution note** —
   `{project_root}/docs/evolution/<YYYY-MM-DD>-<slug>.md` from the template
   (create the directory if missing); fill every section, writing `None` only
   where a section genuinely has no content.
3. **Write the observation note** —
   `{project_root}/docs/evolution/observations/<YYYY-MM-DD>-<HHMM>-<slug>.md`
   from the template; capture learnings, not a transcript.
4. **Update the index** — prepend one row per note to
   `{project_root}/docs/evolution/index.md` (newest first).
5. **Cross-link** — plan ↔ evolution note ↔ observation note; add the release
   tag/URL when one exists; refresh `updated`.
6. **Verify** — run the checklist below before reporting completion.

## Verification checklist

- [ ] Evolution note exists at
      `{project_root}/docs/evolution/<YYYY-MM-DD>-<slug>.md` with
      `kind: evolution`, the standard frontmatter, an `# Evolution: <title>`
      H1, and an `## Overview` section.
- [ ] Observation note exists at
      `{project_root}/docs/evolution/observations/<YYYY-MM-DD>-<HHMM>-<slug>.md`
      with `kind: observation`, the standard frontmatter, the observation
      fields, an `# Observation: <title>` H1, and an `## Overview` section;
      optional `confidence` stays within 0.3–0.9.
- [ ] `index.md` has the standard frontmatter, an `# Evolution Index` H1, an
      `## Overview` section, and one newest-first row per note.
- [ ] All links resolve (plan, release, cross-note, index rows).
- [ ] No secrets, credentials, tokens, full diffs, or full file contents.
- [ ] `docs/evolve/` is untouched (historical record).
- [ ] `docs/plans/` is untouched (no plan or status edits from this
      directive).

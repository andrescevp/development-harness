---
name: dh-explore
description: >
  Explore codebases quickly using glob, grep, and targeted reads, and return
  compact evidence with exact file references. Use for codebase exploration,
  file search, pattern discovery, dependency mapping, or answering questions
  about where code lives — with the smallest search that can answer it.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, glob, grep
metadata:
  audience: developers
  workflow: development
---

Gather enough evidence to answer accurately while minimizing time, tokens, and
unnecessary file access.

## Core Rules

- Start with the smallest search that can answer the question.
- Prefer `glob`, `grep`, and targeted `read` calls over broad scans.
- Batch independent searches and reads when possible.
- Read only the specific files and sections needed to confirm the answer.
- Ignore noisy or generated directories such as `node_modules`, `dist`,
  `build`, `.git`, and cache/output folders unless the caller explicitly asks
  about them.
- Stop exploring once the answer is supported by concrete evidence.

## Search Order

1. **Locate** — use `glob` to find candidate files by name or extension.
2. **Narrow** — use `grep` to find the relevant symbols, strings, or patterns
   inside those candidates (constrain with `include`/`glob` filters when
   available).
3. **Confirm** — open only the matching files and the sections that prove the
   answer with targeted `read` calls (offset/limit for large files).

Escalate to broader scans only when the narrow search returns no usable
evidence, and say why the broader scope is needed.

## Efficiency Rules

- Do not read entire large files unless the answer depends on full-file
  context.
- Do not scan unrelated directories just to be thorough.
- Reuse previously gathered evidence instead of repeating searches.
- Summarize findings clearly with exact file references (path and line when
  available).
- Separate confirmed facts from inferences; never present a guess as evidence.

## Safety Rules

- Respect least privilege at all times.
- Do not attempt to read secrets, credentials, or sensitive config outside the
  allowed workspace; never echo secret values.
- Do not edit files, run destructive commands, or use network access unless
  explicitly required.
- If the requested scope is unclear, ask for the minimum clarification needed.

## Output Format

- Lead with the direct answer.
- Follow with the evidence: exact file paths and line references.
- Keep the summary compact — no full-file dumps, no irrelevant matches.
- List open questions or missing evidence explicitly when the answer is
  incomplete.

## When to Use

- A caller asks where something lives, how a flow works, or which files are
  involved.
- Planning or implementation needs codebase context before acting.
- A search must distinguish the relevant code from generated or vendored
  noise.

## When Not to Use

- Running commands, tests, builds, or validation — use `dh-execute-cli`.
- Editing or fixing code — use the implementation workflow.
- Reviewing a change — use `dh-code-review` / `dh-review`.

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to the best available documentation agent (bundled documentation capability as fallback) — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).

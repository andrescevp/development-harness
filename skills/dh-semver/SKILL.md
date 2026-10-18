---
name: dh-semver
description: >
  Apply strict Semantic Versioning — analyze commits since the last tag to
  determine the bump type (major/minor/patch from conventional commit
  prefixes), generate an automated changelog grouped by breaking changes,
  features, fixes, and chores, and create a git tag locally without pushing
  until confirmed, handling both conventional commits and manual version
  decisions. Use when preparing a release, invoked by dh-execute-plan after
  plan completion and dh-final-review for release readiness, or when the
  user asks "what version is next?", "bump version", "generate changelog",
  "tag release", or "what changed since last release?".
license: MIT
compatibility: opencode
allowed-tools: bash, read
metadata:
  audience: developers
  workflow: development
---

Harness-localized adaptation of the global `semver` skill. The versioning
algorithm is identical; the harness adaptations are that every git command
runs through the `@dh-executor` subagent, and this skill is invoked from the
bundled loop skills or a direct user request — the harness bundles no
commands.

## Core Rules

- Find the last tag: `git describe --tags --abbrev=0`. If that fails because
  the repo has no tags yet, default to `v0.0.0`.
- Collect the commits since that tag: `git log <tag>..HEAD --oneline`.
- Map commit messages to the bump type using conventional commit prefixes:
  - `BREAKING CHANGE:` in the message body, or `!` after the type
    (`feat!:`), → **MAJOR** bump
  - `feat:` or `feat(scope):` → **MINOR** bump
  - `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`,
    `ci:`, `build:` → **PATCH** bump
- If no conventional commit format is detected, prompt the user for the
  bump type — never guess.
- Generate the changelog grouped by Breaking Changes (if any), Features,
  Fixes, and Chores & Maintenance; every entry keeps its short commit hash.
- Create the tag locally:
  `git tag -a v<major>.<minor>.<patch> -m "Release v<major>.<minor>.<patch>"`.
- Do NOT push the tag — the user confirms before pushing.
- Run ALL git commands through the `@dh-executor` subagent — never run bash
  directly from the agent applying this skill.

## Edge Cases

- No commits since the last tag → report
  "No changes — no version bump needed" and stop.
- No tags in the repo → treat `v0.0.0` as the current version, but note it
  is not a real ref to diff against — enumerate ALL commits with
  `git log --oneline` to determine the first release.
- History without conventional commit prefixes → ask the user which bump
  applies; do not infer a bump from vague messages.

## Harness Invocation Sources

The harness bundles no commands, so there is no release command step to
import. This skill runs when:

- `dh-execute-plan` finishes a plan on a software project and needs the next
  version bump.
- `dh-final-review` checks release readiness and reports the recommended
  bump.
- The user asks directly: "what version is next?", "bump version",
  "generate changelog", "tag release", or "what changed since last release?".

## Output Template

```markdown
# Version Decision

**Current:** vX.Y.Z (tag: <tagname>)
**Bump:** MAJOR / MINOR / PATCH → **vX.Y.Z**
**Reason:** [N breaking changes, N features, N fixes]

# Changelog vX.Y.Z

## Breaking Changes
- [Description] (<commit-short-hash>)

## Features
- [Description] (<commit-short-hash>)

## Fixes
- [Description] (<commit-short-hash>)

## Chores & Maintenance
- [Description] (<commit-short-hash>)

**Tag:** `vX.Y.Z` (created locally — awaiting confirmation to push)
```

## Safety

- Do not push tags or commits without explicit user confirmation.
- Do not delete or modify existing tags.
- Create the tag only after the version decision and changelog are reported;
  the tag stays local until the user confirms pushing.
- Report the decision with its git evidence (last tag, commit counts, short
  hashes) exactly as `@dh-executor` returns it — no guessing.

## References

- `dh-execute-plan` and `dh-final-review` skills: the bundled loop steps
  that invoke this skill.
- `AGENTS.md` versioning note: tags are semver on `main` only.

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of generated documents (excluding docs/plans) to `@dh-documentor` — the main and only documentation owner (see dh-create-documentation).

Search generated documentation quickly: `notesmd-cli search-content "<term>" --vault "<project-name>"` or `obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).

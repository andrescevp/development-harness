---
kind: synthesis-summary
id: syn-20260928-dev-harness-v2-plugin
date: 2026-09-28
project_location: "/home/andres/workspace/dev-harness-skills"
tags: [evolve, synthesis, topic/plugin-pipeline]
source_plan: docs/plans/dev-harness-v2-plugin/plan.md
proposals:
  - prop-20260928-workflow
  - prop-20260928-testing
---

# Synthesis: dev-harness-v2-plugin session learnings

Session: completed plan `dev-harness-v2-plugin` (6 agents + 12 skills OpenCode V2
plugin; 7/7 sub-tasks Completed, verdict Approve with comments). Captured 7
observations, distilled into 6 evolution units, clustered into 2 proposals.

## Reusable pattern worth promoting

**Single manifest as the contract for extract → audit → build pipelines.**
One `scripts/manifest.json` (include lists + expected-pending counts) drove
`extract --check`, the audit, and `copy-assets`. It made a mid-plan user scope
reduction (14/37 → 6/12) a small include-list edit, kept counts drift-free
across all 7 sub-tasks, and self-adjusted when the new `dh-coding` skill landed
(`bundledSkillMdCount {now, afterSt3}`) with zero hand-bumped expectations.
Promotion target: a reusable **skill** for manifest-driven asset pipelines
(extraction + audit + build), evidence: `evu-20260928-66b223`,
`evu-20260928-e7bc38`.

## Proposals generated

| Proposal | Cluster | Units | Avg confidence | Scope notes |
|---|---|---|---|---|
| `prop-20260928-workflow` | workflow | 4 | 0.68 | manifest-as-contract, npm-script naming, scoped-bundle normalization, extractor hardening |
| `prop-20260928-testing` | testing | 2 | 0.60 | stub-ctx registration verification, tests assert real semantics |

## Promotion status

- **Already global** (apply across projects): shared-manifest pipeline
  (`evu-20260928-66b223`), npm script/CLI naming collision
  (`evu-20260928-2da744`), stub-ctx verification of real bundles
  (`evu-20260928-07cd07`), tests asserting real semantics
  (`evu-20260928-e8ae73`).
- **Project-scoped promotion candidates** (need 2nd context before promoting):
  scoped-bundle name normalization + AGENTS.md mapping table
  (`evu-20260928-f0b756`), extractor symlink/secret hardening
  (`evu-20260928-e7bc38`). Both are cross-project plausible (any scoped plugin
  or copy-tooling repo); revisit when a second project exhibits the pattern.

## Follow-ups

- Review proposals in `docs/evolve/proposals/` before applying any artifact.
- Live-load verification of V2 plugins remains an open question
  (`obs-20260928-010619-11670`): re-validate against a future opencode host
  version, then promote the stub-ctx lesson to an explicit verification step.
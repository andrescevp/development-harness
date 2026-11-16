---
title: "TOON Output Integration — session learnings"
slug: toon-output-integration-session-learnings
description: "What worked and what did not while making MCP output and native bash output TOON-aware: automatic format change and dual-format test parsing, hook result shapes, shell restoration safety, true LRU versus FIFO, bundled dependency proof, gated tests and smoke parsing, and what to watch on the next output change."
kind: observation
id: obs-20261116-0248-toon-output-integration
date: 2026-11-16
agent: "dh-documentor"
project: "dev-harness-skills"
stack: "TypeScript + MCP SDK + @opencode/plugin + @toon-format/toon 4.4.0"
plan: "toon-output-integration"
tags: [observation, topic/toon, topic/mcp, topic/plugin, topic/testing]
feature: "TOON Output Integration"
epic: "Context efficiency"
created: 2026-11-16
updated: 2026-11-16
confidence: 0.75
status: active
---

# Observation: TOON Output Integration — session learnings

## Overview

Plan `toon-output-integration` on `feature/toon-output-integration`: add TOON as
an automatic, lossless alternative to JSON on the 12-tool `dh` MCP server and on
eligible native `bash` output, with a bounded restore cache and forwarded-command
restoration. The work covered a shared codec, one MCP conversion point, two V2
execute hooks, four new test suites, docs, and the full verification gate. The
session's main lessons are about changing an output format that tests, smokes,
and helpers had all assumed was JSON, and about keeping shell restoration
conservative enough to be safe.

## What Worked

- **One shared codec made the policy testable in one place.**
  `src/lib/toon.ts` exposes the threshold, strict shorter check, encode/decode,
  and sniffs. The MCP path and the plugin hooks both call `tryEncodeToon`, so the
  edge cases — non-objects, `JSON.stringify` returning `undefined`, circular
  structures, encoder errors — have one behavior and one set of tests.
- **`toon ?? json` is a quiet, robust call-site contract.** The codec returns
  `undefined` for every ineligible or failed payload instead of throwing, so both
  surfaces stay inert on malformed input. No caller needs a try/catch around
  serialization, and a future host shape change cannot surface as a tool error.
- **`textResult` was the right single choke point for MCP.** All 12 tools already
  serialized through it, so automatic TOON needed no tool schema, description, or
  input change. The 12-tool contract and every success payload shape stayed
  identical; only the text encoding varies.
- **The cache key contract is explicit.** Keying by SHA-256 of the trimmed TOON
  text makes exact-match lookup independent of object identity and keeps the map
  key small. The test/reset hook made the 100-entry bound and eviction order
  deterministic in tests instead of timing-dependent.
- **Recency refresh turned the insertion-ordered map into a true LRU.**
  `getCachedJson` deletes and re-inserts a hit before returning it, so the
  eviction loop removes the least recently used payload. Without that refresh
  the same Map would behave as FIFO and evict a payload that was just reused — a
  subtle difference that only a hit-then-insert-then-overflow test exposes.
- **Shell restoration was designed around "leave it alone".** Only quoted
  strings and heredoc bodies are candidates; unquoted text, comments, malformed
  quoting, and ANSI-C `$'...'` are copied verbatim; inserted JSON is never
  rescanned; commands over 1 MiB are returned unchanged. The scanner advances
  with explicit indices rather than regex-replacing the whole command, which
  makes those exclusions auditable.
- **Round-trip and semantic assertions survived the format change.** Tests parse
  JSON first and strict-decode TOON second, then assert the same payload shape.
  This preserved the original coverage instead of adding a parallel TOON-only
  suite that could pass while the JSON path regressed.
- **Bundling was proven, not assumed.** The build check greps both artifacts for
  TOON logic and for a bare `@toon-format/toon` import; `smoke-load` imports the
  built plugin in isolation, and `smoke-pack` installs the tarball offline. That
  combination is what proves a managed install will not fail at load time.
- **The gate caught the non-code surfaces.** Link check (432 references), audit
  (6 agents / 27 skills, 0 FAIL, 0 high-signature secrets, 0 junk), and pack
  smoke (392 files) confirmed the docs, inventory, and self-contained artifact
  stayed consistent with the code change.

## What Didn't

- **A JSON-only test helper fails the moment a payload grows.** The MCP helper
  and server tests assumed `JSON.parse` on the result text. Large plan or sheet
  payloads now arrive as TOON, so the helper had to try JSON and then a strict
  TOON decode. Any future helper, smoke, or external script that parses MCP text
  must do the same; the failure mode is a parse error, not a wrong value.
- **`content` and `output` are not interchangeable.** The host result can carry a
  string `content`, a `content` block array, and a string `output`. Converting
  both channels would double-compress or leave two divergent representations.
  The hook now treats `content` as the model-facing channel, replaces at most the
  first eligible text block, and uses `output` only when `content` yielded
  nothing. File blocks and later text blocks stay untouched.
- **"FIFO/LRU" in the requirement hid a real behavioral choice.** An
  insertion-ordered Map evicts in insertion order by default; that is FIFO, not
  LRU. The implementation had to refresh recency explicitly on every hit. The
  plan's wording allowed either, but the docs and the test should name the chosen
  behavior so a future "simplification" does not silently downgrade it.
- **Cross-process exact match is impossible without persistence.** The MCP
  server and the plugin are separate processes, so MCP TOON forwarded into bash
  can only be decoded and re-serialized. That is semantically equal but not
  byte-equal: key order and whitespace may differ. Documentation must not imply
  exact restoration across the boundary; the fallback is the designed behavior,
  not a bug.
- **Automatic output changes are easy to document as unconditional.** TOON is a
  conditional optimization: under 256 characters, non-object, non-JSON, or
  non-shorter payloads stay JSON, and errors stay plain text. Any wording like
  "MCP returns TOON" without the conditions is wrong and invites a client-side
  assumption that will break.
- **A passing unit suite does not prove packaging.** The source can import
  `@toon-format/toon` successfully while a managed install fails if the bundler
  leaves a bare import. Only the built-artifact grep plus `smoke-load` and
  `smoke-pack` close that gap.
- **The dirty tree is expected at close-out but noisy in reports.** Preflight and
  artifact check both flag the uncommitted implementation and task artifacts.
  That is the normal pre-commit state, not a failure; the reports should keep
  saying so explicitly so a reader does not treat the warning as a blocker.

## Decisions

- **JSON canonical, TOON model-facing.** No on-disk format changes, no migration,
  and every TOON payload must decode to the original value. This bounds the blast
  radius to serialization at two boundaries.
- **Automatic conversion at one point per surface.** `textResult` for MCP,
  `execute.after` for native tools. Per-tool opt-ins or a `format` parameter were
  rejected because they multiply schema surface and caller decisions.
- **Threshold plus strict shorter check, no exceptions.** The 256-character floor
  and the `toon.length < json.length` requirement are the whole eligibility
  policy. Special-casing "very tabular" payloads was rejected as unmeasurable
  without a benchmark.
- **`bash` default, env override.** `OPENCODE_TOON_PLUGIN_TOOLS` is a flat,
  comma-separated escape hatch. It avoids a config schema and keeps the default
  narrow; other tools can be opted in per session.
- **Exact cache first, strict decode second.** The cache preserves the original
  JSON for same-process forwards. The decode fallback handles MCP-originated and
  unknown TOON without claiming byte equality.
- **Restoration only inside quotes and heredocs.** Rewriting unquoted command
  text risks changing shell semantics (word splitting, globbing, operators).
  A missed restore is acceptable; a wrong restore is not.
- **True LRU at 100 entries.** Recency refresh on hit, eviction after insert.
  Unbounded and persistent caches were rejected for memory and coupling reasons.
- **Bundle the codec.** Pinned `4.4.0`, bundled into plugin and MCP artifacts,
  verified by artifact grep and isolation smokes. A package-size increase is the
  accepted cost of a self-contained install.
- **Adapt tests and helpers, never weaken them.** Dual-format parsing keeps the
  semantic assertions; opting tests out of TOON or lowering thresholds would
  hide the behavior under test.

## Follow-ups

- **Benchmark before tuning.** Measure tokens and latency for plan reads, sheet
  queries, and large `bash` JSON. Revisit the 256-character threshold, the tab
  delimiter, or the eligible-tool default only with data.
- **Add an explicit disable path if clients need it.** Consider `DH_TOON=off` or
  an MCP configuration switch. Today only native eligibility is configurable;
  MCP output is always JSON-or-TOON.
- **Search every JSON-only parser.** On the next change to MCP text, `rg` for
  `JSON.parse` in tests, smokes, scripts, and docs examples; each one is a
  potential dual-format site. Keep the "JSON first, strict TOON second"
  instruction in README/LOADING prominent.
- **Name the cache policy in code and docs.** Keep "true LRU with recency
  refresh" in the comment, the test name, and the docs; the requirement's
  "FIFO/LRU" wording is ambiguous enough to invite a regression.
- **Treat the process boundary as a contract.** Before considering a shared
  cache, confirm a real case where semantic equality is insufficient. If one
  appears, design invalidation and storage explicitly; do not add a file cache as
  a shortcut.
- **Re-run packaging proof after any bundler change.** `rg` for bare imports in
  `dist/plugin.js` and `dist/mcp/stdio.js`, then `smoke-load` and `smoke-pack`.
  Unit tests passing is not evidence that the artifact is self-contained.
- **Watch the dirty-tree warning at close-out.** Preflight/artifact check will
  keep reporting it until the close-out commit; confirm it is the only warning
  before treating the gate as green.
- **Release.** Final review and `dh-semver` decide the bump; `0.10.0` (minor) is
  the likely outcome from `0.9.0`. No tag on the feature branch.

## Related

- Plan: [toon-output-integration](../../plans/toon-output-integration/plan.md)
- Evolution: [2026-11-16-toon-output-integration](../2026-11-16-toon-output-integration.md)
- SDD: [sdd.md](../../plans/toon-output-integration/sdd.md)
- Fast alignment review: [tasks/review-fast.md](../../plans/toon-output-integration/tasks/review-fast.md)
- Preflight: [tasks/preflight.md](../../plans/toon-output-integration/tasks/preflight.md)
- Final verification: [tasks/final-verification.md](../../plans/toon-output-integration/tasks/final-verification.md)
- Components diagram: [diagrams/components.md](../../plans/toon-output-integration/diagrams/components.md)
- Codec: [src/lib/toon.ts](../../../src/lib/toon.ts)
- Hooks: [src/tools/toon-hooks.ts](../../../src/tools/toon-hooks.ts)
- MCP result helper: [src/mcp/tool-results.ts](../../../src/mcp/tool-results.ts)
- Tests: [toon-hooks.test.ts](../../../src/__tests__/toon-hooks.test.ts)

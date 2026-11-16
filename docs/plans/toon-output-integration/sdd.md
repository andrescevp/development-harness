---
title: TOON Output Integration
slug: toon-output-integration
description: Return TOON from MCP tools and compress/restore large JSON bash output automatically.
tags: [sdd, design, toon, output]
project: dev-harness-skills
stack: TypeScript, @opencode/plugin, MCP SDK, @toon-format/toon
created: 2026-11-16
updated: 2026-11-16
status: proposed
---

# Software Design Document: TOON Output Integration

## Problem Statement

Harness tools and MCP results are serialized as JSON. Large, uniform JSON
payloads — plan trees, sheet schemas, tabular query results, command output —
consume context tokens unnecessarily. TOON (Token-Oriented Object Notation) is
a lossless, human-readable encoding of the JSON data model that is
substantially smaller for uniform arrays and keyed objects.

The repository already has two output surfaces:

1. The `dh` MCP server, whose 12 tools serialize every payload through
   `textResult` as JSON.
2. The native OpenCode `bash` tool, whose output flows directly into the model
   context and can later be forwarded into another command.

The goal is to integrate TOON on both surfaces while preserving JSON
compatibility for forwarded output and keeping payload semantics unchanged.

## Goals / Non-Goals

- **Goals:**
  - Automatically return TOON from the 12 MCP tools when the payload is large
    enough, valid JSON, and TOON is strictly shorter.
  - Compress eligible native `bash` tool output under the same rules, with
    `bash` as the default eligible tool and an environment override.
  - Restore original JSON in forwarded bash commands: exact-match cached output
    first, valid-TOON decode fallback second; leave edited or invalid payloads
    untouched.
  - Preserve current tool semantics, error messages, and tool count.
  - Document the behavior, configuration, and JSON/TOON contract.
- **Non-Goals:**
  - Replacing JSON as the internal data model or on-disk format.
  - Encoding non-JSON prose, logs, or arbitrary text.
  - Adding a new TOON MCP tool or CLI command.
  - Persisting the restore cache to disk or across processes.
  - Changing the plan/sheet/command tool inputs or output meaning.

## Requirements

- **R1:** Add `@toon-format/toon` (4.4.x) as a runtime dependency and bundle it
  into the plugin and MCP artifacts so managed installs and `npx` remain
  self-contained.
- **R2:** Provide a shared TOON helper that safely encodes JSON-compatible
  payloads only when the serialized JSON is at least 256 characters and the
  TOON encoding is strictly shorter; otherwise return the JSON unchanged.
- **R3:** The MCP `textResult` path automatically returns TOON for eligible
  payloads; error results remain plain text and all tool payloads still decode
  to the same value.
- **R4:** Register native OpenCode tool hooks for the `bash` tool: an
  `execute.after` compression pass and an `execute.before` restoration pass.
  Eligible tools default to `bash` and can be overridden with
  `OPENCODE_TOON_PLUGIN_TOOLS`.
- **R5:** Forwarded-output restoration scans quoted strings and heredocs,
  restores exact cached JSON when the TOON matches a converted output, otherwise
  decodes valid TOON to JSON, and leaves edited or invalid text unchanged.
- **R6:** Bound the exact-match cache to 100 entries (FIFO/LRU) keyed by a hash
  of the TOON payload.
- **R7:** The plugin continues to register no tools, commands, or prompts and
  performs no tool/command/prompt transforms; only `execute.after` and
  `execute.before` hooks are added.
- **R8:** Tests cover the threshold, JSON validity, shorter-encoding check,
  round-trip equality, cache bound, env override, heredoc/quoted restoration,
  exact/fallback/edited-invalid cases, MCP automatic output, and updated
  JSON/TOON tool-result parsing.
- **R9:** Documentation describes the automatic MCP behavior, the bash
  compression/restoration rules, the environment override, the JSON/TOON
  contract, and the cache/security limits.
- **AC1:** A 256+ character uniform JSON payload returns TOON from MCP tools,
  and `decode(text)` equals the original payload.
- **AC2:** A payload shorter than 256 characters, invalid JSON, or one whose
  TOON form is not shorter stays JSON.
- **AC3:** Native `bash` output is compressed only for eligible tools, and the
  default eligible set is `bash`.
- **AC4:** A forwarded command containing a remembered TOON payload restores
  the original JSON byte-for-byte; a valid non-remembered TOON payload decodes
  to equivalent JSON; edited/invalid TOON is unchanged.
- **AC5:** The cache is bounded at 100 entries and evicts the oldest entry.
- **AC6:** The plugin registers two tool hooks and zero tool/command/prompt
  transforms; existing agent/skill registration is unchanged.
- **AC7:** The full local gate passes: tests, typecheck, build, audit, link
  check, plugin/MCP/install/pack smokes, and Docker scans where available.
- **AC8:** README, AGENTS.md, docs/LOADING.md, CHANGELOG, and close-out notes
  document the behavior and limits.

## Scope

- **In scope:**
  - `@toon-format/toon` dependency and bundling.
  - Shared encode/decode/eligibility/cache helpers.
  - MCP `textResult` automatic TOON output and test-helper decoding.
  - Native `bash` tool hooks: after compression, before restoration.
  - Environment override `OPENCODE_TOON_PLUGIN_TOOLS`.
  - Tests, docs, changelog, package/build checks, close-out notes.
- **Out of scope:**
  - TOON for non-JSON prose/logs or non-eligible tools by default.
  - MCP tool input changes or a new TOON-only tool.
  - Persistent cache, cross-process exact-match restoration, or a database.
  - Changing tool payload semantics, counts, or error messages.
  - Release tagging/pushing.

## Workspace Impact

- **Workspace root:** `None — standalone repository`
- **Affected packages:** `None — standalone`
- **Shared paths:** `src/`, `scripts/`, `docs/`, `AGENTS.md`, `README.md`,
  `CHANGELOG.md`, `package.json`, `pnpm-lock.yaml`, `tsdown.config.ts`

| Package | Stack | Test | Build | Docs | Version policy |
|---|---|---|---|---|---|
| None — standalone repository | TypeScript/Node + MCP | `pnpm test` | `pnpm build` | `docs/` | fixed |

## Constraints

- Keep `@toon-format/toon` bundled in the plugin artifact: the managed install
  has no node_modules and rejects bare imports.
- The MCP server runs in a separate process from the plugin hooks; exact-match
  restoration applies only to native bash outputs converted in the plugin
  process. MCP TOON forwarded into bash uses the valid-TOON fallback.
- Only the JSON data model is encoded/decoded; dates/NaN/BigInt follow the
  library's normalization rules.
- The 256-character threshold and “strictly shorter” rule are mandatory; no
  TOON output for equal-length encodings.
- Hooks must not alter tool results when the TOON conversion fails or is not
  smaller.
- No secrets or personal data may be logged by the TOON helpers; errors fall
  back silently to JSON.

## Risks and Edge Cases

- **MCP client compatibility:** automatic TOON changes text payloads. Existing
  tests and any JSON-only client must decode. Update the shared test helper and
  document the contract; keep payload semantics lossless.
- **Hook result shape:** V2 `Tool.Result` can carry `content` as a string or an
  array of text/file blocks. Replace only the text payload, preserving file
  blocks and metadata; fall back to JSON when the shape is ambiguous.
- **Shell restoration safety:** only quoted strings and heredocs are scanned;
  unquoted command text is never rewritten. Preserve shell quoting by using
  single-quote escaping.
- **Edited TOON:** exact text no longer matches and strict decode may still
  succeed on an edited payload. The rules require edited text to remain
  unchanged; use strict decode plus shape/round-trip checks and do not rewrite
  when the payload differs from a remembered conversion.
- **Large/nested data:** TOON may not be shorter; leave JSON. Cap scanned
  payload length to avoid pathological work.
- **Cache growth:** 100-entry bound with oldest-entry eviction.
- **Format drift:** TOON 4.4 exposes `indentSize` and `delimiter`; do not use
  unsupported options.

## Acceptance Criteria

- **AC1:** MCP tool output for a large uniform payload is TOON and decodes to
  the original value.
- **AC2:** Threshold/non-shorter/invalid cases stay JSON.
- **AC3:** Native bash compression is limited to eligible tools, default
  `bash`.
- **AC4:** Forwarded quoted/heredoc TOON restores exact JSON, valid TOON, or
  stays unchanged when edited/invalid.
- **AC5:** Cache bound and eviction verified.
- **AC6:** Two tool hooks registered; zero tool/command/prompt transforms.
- **AC7:** Full gate green.
- **AC8:** Docs and close-out notes updated.

## Open Questions

- Should the MCP automatic policy be configurable later (`DH_TOON=off`)?
  Deferred unless operationally needed.
- Should the cache be shared with the MCP process? Deferred; cross-process
  exact matching would require a shared store.

---
title: TOON Output Integration (MCP + native bash)
slug: toon-output-integration
description: Automatic TOON output for MCP tools plus native bash compression and JSON restoration for forwarded payloads.
created: 2026-11-16
updated: 2026-11-16
status: In Progress
active: true
tags: [plan, toon, output]
project: dev-harness-skills
---

# Plan: TOON Output Integration (MCP + native bash)

## Objective

Reduce context tokens without changing payload semantics: return TOON from the
12 `dh` MCP tools automatically when a JSON payload is at least 256 characters
and TOON is strictly shorter, and add native OpenCode `bash` hooks that
compress eligible tool output and restore JSON inside forwarded quoted or
heredoc payloads (exact cached match first, valid-TOON fallback second).

**Reference behavior:** the rules below mirror
[`opencode-toon-plugin`](https://github.com/fbosch/opencode-toon-plugin) and
TOON's official TypeScript package (`@toon-format/toon` 4.4.x). The harness
adapts them to its V2 plugin hooks and MCP server.

## Requirements Snapshot

- **R1:** Add `@toon-format/toon` 4.4.x and bundle it into the plugin/MCP
  artifacts so managed installs and `npx` stay self-contained.
- **R2:** Shared safe codec: encode only when serialized JSON is ≥256
  characters and TOON is strictly shorter; otherwise return JSON unchanged.
- **R3:** MCP `textResult` returns TOON automatically for eligible payloads;
  errors remain plain text and every payload still decodes to the same value.
- **R4:** Native V2 hooks for `bash`: `execute.after` compression and
  `execute.before` restoration; eligible tools default to `bash` and honor
  `OPENCODE_TOON_PLUGIN_TOOLS`.
- **R5:** Restoration scans quoted strings and heredocs; exact cached JSON
  wins, valid TOON decodes to JSON, edited/invalid text is untouched.
- **R6:** Exact-match cache is bounded to 100 entries, keyed by a hash of the
  TOON payload.
- **R7:** The plugin still registers no tools/commands/prompts and performs no
  tool/command/prompt transforms; only two tool execute hooks are added.
- **R8:** Tests cover threshold, validity, shorter check, round-trip, cache
  bound, env override, heredoc/quotes, exact/fallback/edited-invalid, MCP
  automatic output, and JSON/TOON test parsing.
- **R9:** Docs describe automatic MCP behavior, bash rules, env override,
  JSON/TOON contract, cache/security limits.
- **AC1:** Large uniform MCP payload returns TOON whose decode equals the
  original payload.
- **AC2:** <256 chars, invalid JSON, or non-shorter TOON stays JSON.
- **AC3:** Native bash compression applies only to eligible tools; default is
  `bash`.
- **AC4:** Forwarded remembered TOON restores exact JSON; valid unknown TOON
  decodes; edited/invalid stays unchanged.
- **AC5:** Cache holds at most 100 entries and evicts the oldest.
- **AC6:** Two tool hooks and zero tool/command/prompt transforms register.
- **AC7:** Full gate green (tests, typecheck, build, audit, links, smokes,
  Docker scans where available).
- **AC8:** README, AGENTS.md, LOADING, CHANGELOG, and close-out notes updated.

## Scope

- `@toon-format/toon` dependency and bundling configuration.
- Shared TOON codec, eligibility, cache, compression, and restoration helpers.
- Automatic MCP `textResult` TOON output and MCP test-helper decoding.
- Native `bash` `execute.after`/`execute.before` hooks.
- `OPENCODE_TOON_PLUGIN_TOOLS` eligibility override.
- Tests, docs, changelog, package/build checks, evolution/observation notes.

## Workspace Impact

- **Workspace root:** `None — standalone repository`
- **Affected packages:** `None — standalone`
- **Shared paths:** `src/`, `scripts/`, `docs/`, `AGENTS.md`, `README.md`,
  `CHANGELOG.md`, `package.json`, `pnpm-lock.yaml`, `tsdown.config.ts`

| Package | Stack | Test | Build | Docs | Version policy |
|---|---|---|---|---|---|
| None — standalone repository | TypeScript/Node + MCP | `pnpm test` | `pnpm build` | `docs/` | fixed |

## Assumptions and Constraints

- `@toon-format/toon` 4.4.x is the official, lossless codec; `encode`/`decode`
  are synchronous and MIT-licensed.
- TOON is a translation layer for LLM input; JSON remains the internal and
  on-disk data model.
- The MCP server and the plugin process are separate; exact-match restoration
  only covers native bash output converted in the plugin process. MCP TOON
  forwarded into bash uses the valid-TOON fallback.
- Only the JSON data model is encoded: objects/arrays from `JSON.parse` or
  `JSON.stringify`-able payloads. Prose, logs, and non-JSON text are never
  encoded.
- The 256-character threshold and strict shorter check are mandatory.
- Hooks must be inert on conversion failure; never throw into the host.
- No secrets, personal data, or raw command contents are logged by the TOON
  helpers.
- The plugin bundle must not evaluate bare imports at load time; TOON must be
  bundled by tsdown.
- No new MCP tools or tool-input changes; the 12-tool contract stays.

**Rejected alternatives:**

- **MCP opt-in `format` parameter** — the request is automatic TOON when
  possible, and one `textResult` conversion point avoids per-tool schema
  changes. Tests/helpers are adapted instead.
- **MCP `dh_logged_command` only** — plan/sheet payloads are the most tabular
  and benefit most; the request covers all 12 tools.
- **Native hooks for `bash` + `shell`** — the reference behavior and the stated
  default are `bash` only; `OPENCODE_TOON_PLUGIN_TOOLS` covers other tools
  without widening the default.
- **Vendor a minimal codec** — the official `@toon-format/toon` package is
  lossless, maintained, MIT-licensed, and small enough to bundle.
- **Unbounded cache or no cache** — an unbounded map leaks memory; no cache
  loses exact JSON restoration. LRU 100 matches the reference plugin.
- **Persistent/shared cache** — adds storage and cross-process coupling; the
  process-local cache plus valid-TOON fallback matches the stated behavior.

## Risks and Areas Requiring Care

- **MCP compatibility:** automatic TOON changes text payloads. Update the
  shared test helper and document that tool text is JSON or TOON; keep payload
  values lossless.
- **Hook result shape:** V2 `Tool.Result` content may be a string or an array
  of text/file blocks. Replace only the text payload; preserve file blocks and
  metadata; fall back to JSON when ambiguous.
- **Shell safety:** restore only inside quoted strings and heredocs; never
  rewrite unquoted command text. Escape single quotes when substituting JSON.
- **Edited TOON:** exact-match must fail; strict decode may still succeed on a
  syntactically valid edit. Do not rewrite unless the payload is unchanged from
  a remembered conversion or is a clean, valid TOON payload; otherwise leave it.
- **Large/nested data:** TOON may be longer; leave JSON. Cap scan length.
- **Cache memory:** 100-entry bound with oldest eviction; no disk persistence.
- **Process boundary:** MCP exact-match cache is not shared with the plugin;
  document the fallback behavior.
- **Dependency surface:** ensure `@toon-format/toon` is bundled in the plugin
  and MCP artifacts; `smoke-pack`/`smoke-load` must not see a bare import.

## Core concepts

**Compression contract.** A payload is converted only when every check passes:

```text
JSON text >= 256 chars
  -> JSON.parse succeeds
  -> TOON encode succeeds
  -> TOON length < JSON length
  -> replace text with TOON + remember {toon, json} in a 100-entry cache
otherwise -> keep JSON unchanged
```

**MCP path.** Every tool handler already returns `textResult(payload)`. The
helper becomes the single conversion point:

```ts
const json = JSON.stringify(payload);
const toon = tryEncodeToon(payload, json); // undefined when not eligible
return { content: [{ type: 'text', text: toon ?? json }] };
```

**Native bash path.** The V2 plugin registers:

```ts
const after = await ctx.tool.hook('execute.after', (event) => {
  if (!eligibleTools.has(event.tool.toLowerCase())) return;
  if (event.status !== 'completed') return;
  compressToolResult(event.result); // content string or text block
});

const before = await ctx.tool.hook('execute.before', (event) => {
  if (event.tool.toLowerCase() !== 'bash') return;
  restoreForwardedCommand(event.input); // mutate command
});
```

**Restoration contract.** Before a later bash call:

```text
quoted string or heredoc payload
  -> exact TOON match in cache?        -> substitute original JSON
  -> valid TOON decode?                -> substitute JSON.stringify(decoded)
  -> edited / invalid / unquoted       -> leave unchanged
```

**Cache.** `Map<sha256(toon), {toon, json}>`, insertion ordered, evict the
oldest entry when size > 100. The cache is process-local and never persisted.

**Configuration.** `OPENCODE_TOON_PLUGIN_TOOLS` is a comma-separated list of
native tool names eligible for compression; default `bash`. Restoration still
targets the `bash` tool only.

## Visual Context

- [Diagram index](./diagrams/index.md)
- [Current state](./diagrams/current-state.md)
- [Desired state](./diagrams/desired-state.md)
- [Critical changes](./diagrams/critical-changes.md)
- [Components](./diagrams/components.md)

## Research

None registered yet. External references are cited in the SDD and Objective;
TOON notes can be registered later in `docs/research/` if a version/EOL
question arises.

## Agent Selection

| Role | Selected agent | Why | Fallback |
|---|---|---|---|
| Architecture | dh-software-architect | Owns the output-pipeline design, hook/process boundary, and cache contract. | bundled architecture capability |
| Implementation | dh-software-engineer | Bundled engineering agent; edits TypeScript, hooks, tests, and build config. | bundled implementation capability |
| Documentation | dh-documentor | Owns README/AGENTS/LOADING/CHANGELOG and close-out notes outside `docs/plans`. | bundled documentation capability |
| Review | dh-reviewer | Scoped review of each sub-task against its acceptance criteria. | bundled review capability |
| Final review | dh-final-reviewer | Plan-wide sign-off against requirements and gates. | bundled final-review capability |

## Phases

### Phase 1: TOON core and MCP output

- **Status:** Completed

#### Sub-Task 1.1: Add the TOON dependency, bundling, and shared safe-codec helper

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Add `@toon-format/toon` 4.4.x, bundle it into the built artifacts, and implement a shared safe TOON codec with the 256-character/thinner checks.
- **Related Requirements:** R1, R2, R8, AC2
- **Dependencies and Preconditions:** SDD approved; no TOON dependency today.
- **In Scope for This Sub-Task:** `package.json`; `pnpm-lock.yaml`; `tsdown.config.ts`; `src/lib/toon.ts` (or equivalent); `src/__tests__/toon-codec.test.ts`.
- **Out of Scope for This Sub-Task:** MCP `textResult` wiring, plugin hooks, docs, changelog.
- **Instructions:**
  1. Add `"@toon-format/toon": "4.4.0"` (or the current 4.4.x pin) to dependencies; update the lockfile.
  2. In `tsdown.config.ts` `base.deps.alwaysBundle`, include `@toon-format/toon` so `dist/plugin.js` and `dist/mcp/stdio.js` evaluate no bare specifier. Do not add it to `neverBundle`.
  3. Create `src/lib/toon.ts` with:
     - `TOON_MIN_CHARS = 256`, `TOON_MAX_CACHE = 100`.
     - `tryEncodeToon(payload, jsonText?)`: only for non-null objects/arrays; require `JSON.stringify`/`JSON.parse` validity, `jsonText.length >= 256`, `encode(payload, { delimiter: '\t' })` success, and `toon.length < jsonText.length`; return `undefined` otherwise.
     - `decodeToon(text)`: `decode(text)` (strict), returning `undefined` on `ToonDecodeError`/other errors; do not throw to callers.
     - `looksLikeJson(text)` (`{`/`[` trim check) and `looksLikeToon(text)` (minimum length, newline, tabular header pattern; no JSON).
  4. Export only what the MCP/plugin layers need; keep the helper free of I/O and logging.
- **Acceptance Criteria:** Dependency pinned and locked; TOON bundled; helper converts only eligible payloads; round-trip `decode(encode(x))` equals `x`; non-shorter/invalid/too-small cases return `undefined`; no unsupported options (`keyFolding` is not in 4.4).
- **Cautionary Points (Risks & Edge Cases):** `JSON.stringify(undefined)`/circular payloads; strings/numbers are not eligible; Date/NaN normalization; TOON encode errors must be swallowed and fall back; tab delimiter must be used consistently; do not log payloads.
- **Implementation Suggestions:** TDD first: write `toon-codec.test.ts` with a 300-char uniform array, a 255-char payload, a nested payload whose TOON is longer, and invalid input. Then implement the helper. Use the package's `encode`/`decode` and `ToonDecodeError` export.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/toon-codec.test.ts`; `pnpm typecheck`; `pnpm build`; inspect `dist/plugin.js` for a bare `@toon-format/toon` import (`rg`).
- **Done When:** The helper and tests pass; the build bundles TOON; the lockfile is updated.

#### Sub-Task 1.2: Return TOON automatically from MCP textResult and adapt the test contract

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Make `textResult` return TOON for eligible payloads and teach the MCP test helper/parity suites to parse either JSON or TOON without weakening assertions.
- **Related Requirements:** R3, R8, AC1, AC2
- **Dependencies and Preconditions:** Sub-Task 1.1 completed (shared codec).
- **In Scope for This Sub-Task:** `src/mcp/tool-results.ts`; `src/__tests__/helpers/mcp.ts`; MCP tests that parse successful payloads (`sheet-logged.test.ts`, `plan-tools.test.ts` where needed); a new MCP TOON test.
- **Out of Scope for This Sub-Task:** Error-result formatting, native hooks, docs.
- **Instructions:**
  1. Change `textResult(payload)` to compute `json = JSON.stringify(payload)`, `toon = tryEncodeToon(payload, json)`, and return `toon ?? json`. Never throw from the TOON path; fall back to JSON.
  2. Keep `errorResult` raw text and `isError` semantics unchanged.
  3. Update the test helper `callToolJson` to `JSON.parse` first, then `decodeToon`, then throw a clear error if neither works. Add an exported `parseToolText` if other tests need it.
  4. Update the two direct `JSON.parse(textOf(res))` sites in `src/mcp/__tests__/sheet-logged.test.ts` to use the helper.
  5. Add `src/__tests__/mcp-toon.test.ts`: create a plan/sheet fixture large enough to force TOON, call a tool, assert the text is TOON (not JSON), decode it, and compare the payload to the JSON-equivalent expectation. Also assert a small payload stays JSON.
- **Acceptance Criteria:** Large successful MCP payloads are TOON and decode to the same value; small/error payloads are unchanged; all existing MCP tests pass; no test parses TOON as JSON.
- **Cautionary Points (Risks & Edge Cases):** `JSON.stringify` of `undefined`; payload size below threshold; error results must stay plain; `plan-tools.test.ts` may assert `delegatedTo` in raw text — update to parse, do not weaken. Do not change tool input schemas.
- **Implementation Suggestions:** Put the shared parser in `src/__tests__/helpers/mcp.ts`; avoid duplicating decode logic. Keep the new test fixture in a helper, not a giant inline object.
- **Testing Suggestions:** `pnpm vitest run src/mcp/__tests__ src/__tests__/mcp-toon.test.ts`; `pnpm test`; `pnpm typecheck`.
- **Done When:** Automatic MCP TOON is proven and the MCP suite parses both formats.

#### Sub-Task 1.3: Document the MCP JSON/TOON contract in server instructions and tool descriptions

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Make the MCP surface explicitly advertise that successful payloads are JSON or TOON, without changing tool names, inputs, or counts.
- **Related Requirements:** R3, R9, AC6
- **Dependencies and Preconditions:** Sub-Task 1.2 completed (behavior final).
- **In Scope for This Sub-Task:** `src/mcp/stdio.ts` `HARNESS_INSTRUCTIONS`; the 12 tool descriptions in `src/mcp/server.ts` (shared suffix or equivalent); `src/mcp/__tests__/server.test.ts` description assertion if useful.
- **Out of Scope for This Sub-Task:** README/AGENTS/LOADING/CHANGELOG (Sub-Task 3.1); native hook docs.
- **Instructions:**
  1. Extend `HARNESS_INSTRUCTIONS` with one sentence: successful tool payloads are JSON, or TOON when the payload is at least 256 chars and TOON is shorter; use `JSON.parse` or TOON decode.
  2. Append a concise suffix to every tool description (or introduce a shared `withToonNote(description)` helper and apply it): “Payload is JSON, or TOON when shorter.” Keep the 12 descriptions meaningful and do not change tool names/input schemas.
  3. Add a test assertion that all tool descriptions mention TOON (or at least the shared note), and that the tool count remains 12.
- **Acceptance Criteria:** MCP instructions and all 12 descriptions state the JSON/TOON contract; tool list/count unchanged; tests pass.
- **Cautionary Points (Risks & Edge Cases):** Do not make descriptions so long they lose signal; do not add a new tool or input field; keep the existing `plan/sheet/command` descriptions intact apart from the suffix.
- **Implementation Suggestions:** Prefer a single `TOON_NOTE` constant applied at registration to avoid 12 prose copies drifting. If refactoring registration, keep the handler bodies unchanged.
- **Testing Suggestions:** `pnpm vitest run src/mcp/__tests__/server.test.ts`; `pnpm typecheck`.
- **Done When:** The MCP contract is explicit in instructions and descriptions.

### Phase 2: Native bash hooks and restoration

- **Status:** Completed

#### Sub-Task 2.1: Add the native bash compression hook and bounded restore cache

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Register an `execute.after` hook that compresses eligible native tool output and remembers the original JSON in a 100-entry bounded cache.
- **Related Requirements:** R4, R6, R7, R8, AC3, AC5
- **Dependencies and Preconditions:** Sub-Task 1.1 completed (codec); V2 tool hook signatures confirmed.
- **In Scope for This Sub-Task:** `src/lib/toon-hooks.ts` (or `src/toon/plugin.ts`); `src/plugin.ts` hook registration; `src/__tests__/toon-hooks.test.ts`; cache unit tests.
- **Out of Scope for This Sub-Task:** Forwarded restoration (2.2); registration test/header (2.3); docs.
- **Instructions:**
  1. Implement `TOON_MAX_CACHE = 100` and a `Map<string, {json,toon}>` keyed by `sha256(toon)`, insertion-ordered; evict the oldest entry when size > 100. Export a test-only reset or factory so tests are isolated.
  2. Implement `getEligibleTools(env = process.env)`: default `['bash']`; parse `OPENCODE_TOON_PLUGIN_TOOLS` comma-separated, lowercase, trim, filter empty.
  3. Implement `compressToolResult(result, eligible)` supporting `content` as a string or an array of blocks:
     - Find the single text block (or the first text block that is valid JSON); leave file blocks/metadata untouched.
     - Trim for the checks, but preserve original text when unchanged.
     - Only eligible tools; only `status: 'completed'`.
     - On success replace the text with TOON and cache `{toon, json}`.
     - On failure leave the result unchanged.
  4. In `src/plugin.ts`, register `await ctx.tool.hook('execute.after', handler)` and return a cleanup that disposes it (plus the before hook once added). Do not add tool transforms.
- **Acceptance Criteria:** Eligible bash output ≥256 chars and shorter TOON is replaced; non-eligible/short/invalid/longer output untouched; cache bounded at 100; env override works; no throw escapes the hook.
- **Cautionary Points (Risks & Edge Cases):** Content arrays with file blocks; `result.output` vs `content`; empty/undefined result; tool name case; cache key collision negligible; no logging of command/output contents.
- **Implementation Suggestions:** Keep pure helpers separate from hook registration so tests need no host. Use `crypto.createHash('sha256')`. Follow the reference plugin’s `execute.after` shape but adapt to the V2 event object.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/toon-hooks.test.ts`; test string content, array content with a file block, below-threshold, longer TOON, env override, and 101-entry eviction.
- **Done When:** The after hook compresses eligible output and the cache is bounded.

#### Sub-Task 2.2: Add forwarded quoted/heredoc TOON restoration

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Register an `execute.before` hook that restores JSON inside quoted strings and heredocs using exact cache match first and valid-TOON decode fallback, leaving edited/invalid payloads unchanged.
- **Related Requirements:** R5, R8, AC4
- **Dependencies and Preconditions:** Sub-Task 2.1 completed (cache and codec).
- **In Scope for This Sub-Task:** `src/lib/toon-hooks.ts` restoration helpers; `src/plugin.ts` before-hook registration; `src/__tests__/toon-restore.test.ts`.
- **Out of Scope for This Sub-Task:** Unquoted command rewriting; restoration of MCP output by exact match (cross-process limitation documented).
- **Instructions:**
  1. Implement `restoreForwardedCommand(command, cache)`:
     - Heredocs: match `<<[-]?['"]?MARKER['"]?` bodies and the closing marker; only replace the body if it is an exact cached TOON or a strict-valid TOON payload.
     - Single- and double-quoted strings: only replace the inner body under the same rules; preserve shell quoting with `'` escaping (`'` → `'\''`).
     - Exact cache match: hash the trimmed body and return `cache.get(hash).json`.
     - Fallback: `looksLikeToon` + `decodeToon`; substitute `JSON.stringify(decoded)`.
     - Edited/invalid: leave the original substring untouched.
     - Never rewrite unquoted command text; no recursive replacement of the inserted JSON.
  2. Add a maximum scan length (for example 1 MiB) and bail out unchanged above it.
  3. Register `ctx.tool.hook('execute.before', ...)` for `bash` only; mutate `input.command` only when `restoreForwardedCommand` changes it.
  4. Return a cleanup disposing both hook registrations from `setup`.
- **Acceptance Criteria:** Remembered TOON restores the exact original JSON; valid unknown TOON decodes to equivalent JSON; edited/invalid/unquoted text unchanged; quotes/heredocs preserve shell semantics; 1 MiB cap respected.
- **Cautionary Points (Risks & Edge Cases):** Heredoc markers with quotes/`<<-`; apostrophes in JSON; double-quoted backslashes; payloads that merely look like TOON; no replacement inside unquoted words; do not decode arbitrary JSON-like text.
- **Implementation Suggestions:** Port the reference plugin’s `replaceHeredocs`, `replaceQuotedPayloads`, `replaceCachedPayloads`, and `getJsonForForwardedText` logic; replace `keyFolding` with the supported tab delimiter; test each path independently. Keep the parser pure and length-capped.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/toon-restore.test.ts` with fixtures for single quotes, double quotes, heredoc, exact cache, fallback, edited TOON, invalid TOON, unquoted text, and apostrophe escaping.
- **Done When:** The before hook restores only valid payloads and leaves everything else byte-identical.

#### Sub-Task 2.3: Update the plugin registration contract, tests, and headers for tool hooks

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Update the plugin’s hard-cut contract and tests from “zero tool-domain access” to “zero tool/command/prompt transforms, exactly two execute hooks,” and fix the plugin header/comments.
- **Related Requirements:** R7, R8, AC6
- **Dependencies and Preconditions:** Sub-Tasks 2.1–2.2 completed (hooks registered).
- **In Scope for This Sub-Task:** `src/__tests__/registration.test.ts`; `src/plugin.ts` header/comments; any test stub context that assumes no tool domain.
- **Out of Scope for This Sub-Task:** README/AGENTS/LOADING (3.1); hook behavior (2.1/2.2).
- **Instructions:**
  1. Replace the registration stub’s `tool.transform`-throws guard with a stub that records `tool.hook` registrations and still throws if `tool.transform` is called.
  2. Assert exactly two hooks (`execute.after`, `execute.before`), zero tool transforms, zero command/prompt transforms, and unchanged agent/skill registration (6/27).
  3. Ensure `plugin.setup` returns a cleanup; call it in the test and assert both registrations dispose.
  4. Update the `src/plugin.ts` header: no tool/command/prompt transforms or registrations; two tool execute hooks implement TOON. Keep the agent/skill registration semantics unchanged.
- **Acceptance Criteria:** Registration test asserts two hooks and zero transforms; cleanup disposes them; 6 agents/27 skills unchanged; plugin header accurate.
- **Cautionary Points (Risks & Edge Cases):** Hook registration order; setup cleanup type; the existing tool-domain guard meta-test must be rewritten, not deleted silently; do not weaken the “no tool transforms” hard cut.
- **Implementation Suggestions:** Capture hook names in an array; return a `Registration`-like stub from `tool.hook` with a `dispose` spy. Keep the existing command-domain guard.
- **Testing Suggestions:** `pnpm vitest run src/__tests__/registration.test.ts`; `pnpm build` then rerun; `pnpm typecheck`.
- **Done When:** The registration contract reflects the two hooks and still blocks tool/command transforms.

### Phase 3: Documentation, packaging, verification

- **Status:** In Progress

#### Sub-Task 3.1: Update project docs, changelog, and skill guidance

- **Status:** Completed
- **Delegated to agent:** dh-documentor
- **Objective:** Document automatic MCP TOON, native bash compression/restoration, the env override, and the JSON/TOON contract in the human-facing docs.
- **Related Requirements:** R9, AC8
- **Dependencies and Preconditions:** Phase 1 and 2 implementation complete (behavior final).
- **In Scope for This Sub-Task:** `README.md`; `AGENTS.md`; `docs/LOADING.md`; `CHANGELOG.md` (`## [Unreleased]`); a note in `skills/dh-execute-cli/SKILL.md` or the relevant skill guidance; `opencode.example.jsonc` if the env override belongs there.
- **Out of Scope for This Sub-Task:** `docs/plans/**`, historical notes, `docs/evolve/**`, source code.
- **Instructions:**
  1. README: add a TOON feature bullet/section — automatic MCP TOON, 256-char/thinner rule, bash hooks, `OPENCODE_TOON_PLUGIN_TOOLS`, exact/fallback restoration, LRU 100, JSON remains canonical.
  2. AGENTS.md: update the plugin registration paragraph (“no tool transforms/registrations” → two execute hooks for TOON), and note the MCP JSON/TOON output contract in the harness runtime/tool section.
  3. `docs/LOADING.md`: add a “TOON output” section with the behavior, env override, limitations (MCP/plugin process boundary), and how to decode; update the MCP tool description note if needed.
  4. `CHANGELOG.md`: `## [Unreleased]` Added (TOON dependency, automatic MCP TOON, native bash compression/restoration, cache) and Changed (MCP tool text is JSON or TOON; plugin now registers two tool hooks).
  5. `skills/dh-execute-cli/SKILL.md`: one note that native bash JSON output may appear as TOON and is restored to JSON when forwarded; MCP tool text may be JSON or TOON.
- **Acceptance Criteria:** Docs accurately describe the thresholds, env override, restoration rules, cache bound, process boundary, and JSON canonical model; no stale “zero tool-domain access” claim; links resolve.
- **Cautionary Points (Risks & Edge Cases):** Do not claim TOON is always used; it is conditional. Do not imply the cache persists or that MCP exact-match restoration works across processes. Keep the 12-tool count unchanged.
- **Implementation Suggestions:** Reuse the SDD diagrams/flow; keep the LOADING section short and operational. Add the env var to the example config only if it is a real config surface.
- **Testing Suggestions:** `node scripts/check-links.mjs`; `rg` for stale “zero tool” wording; `pnpm test` (docs only).
- **Done When:** All active docs agree on the JSON/TOON contract and limits.

#### Sub-Task 3.2: Run packaging/build checks and the full verification gate

- **Status:** Completed
- **Delegated to agent:** dh-software-engineer
- **Objective:** Prove TOON is bundled, the package remains self-contained, and the full release gate is green.
- **Related Requirements:** R1, R7, R8, AC7
- **Dependencies and Preconditions:** Phase 1–3.1 complete.
- **In Scope for This Sub-Task:** build/package verification, tests, lint, typecheck, audit, link check, smokes, Docker scans where available, `reports/audit.*` regeneration.
- **Out of Scope for This Sub-Task:** release tagging/pushing; docs changes beyond fixes.
- **Instructions:**
  1. `pnpm build`; verify `dist/plugin.js` and `dist/mcp/stdio.js` contain TOON logic and no bare `@toon-format/toon` import (`rg`); confirm `dist/assets` unchanged.
  2. Run `pnpm lint:biome`, `pnpm format:biome:check`, `pnpm lint:knip`, `pnpm lint:dup`, `pnpm lint:depcruise`, `pnpm lint:links`, `pnpm test`, `pnpm typecheck`, `pnpm run audit`.
  3. Run `node scripts/smoke-load.mjs`, `node scripts/smoke-mcp.mjs`, `node scripts/smoke-install.mjs`, `node scripts/smoke-pack.mjs`.
  4. Run `pnpm scan:deps` and `pnpm scan:code` if Docker is available; otherwise record the exact reason.
  5. Confirm package size/asset inventory still 6 agents/27 skills/12 tools and the tarball has no source/tests/plans.
- **Acceptance Criteria:** Full gate green; TOON bundled; no bare import; 12 tools unchanged; audit PASS; package smokes pass.
- **Cautionary Points (Risks & Edge Cases):** The plugin bundle must not evaluate a bare TOON import in a managed install; `smoke-load` is the proof. `pnpm audit` collides with the security audit — use `pnpm run audit`. Do not weaken tests to accommodate TOON; decode instead.
- **Implementation Suggestions:** Log each command and result via `dh-execute-cli`; inspect `dist/plugin.js` with `rg -n "@toon-format/toon|toon"`. A package-size regression is acceptable only if required to bundle the codec.
- **Testing Suggestions:** The gate itself; plus `node -e "import('./dist/plugin.js')"` and `node scripts/smoke-mcp.mjs` for the built artifacts.
- **Done When:** The release gate is green and TOON is proven self-contained.

#### Sub-Task 3.3: Write evolution and observation close-out notes

- **Status:** In Progress
- **Delegated to agent:** dh-documentor
- **Objective:** Record what changed, why, the output-pipeline design, validation results, limitations, and session learnings.
- **Related Requirements:** AC8
- **Dependencies and Preconditions:** Phase 3.2 complete; gate outcomes known.
- **In Scope for This Sub-Task:** `docs/evolution/<YYYY-MM-DD>-toon-output-integration.md`; `docs/evolution/observations/<YYYY-MM-DD>-<HHMM>-toon-output-integration.md`; `docs/evolution/index.md` rows.
- **Out of Scope for This Sub-Task:** `docs/plans/**` (except the Execution Record link), `docs/evolve/**`, source code.
- **Instructions:**
  1. Evolution note: MCP automatic TOON, native bash after/before hooks, 256-char/thinner rule, LRU 100, env override, process-boundary limitation, validation, follow-ups.
  2. Observation note: what worked/didn’t (automatic MCP compatibility, hook result shapes, shell restoration safety, cache/process boundary, test-helper decoding), decisions, follow-ups.
  3. Prepend both rows to `docs/evolution/index.md` (newest first) and link them from the plan’s Execution Record.
- **Acceptance Criteria:** Both notes exist with valid frontmatter; index rows present; links resolve.
- **Cautionary Points (Risks & Edge Cases):** Do not claim exact-match MCP restoration across processes; do not duplicate the plan; keep dates/times real.
- **Implementation Suggestions:** Follow `skills/dh-create-documentation/references/evolution-notes.md`; link the TOON spec and reference plugin as external sources.
- **Testing Suggestions:** `node scripts/check-links.mjs`; frontmatter parse.
- **Done When:** Notes and index rows exist and are linked.

## Final Integration & Verification

- **System-Wide Test:** Build the plugin and MCP artifacts; verify `dist/plugin.js`/`dist/mcp/stdio.js` bundle TOON with no bare import; run the full gate; exercise a large MCP payload (TOON) and a small one (JSON), then exercise native bash compression and forwarded restoration (exact, fallback, edited/invalid). Confirm 12 tools, 6 agents, 27 skills, and no tool/command/prompt transforms.
- **Completion Checklist:**
  - [ ] `@toon-format/toon` pinned, locked, bundled.
  - [ ] MCP `textResult` returns TOON only for ≥256 chars, valid JSON, and strictly shorter TOON.
  - [ ] Native `bash` after hook compresses eligible output; env override works.
  - [ ] Before hook restores exact/valid TOON in quotes/heredocs; edited/invalid untouched.
  - [ ] Cache bounded at 100.
  - [ ] Two hooks, zero tool/command/prompt transforms; 12 tools unchanged.
  - [ ] Tests, typecheck, build, audit, links, smokes, Docker scans pass.
  - [ ] README, AGENTS.md, LOADING, CHANGELOG, skill note, evolution/observation notes updated.
  - [ ] No secrets/personal data logged; no persistent cache.

## Execution Record

- **Execution status:** Not executed
- **Executed at:** [YYYY-MM-DD]
- **Workspace root:** /home/andres/workspace/dev-harness-skills
- **Repository kind:** workspace
- **Repository path:** `.`
- **Branch / worktree:** [branch]
- **Commit range:** [base..head]
- **Plan path:** docs/plans/toon-output-integration/plan.md
- **Mirrored plan path:** none
- **Summary:**
  - [What shipped]
- **Architectural changes:** [TOON output pipeline, MCP automatic encoding, native bash hooks, bounded restore cache]
- **References:** [review, handoff, evolution note and ADR links]

## Open Questions

- Should automatic MCP TOON be configurable (`DH_TOON=off`) later? Deferred.
- Should the restore cache be shared across processes? Deferred; would need a shared store.
- Should other tools (`shell`, custom bash-like tools) be eligible by default? The env override covers them without changing the default.

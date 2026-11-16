---
title: TOON output integration — plan-wide code review
plan: toon-output-integration
gate: code-review (plan-wide)
range: 5bde6c3..HEAD
created: 2026-11-16
verdict: Request changes
---

# Code Review Summary

**Scope**: Plan-wide review of the TOON output integration (`5bde6c3..HEAD`, commit `eb3113a`): shared safe codec, native `execute.after`/`execute.before` hooks, MCP automatic TOON, tests, docs, and packaging.
**Packages**: `None — standalone` (all findings `[workspace]`)
**Overall risk**: Medium
**Verdict**: **Request changes** (one P1 blocking finding)

Validation run during review: `vitest run src/__tests__/{toon-codec,toon-hooks,toon-restore,mcp-toon}.test.ts` → 4 files, 51 tests passing. Package check: `@toon-format/toon` 4.4.0 declared (`package.json:67`), present in the lockfile, and bundled — `dist/plugin.js` and `dist/mcp/stdio.js` contain no bare `@toon-format/toon` import.

## Findings

### [P1] High (blocking)

- **Unquoted heredoc bodies are rewritten with raw JSON, so the shell expands and executes payload content**
  - **Package**: `[workspace]`
  - **Location**: `src/tools/toon-hooks.ts:178` (`HEREDOC_PATTERN`), `src/tools/toon-hooks.ts:227-241` (`readHeredoc`). The marker quote is captured as group 2 but never checked; `readHeredoc` returns `${prefix}${json}${suffix}` for both quoted (`<<'EOF'`) and unquoted (`<<EOF`) markers.
  - **Why it matters**: An unquoted heredoc delimiter makes the shell perform parameter expansion, command substitution, and backslash processing on the body. The restored JSON is inserted verbatim, so any `$…`, `` `…` ``, or `$(…)` inside a payload value is evaluated as shell code — and the delivered file content is silently corrupted. Payload values originate from earlier tool output (repository files, command output, sheet cells), i.e. untrusted data that a prompt injection can steer.
  - **Evidence**: The repo's own test asserts the unquoted path is rewritten — `src/__tests__/toon-restore.test.ts:111-115` (`cat <<JSON\n<TOON>\nJSON` → JSON body). A probe driving the real `restoreForwardedCommand` with a TOON payload containing `x$(touch /tmp/toonprobe/PWNED)y` produced:
    ```text
    cat > /tmp/toonprobe/rows.json <<JSON
    [{"id":1,...,"payload":"x$(touch /tmp/toonprobe/PWNED)y",...}]
    JSON
    ```
    Running that command with `sh`: `exit=0`, `/tmp/toonprobe/PWNED` created, and `rows.json` contains `"payload":"xy"` (command substitution executed, value destroyed).
  - **Fix**: Only rewrite a heredoc body when the delimiter is quoted (`const quote = match[2] ?? ''; if (quote === '') return { text: match[0] ?? '', end: ... }`), or escape `\`, `$`, and `` ` `` before inserting into an unquoted body. Add a test that `cat <<JSON` stays byte-identical while `cat <<'JSON'` still restores.

### [P2] Medium

- **The decode fallback only recognises tabular TOON, so most MCP TOON never restores — contrary to the docs**
  - **Package**: `[workspace]`
  - **Location**: `src/lib/toon.ts:35` (`TOON_TABLE_HEADER` requires a `{field…}` list), `src/lib/toon.ts:91-95` (`looksLikeToon`), `src/tools/toon-hooks.ts:197-199`. Docs claim the general case: `AGENTS.md:93-97` ("MCP TOON forwarded into bash uses the decode fallback"), `docs/LOADING.md:435-439` ("otherwise a clean, strictly valid TOON payload is decoded"), `README.md:246-256`, `skills/dh-execute-cli/SKILL.md:84-87`.
  - **Why it matters**: A valid TOON payload whose array holds primitives (`head[20\t]: …`, `files[3\t]: a\tb\tc`) or whose document is non-tabular has no `{…}` header, so we never even try to decode it. Forwarded MCP output then stays TOON where the command expects JSON, and the documented "valid-TOON decode fallback" silently does nothing.
  - **Evidence**: A realistic `logged_command` payload (`{ok, exitCode, logPath, truncated, head[], tail[]}`, 1074 JSON chars) encodes to 970 TOON chars — `tryEncodeToon` returns it — while `looksLikeToon` returns `false` (probe against the real lib). Only the in-process exact cache can rescue that payload; cross-process MCP output cannot.
  - **Fix**: widen the header to accept array-of-primitives (`(?:\{[^}\n]+\})?` before `:`), or attempt `decodeToon` for multi-line non-JSON text and accept only object/array results (the helper already enforces that in `parseToolText`, `src/__tests__/helpers/mcp.ts:111-120`). Whichever is chosen, align `AGENTS.md`/`LOADING`/`README` with the actual sniffer scope.

- **TOON is encoded from the in-memory payload, not its JSON form, so the decoded value can differ from the JSON value**
  - **Package**: `[workspace]`
  - **Location**: `src/lib/toon.ts:55` (`encode(payload, …)`), `src/mcp/tool-results.ts:19-20`.
  - **Why it matters**: The shorter check compares TOON against `JSON.stringify(payload)`, but the encoded input was never JSON-normalized. Values whose JSON form differs from the object (`undefined` properties/array holes → dropped by JSON, `null` in TOON; getters; custom `toJSON`) yield TOON that decodes to a different shape than the JSON text. Optional result fields are common in this repo, so the invariant "both decode to the same value" (`README.md:232-234`, `docs/LOADING.md:405-407`) can silently break.
  - **Evidence**: `encode([{id:1, pad:'x…'}, {id:2, value:2, pad:'y…'}])` with an `undefined` `value` on row 1 decodes to `[{id:1,value:null,pad},{id:2,value:2,pad}]`, while `JSON.parse(JSON.stringify(payload))` has no `value` key on row 1 (`undefined`-drop).
  - **Fix**: encode the JSON-normalized value: `const parsed = JSON.parse(json); const toon = encode(parsed, …)`. Cost is one extra parse on payloads already worth encoding; the native path (`src/tools/toon-hooks.ts:107-112`) already does this and is unaffected.

- **Cache entries have no size bound: 100 entries × (JSON + TOON) of arbitrary tool output is unbounded retention**
  - **Package**: `[workspace]`
  - **Location**: `src/tools/toon-hooks.ts:52`, `src/tools/toon-hooks.ts:70-79` (`cacheConvertedOutput`), `src/tools/toon-hooks.ts:100-117` (no length ceiling above `TOON_MIN_CHARS`).
  - **Why it matters**: Each entry stores both strings and lives for the process lifetime. `execute.after` receives whatever the host hands back for an eligible tool; with `OPENCODE_TOON_PLUGIN_TOOLS` widened to a file/read-style tool, one 10 MB output is retained twice, and 100 of them is gigabytes in the plugin process. The plan treats the cache as a bounded security surface ("bounded to 100 entries", `AGENTS.md:91-92`), but the entry *size* is not bounded.
  - **Evidence**: `convertJsonText` has only a minimum (`TOON_MIN_CHARS`) and no maximum; `cacheConvertedOutput` stores `{ json, toon }` verbatim and evicts purely by count.
  - **Fix**: add `TOON_MAX_ENTRY_CHARS` (e.g. 256 KiB) and skip caching above it — still return the TOON text — and/or track total cached characters and evict until under a total cap. Document the per-entry limit next to the 100-entry bound.

- **The hook callbacks in `plugin.ts` are never executed by any test**
  - **Package**: `[workspace]`
  - **Location**: `src/plugin.ts:97-123`; `src/__tests__/registration.test.ts:107-129` only asserts the hook *names* and cleanup.
  - **Why it matters**: All wiring logic sits in inline closures test code cannot reach: the `status !== 'completed'` guard (`src/plugin.ts:99`), eligible-tool matching (`:100`), the `input.command` string guard (`:115-116`), and the in-place assignment (`:119`). A regression here (wrong event field, wrong status string, ineligible tool) would ship silently and disable or misapply the feature while every test stays green — including the destructive restoration path covered by the P1 finding above.
  - **Evidence**: `createStubContext().tool.hook` (`src/__tests__/registration.test.ts:67-74`) discards the callback; grep shows no test invokes an `execute.before`/`execute.after` callback.
  - **Fix**: export two small handlers from `src/tools/toon-hooks.ts` (e.g. `handleExecuteAfter(event, eligible)`, `handleExecuteBefore(event)`) and have `plugin.ts` delegate; extend `registration.test.ts` (or a new `toon-plugin-hooks.test.ts`) to invoke the captured callbacks for completed/error statuses, eligible/ineligible tools, and a parseable/non-parseable command.

### [P3] Low

- **Per-tool description states a weaker condition than the implemented contract**
  - **Package**: `[workspace]`
  - **Location**: `src/mcp/server.ts:41` (`TOON_NOTE = 'Successful payloads are JSON, or TOON when shorter.'`) versus `src/mcp/stdio.ts:25-27`, `README.md:236-243`, `AGENTS.md:87-89`.
  - **Why it matters**: The description a client reads from `tools/list` omits the ≥256-character and object/array conditions, so a client could special-case "shorter ⇒ TOON" and mis-parse small payloads. `src/mcp/__tests__/server.test.ts:54-61` only checks that both words appear, so the imprecision is invisible to tests.
  - **Fix**: make the note match the instruction text (e.g. `'Successful payloads are JSON, or TOON when the JSON is at least 256 characters and TOON is shorter.'`) and assert the threshold words in the description test.

- **Pathological heredoc rescan is quadratic within the 1 MiB window**
  - **Package**: `[workspace]`
  - **Location**: `src/tools/toon-hooks.ts:270-277` (every `<<` triggers `readHeredoc`), `src/tools/toon-hooks.ts:178` (lazy `[\s\S]*?` runs to end of command when no closing marker exists).
  - **Why it matters**: A command built from repeated `<<name\n` lines without closing markers forces one full rescan per opener; at the 1 MiB cap that is billions of character comparisons in the `execute.before` path, delaying or stalling the command before it runs.
  - **Evidence**: The regex has no anchor/limit on how far the body may extend, and `readHeredoc` is called for each `<<` in the scan loop; the existing guards cap total length only.
  - **Fix**: memoize the last position where a heredoc terminator search failed and stop rescanning, or bound the body search (e.g. reject bodies beyond a fixed span). Low priority — the 1 MiB guard already limits exposure.

## Non-findings worth recording

- `src/lib/toon.ts` error swallowing, the 256-char boundary, strict-shorter check, and empty-input rejection are correct and covered (`toon-codec.test.ts`).
- LRU behaviour (recency refresh, count bound, trimmed-key contract) is correct and covered (`toon-hooks.test.ts`).
- Shell quoting for restored *quoted* payloads is safe: replacement uses single-quoted JSON with `'\''` escaping, `$'…'` is skipped, and inserted text is never rescanned (`src/tools/toon-hooks.ts:180-183`, `:279-292`).
- Hook registration, cleanup ordering, and the "no tools/commands/prompts, no transforms" contract are enforced by `registration.test.ts`; the 12-tool surface is unchanged and described in `src/mcp/instructions`/`stdio.ts:25-27`.
- No secrets, tokens, or raw payloads are logged by the new code; stdout stays clean in the MCP server. The cache is process-local and never persisted.
- `@toon-format/toon` 4.4.0 is bundled into both artifacts with no bare import at load time (`tsdown.config.ts:45`), and `package.json:67` / `pnpm-lock.yaml` agree with R1.
- MCP error results remain plain text with `isError: true`; `parseToolText` in the test helper refuses bare-scalar TOON so prose cannot pass silently.

## Suggested Next Steps

- [x] Fix the P1 unquoted-heredoc restoration (quoted-marker-only, or escape) and add the regression test.
- [x] Decide the P2 sniffer scope, then align `AGENTS.md`, `LOADING.md`, `README.md`, and `skills/dh-execute-cli/SKILL.md` wording.
- [x] Encode the JSON-normalized value in `tryEncodeToon`.
- [x] Bound cache entry size (and document it).
- [x] Extract the `plugin.ts` hook bodies into testable handlers and cover them.
- [x] Re-run `pnpm test`, `pnpm build`, and the package smokes after fixes.

## Remediation Applied

- **P1 unquoted heredocs:** `restoreForwardedCommand` now rewrites only
  quoted-marker heredocs (`<<'EOF'`, `<<"EOF"`); unquoted `<<EOF` blocks are
  skipped whole because shell expansion would corrupt restored JSON. Tests cover
  both plus `$`/backslash payloads.
- **P1/P3 quadratic scan:** the heredoc reader uses an opener-only sticky regex,
  `indexOf` for the closing marker, a failed-marker memo, and an 8× command
  budget. A 256 KB adversarial opener test stays unchanged and fast.
- **P2 JSON normalization:** `tryEncodeToon` encodes `JSON.parse(jsonText)` so
  `undefined` properties are omitted exactly as JSON does.
- **P2 cache bounds:** the cache stores JSON only, is a true LRU (hits and
  re-stores refresh recency), and skips entries above `TOON_MAX_ENTRY_CHARS`
  (256 KiB) while still emitting TOON.
- **P2 sniffer/docs:** `looksLikeToon` accepts tabular, primitive-array, and
  key-value TOON roots. README/AGENTS/LOADING/skill wording now says quoted
  heredocs only, object/array payloads, and tabular/array-header detection.
- **P2 hook gates:** `handleAfterHook`/`handleBeforeHook` are pure, tested
  handlers; `plugin.ts` only registers them. Tests cover status errors,
  ineligible tools, non-bash input, missing/non-string commands, and mutation.
- **P3 tool note:** `TOON_NOTE` now states the 256-character/object-array
  condition; the server test checks the threshold words.
- **P3 reuse:** `tryEncodeToonText` centralizes the JSON-text gate; the restore
  suite uses production `shellSingleQuote`; shared `logged_command` fixtures
  live in `helpers/toon-fixtures.ts`; jscpd is back to 0 clones.
- **Re-verified:** 70 files / 1186 tests, typecheck, build, Biome, knip, jscpd
  (0), dependency-cruiser, links, audit PASS, smoke-load/mcp/install/pack, OSV
  0 issues, Semgrep 0 findings.

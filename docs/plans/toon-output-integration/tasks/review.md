---
title: Final Plan Review — TOON Output Integration
slug: toon-output-integration-final-review
description: Binding final sign-off review of the TOON output integration against sdd.md (R1–R9/AC1–AC8), the plan, and the full diff.
tags: [review, final, plan]
project: dev-harness-skills
stack: TypeScript + MCP SDK + @opencode/plugin + @toon-format/toon 4.4.0
created: 2026-11-16
updated: 2026-11-16
status: active
---

# Final Plan Review: TOON Output Integration

**Plan slug:** `toon-output-integration`
**Reviewed range:** `5bde6c3..1d91bee` (feature commits `eb3113a`→`5e4c7c0`, merge `1d91bee`); 43 files, +3519/−207
**Requirements source:** [`sdd.md`](../sdd.md)
**Final-review role:** `dh-final-reviewer` (plan `## Agent Selection`) — this review
**Overall risk:** Medium (automatic output-format change on two surfaces; process-boundary limitation documented and tested)
**Verdict:** **Approve with comments**

> Status at review time: the plan, fast mirror, and Execution Record are `Completed`,
> the `docs/plans/index.md` row is present, `package.json`/`CHANGELOG.md` are
> released at `0.10.0` (`b545ad0`), and the branch is merged into `develop`
> (`1d91bee`). The working tree was clean before this report was written. This
> report refreshes the committed review with independent post-merge verification;
> no implementation or plan content was changed.

## Plan Completion Status

| Phase | Sub-tasks | Delegated agents | Status |
|---|---|---|---|
| Phase 1 — TOON core and MCP output | 1.1, 1.2, 1.3 | dh-software-engineer | Completed (3/3) |
| Phase 2 — Native bash hooks and restoration | 2.1, 2.2, 2.3 | dh-software-engineer | Completed (3/3) |
| Phase 3 — Documentation, packaging, verification | 3.1, 3.2, 3.3 | dh-documentor, dh-software-engineer | Completed (3/3) |

- All 9 sub-tasks carry a `Delegated to agent` value that matches an agent in
  `## Agent Selection`; no phase was closed around an open sub-task.
- `dh_plan_fast_read`/`dh_plan_fast_sync` (plan-end, dry run): `aligned: true`,
  `differences: []`, `stale: false`; both files show the same 3 phases / 9
  sub-tasks as `Completed`.
- Execution Record is present, `Completed`, and agrees with the diff
  (`workspace`, path `.`, branch `feature/toon-output-integration`,
  `5bde6c3..b545ad0`).

## Requirements Verification

| ID | Status | Evidence |
|---|---|---|
| R1 — pin/bundle `@toon-format/toon` 4.4.x | PASS | `package.json` `4.4.0` + lockfile; `tsdown.config.ts` `alwaysBundle`; TOON present in `dist/plugin.js`/`dist/mcp/stdio.js`; `rg` finds no bare import; `smoke-load`/`smoke-pack` pass. |
| R2 — shared safe codec (object/array, JSON ≥256 chars, TOON strictly shorter) | PASS | `src/lib/toon.ts` (`tryEncodeToon`, `encodeJson`, `decodeToon`, `looksLikeJson`, `looksLikeToon`); `toon-codec.test.ts` covers 256 boundary, non-shorter, invalid, primitives, circular/BigInt, `undefined` normalization. |
| R3 — automatic MCP `textResult` TOON; errors plain | PASS | `src/mcp/tool-results.ts` single conversion point; `errorResult`/`isError` unchanged; `mcp-toon.test.ts` 9 tests; MCP errors asserted raw. |
| R4 — native `execute.after`/`execute.before`; default `bash`; env override | PASS | `src/plugin.ts` registers exactly two hooks; `getEligibleTools` default `bash`, trims/lowercases `OPENCODE_TOON_PLUGIN_TOOLS`, empty falls back; eligibility + handler tests. |
| R5 — quoted/heredoc restoration; exact → valid TOON; edited/invalid untouched | PASS | `src/tools/toon-restore.ts`: quoted strings, quoted-marker heredocs, exact LRU hit first, strict decode fallback; unquoted heredocs/text, `$'…'`, `\x` escapes, >1 MiB commands inert; restore suite 13 tests. |
| R6 — cache bounded to 100 entries, hashed key | PASS | `src/tools/toon-cache.ts` SHA-256(trimmed TOON) key, 100-entry LRU with oldest-eviction; extra 256 KiB per-entry cap; eviction/recency/re-store tests. |
| R7 — no tools/commands/prompts or transforms | PASS | `plugin.ts` only agent/skill transforms + two `tool.hook` calls; `registration.test.ts` asserts 6 agents, 27 skills, `['execute.after','execute.before']`, zero tool transforms, command-domain guard, cleanup disposes both. |
| R8 — tests for every contract point | PASS | `toon-codec`, `toon-hooks`, `toon-restore`, `mcp-toon`, `registration`, MCP server/sheet suites; full run 70 files / 1186 tests green. |
| R9 — docs describe behavior/limits | PASS | `README.md`, `AGENTS.md`, `docs/LOADING.md` (TOON section), `opencode.example.jsonc`, `skills/dh-execute-cli/SKILL.md`, `CHANGELOG.md`; quoted-marker-only, 256 KiB entry cap, 1 MiB scan cap, process boundary, JSON canonical. |
| AC1 — large uniform MCP payload → TOON, decode equals original | PASS | `mcp-toon.test.ts` unit + `read_sheet` integration; `decodeToon(text)` equals the payload. |
| AC2 — <256 chars / invalid / non-shorter stays JSON | PASS | Codec and MCP tests; 255-char, non-shorter nested, invalid text, short `read_sheet`. |
| AC3 — compression only for eligible tools, default `bash` | PASS | `handleAfterHook` status/eligibility gates; env-override test; ineligible `shell` untouched. |
| AC4 — exact/valid/edited-invalid forwarded restoration | PASS | Cached TOON → byte-identical (trimmed) JSON; unknown clean TOON → JSON equivalent; edited-invalid, unquoted, unquoted-heredoc unchanged; apostrophe quoting tested. |
| AC5 — cache bound/eviction | PASS | 101st insert evicts; hit and re-store refresh recency (LRU, permitted by R6). |
| AC6 — two hooks, zero transforms, existing registration intact | PASS | Registration test; 12-tool server test unchanged; 6/27 corpus. |
| AC7 — full local gate green | PASS | Re-run: tests 70/1186, `tsc --noEmit`, `pnpm build`, audit PASS (0 FAIL, 0 high-signature secrets, 0 junk), links green (467 refs at the gate, 469 with this report), smoke load/MCP/install/pack, frozen-lockfile check. Docker scans reused from the recorded gate (OSV 669 packages / 0; Semgrep 90 rules, 198 files / 0). |
| AC8 — docs and close-out notes | PASS | README/AGENTS/LOADING/CHANGELOG/example/skill note; evolution + observation notes exist with valid frontmatter and `docs/evolution/index.md` rows; link check green. |

## Findings

### P0 — Blocking

None.

### P1 — High

None. The original code-review P1 (unquoted-heredoc bodies rewritten, letting the
shell expand/execute payload content) is fixed: `readHeredoc` returns the
original slice when the marker is unquoted (`toon-restore.ts`), and tests cover
`<<JSON` byte-identity versus `<<'JSON'`/`<<-"JSON"` restoration. The remediation
was re-reviewed APPROVE with no residual P0/P1/P2.

### P2 — Medium

None remaining. Remediation verified: JSON-normalized encoding (`undefined`
properties omitted), JSON-only true-LRU cache with 256 KiB per-entry cap,
widened TOON sniffer for primitive-array/key-value roots, pure tested hook
handlers, linear heredoc scan with failed-marker memo + 8× budget, precise
`TOON_NOTE` threshold wording.

### P3 — Low (non-blocking)

1. **Heredoc marker recognition is narrower than the shell.** `<<-` with
   tab-indented terminators and markers containing `-` are not matched
   (`HEREDOC_OPENER` uses `[A-Za-z_][A-Za-z0-9_]*` and `heredocBounds` does not
   strip `<<-` tabs). An unrecognized heredoc body is scanned as command text;
   a probe confirms that a *quoted* TOON-like body line inside a
   `<<-'JSON'` … `\tJSON` block is rewritten, so “byte-identical” holds for
   unquoted bodies but not for that narrow construct. No expansion/execution
   risk (the rewrite is single-quoted); ordinary unquoted TOON bodies are
   unchanged.
2. **`src/mcp/server.ts` is 306 lines** (281 at the plan base), the only source
   file above the repo’s ≤300 convention, due to `TOON_NOTE`/`withToonNote` and
   12 wrappers. Maintainability only; no behavior impact.
3. **Exact restore returns the trimmed JSON.** The cache stores `text.trim()`, so
   “byte-for-byte” applies to the payload text emitted by the tools; JSON padded
   with surrounding whitespace would lose the padding. No harness tool emits
   padded JSON.
4. **CHANGELOG precision.** The `[0.10.0]` entry says restoration covers
   “heredoc bodies” without the “quoted-marker” qualifier; README, LOADING, and
   AGENTS.md are precise.
5. **Bookkeeping.** The plan’s `Final Integration & Verification` checklist
   boxes remain unticked while `tasks/final-verification.md` records every check
   PASS. The verification file is authoritative; ticking at close-out would
   remove the inconsistency.

## Release Readiness

- **Artifact check:** PASS — build emits plugin/MCP/CLI/TUI bundles; TOON bundled
  with no bare specifier; 6 agents / 27 skills; packed tarball installs offline.
- **Preflight:** PASS — tests 70/1186, Biome, knip, jscpd 0, dependency-cruiser,
  links, audit, and all four smokes green; `pnpm install --frozen-lockfile`
  consistent. Docker scans: recorded PASS (OSV 0, Semgrep 0) — not re-run here.
- **Semver:** minor, already applied as **0.10.0** (`b545ad0`); changelog
  compares `v0.9.0...v0.10.0`. No tag/push on the feature branch; tagging
  belongs on `main` per Git Flow.
- **Security:** no secrets/tokens/credentials in the diff; audit secret scan 0
  high-signature hits; the TOON helpers and hooks log no payloads or commands;
  cache is process-local and never persisted.
- **Rollback:** revert `eb3113a..5e4c7c0` (or the merge `1d91bee`); no schema,
  on-disk format, or migration exists to roll back.

## Integration Assessment

- Cross-sub-task integration is coherent: one shared codec feeds the MCP
  `textResult` conversion point, the native after/before hooks, and the restore
  fallback; the shared MCP test helper parses JSON then strict TOON without
  weakening assertions; registration, descriptions, instructions, docs, and
  close-out notes agree on one contract (256 chars, object/array, strictly
  shorter, quoted-marker heredocs, LRU 100 + 256 KiB, JSON canonical).
- Contract counts are unchanged: 12 MCP tools, 6 agents, 27 skills; errors stay
  plain text with `isError`.
- Residual risk is the deliberate MCP text-format change for large payloads,
  documented and covered by the updated test contract; failure paths are inert
  and never throw into the host.

## Sign-off Verdict

**Verdict:** **Approve with comments**
**Recommendation:** **Merge** — requirements and acceptance criteria are met;
no P0/P1/P2 findings. The P3 items are optional follow-ups (heredoc-marker
breadth, `server.ts` length, changelog wording, checklist bookkeeping) and do
not block release.

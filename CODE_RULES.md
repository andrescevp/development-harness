# CODE_RULES.md

Repo rules derived from `AGENTS.md`, `tsconfig.json`, `biome.json`, and the
existing `src/` modules. Applies to all new code; follow the nearest existing
module when in doubt.

## Language and runtime

- TypeScript strict (`strict`, `noUncheckedIndexedAccess`), ESM, Node >= 20.11.
- Relative imports carry the `.js` extension; type-only imports are explicit.
- No new runtime dependencies unless the plan requires them (`jsonc-parser` is
  the only planned addition for the installer).
- Avoid `any`; use discriminated unions, `unknown` at boundaries, and narrow
  before use.

## Structure

- Files stay at or below 300 lines; one responsibility per module.
- Pure logic (parsing, resolution, comparison) is separate from I/O, process
  state, and output.
- Entry modules are side-effect free on import and run only when they are the
  process main entry (realpath-based `isMainEntry` guard).
- Validate at boundaries; return typed results or throw typed errors. Never
  call `process.exit` deep inside a library or parser.
- Error messages are descriptive and actionable; wrap with `cause` when
  rethrowing. Never print stack traces, environment dumps, or secrets.

## Style

- Biome: single quotes, 2-space indent, 120-column lines, es5 trailing commas,
  LF. Run `pnpm exec biome check --write <paths>` after edits.
- Each module starts with a JSDoc header describing purpose and contract;
  comments explain *why*, not *what*.
- `camelCase` values, `PascalCase` types, `UPPER_SNAKE_CASE` constants.
- CLI output is ASCII-only and deterministic; diagnostics go to stderr, machine
  output to stdout.

## Testing

- TDD: write the failing test first, then the minimal implementation.
- Vitest; table-driven cases for argument and state matrices.
- Tests never touch the real `$HOME`, repo config, or network. Use temp dirs and
  clean them in `finally`.
- Assert exit codes and exact error messages for usage failures.

## Security

- Never log env/config bodies, credentials, tokens, or full file contents.
- Confine filesystem writes to the resolved scope; no shell interpolation from
  user input.

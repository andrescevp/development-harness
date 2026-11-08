# Verification — Sub-Task 5.1 (real-session verification)

Evidence for the shipped MCP path, captured on the host below. Commands and
outputs are recorded verbatim (ANSI escapes stripped where noted); durations
are wall-clock milliseconds measured with `date +%s%N` around the command.

## Environment

| Item | Value |
|---|---|
| Date | 2026-10-19T15:28:51+02:00 |
| Branch / HEAD | `feature/plugin-tools-to-mcp` @ `069eba8` (working tree plus orchestrator status edits) |
| node | v24.18.0 |
| pnpm | 11.9.0 |
| npm | 11.16.0 |
| opencode | opencode v2.0.18 |
| Host | CachyOS (Linux), Intel i9-11900K |

## 1. Build

Command:

```sh
pnpm build
```

Exit: `0`. Tail:

```text
> dev-harness-skills@0.4.0 copy-assets
> node scripts/copy-assets.mjs

[copy-assets] agents 7 | skills 17 SKILL.md + index.md yes
[copy-assets] OK — assets synced to dist/assets
```

Artifacts + sentinel:

```text
229940 dist/mcp/stdio.js
208381 dist/plugin.js
25     dist/.build-ok
2026-10-19T13:23:57.146Z
```

```text
1092d764148e32608bc5b0a107d91662b9afca704b1fbf5ff745196cb33eb18e  dist/plugin.js
77f774316ec192d2d762a859b323b6d2a61fb8def7d10867945e299a51caf069  dist/mcp/stdio.js
```

## 2. Demo validation (fresh data dir)

Command (from `demo-project/`; `demo.sh` creates a fresh `XDG_DATA_HOME` per
opencode invocation and the persistent `dh` MCP child was absent before the
run — `pgrep -af opencode` showed only the TUI + `opencode serve --service`):

```sh
./demo.sh validate
```

Exit: `0` — duration **2670 ms**. Full output:

```text
[demo] 1/5 opencode version: opencode v2.0.18
[demo] 2/5 demo config resolved (plugins + agent map):
      OK — demo-project/opencode.jsonc is part of the resolved config.
[demo] 3/5 agent visibility (fresh server):
      agents visible: 7/7
[demo] 4/5 MCP server connectivity (project-scope, fresh data dir):
      MCP GATE: ✓ dh               connected
[demo] 5/5 in-process registration gate (harness test suite):
      IN-PROCESS GATE:       Tests  181 passed (181) — registration OK
[demo] validation complete.
```

The project-scope assertion (resolved config contains
`../dist/mcp/stdio.js`) passed as part of step 4.

## 3. Live session tool call (AC4)

CLI discovery: `opencode --help` / `opencode run --help` show
`opencode run [flags] [<message...>]`, with `--standalone` (private server
instead of the background service), `--auto`, `--format`, `--title`, `--model`.

Command (from `demo-project/`, fresh data dir, 180 s bound):

```sh
XDG_FRESH=$(mktemp -d /tmp/opencode/verify-XXXXXX)
timeout 180 env XDG_DATA_HOME="$XDG_FRESH" opencode run --standalone --auto \
  --title "verification-5.1" \
  "Call the MCP tool dh_plan_create with exactly these arguments: {\"slug\":\"verification-scratch\",\"title\":\"Verification Scratch\",\"objective\":\"Prove the shipped MCP path\",\"phases\":[{\"title\":\"Proof\",\"subTasks\":[{\"title\":\"Call plan_create\"}]}]}. Then print the exact tool result JSON (the { ok, path, plan } payload) and stop. Do not do anything else."
```

Exit: `0` — duration **11964 ms**. XDG dir used: `/tmp/opencode/verify-vqqSZn`.
Model reported by the session: `general · minimax-m3.1-flash-free`.

Transcript excerpt (ANSI escapes stripped):

````text
> general · minimax-m3.1-flash-free
I'll find the MCP tool first, then call it with the exact arguments.
⚙ execute {"code":"const r = await search({ query: \"dh_plan_create\" });\nreturn r;"}
> general · minimax-m3.1-flash-free
The catalog now includes the `dh` server. Let me find the `plan_create` tool signature.
⚙ execute {"code":"const r = await search({ query: \"plan_create\", namespace: \"dh\" });\nreturn r;"}
> general · minimax-m3.1-flash-free
Found it. Now calling with the exact arguments.
⚙ execute {"code":"const result = await tools.dh.plan_create({\n  slug: \"verification-scratch\",\n  title: \"Verification Scratch\",\n  objective: \"Prove the shipped MCP path\",\n  phases: [\n    { title: \"Proof\", subTasks: [{ title: \"Call plan_create\" }] }\n  ]\n});\nreturn result;"}
> general · minimax-m3.1-flash-free
The tool result JSON:

```json
{
  "ok": true,
  "path": "/home/andres/workspace/dev-harness-skills/demo-project/docs/plans/verification-scratch/plan.md",
  "plan": {
    "meta": {
      "title": "Verification Scratch",
      "slug": "verification-scratch",
      "description": "Verification Scratch",
      "created": "2026-10-19",
      "updated": "2026-10-19",
      "status": "Pending",
      "active": true,
      "tags": ["plan"],
      "project": "verification-scratch"
    },
    "title": "Verification Scratch",
    "phases": [
      {
        "index": 1,
        "title": "Proof",
        "status": "Pending",
        "subTasks": [
          {
            "index": "1.1",
            "phase": 1,
            "number": 1,
            "title": "Call plan_create",
            "status": "Pending",
            "relatedRequirements": ["[Requirement IDs]"]
          }
        ]
      }
    ]
  }
}
```
````

On-disk check after the run:

```text
-rw-r--r-- 1 andres andres 1572 oct 19 15:25 docs/plans/verification-scratch/plan.md
```

Cleanup: `rm -rf demo-project/docs/plans/verification-scratch` (scratch only;
`updateIndex` was not set, so no index row was appended).

## 4. Cold npx timing (local proxy for the git spec)

The `github:` spec resolves the remote default branch, which does not contain
this branch pre-release, so the equivalent local `file:` install was measured.

Cache clear:

```sh
npm cache npx rm --force
```

```text
npm warn using --force Recommended protections disabled.
```

Cold run (wall **752 ms**, exit `0`, stdout **0 bytes**):

```sh
npx -y --package=file:/home/andres/workspace/dev-harness-skills dev-harness-mcp < /dev/null
```

stderr:

```text
[dev-harness-mcp] serving on stdio (workspace resolves per connection)
```

Warm run, same command without clearing (wall **1046 ms**, exit `0`, stdout
**0 bytes**, same stderr banner).

Install/build observations:

- npm created an npx cache entry with a **symlink** dependency, not a tarball:
  `~/.npm/_npx/17e49dccfe37ff7c/node_modules/dev-harness-skills -> ../../../../workspace/dev-harness-skills`;
  the cache package.json records `"dev-harness-skills": "file:../../../workspace/dev-harness-skills"`.
- Because the local directory form is symlinked, `files: ["dist"]` is not
  applied to it (the whole package directory is visible, `dist/` included).
- **No `prepare` build was observed** on the cold run (no build output, sub-1 s
  wall time). A true `github:` cold install would clone + install + run
  `prepare` (tsup runtime build when `dist` is absent), so these timings are a
  lower bound for the network path.

Decision: **keep the documented `"timeout": { "startup": 300000 }` guidance**
(measured local cold path ≈ 0.75 s; the remote git path adds clone/install/
build/network latency, for which 300 s remains a safe ceiling). No docs change
required.

## 5. AC6 grep (stale references)

```sh
rg -n 'dh\.(plan_read|plan_update_status|plan_create|logged_command|read_sheet|update_sheet|sheet_schema)' --glob '!docs/plans/**' --glob '!docs/evolve/**' --glob '!node_modules'
```

Result: no output; `rg` exit `1` (= zero matches). ✅

## 6. Snippet identity

Method: whitespace-normalized regex per file (collapse `\s+` to one space),
then check each canonical field independently: `"type": "local"`,
`"command": ["npx", "-y", "--package=github:andrescevp/development-harness", "dev-harness-mcp"]`,
`"protocol": "2026-07-28"`.

```text
README.md: type=true command=true protocol=true
docs/LOADING.md: type=true command=true protocol=true
opencode.example.jsonc: type=true command=true protocol=true
skills/dh-setup/SKILL.md: type=true command=true protocol=true
demo-local: command=true protocol=true
demo resolves: /home/andres/workspace/dev-harness-skills/dist/mcp/stdio.js
```

Demo copy (`demo-project/opencode.jsonc`) intentionally differs: it uses the
local build `["node", "../dist/mcp/stdio.js"]`, which resolves from the demo
workspace to the repo artifact shown above.

## Cleanup / final state

- Scratch plan removed; temp XDG data dirs removed.
- npx cache left warm (allowed).
- `git status` (orchestrator-owned status edits to `plan.md` / `tasks/review.md`
  were present before this sub-task; the only file added here is this
  verification record).

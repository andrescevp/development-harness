---
title: TUI API Notes — Verified Against Installed Packages
slug: tui-plan-progress-tui-api-notes
description: Exact, verified OpenCode V2 TUI plugin API surface for the dev-harness-skills TUI part — versions, package loading, slots/panels, keymaps, storage, session data/events, theme tokens — with every fallback and blocker named.
tags: [notes, tui, opencode, api, plan-progress, solid, opentui]
project: dev-harness-skills
plan: docs/plans/tui-plan-progress/plan.md
sdd: docs/plans/tui-plan-progress/sdd.md
created: 2026-11-15
updated: 2026-11-15
status: active
---

# TUI API Notes — Verified Against Installed Packages

Evidence base for sub-task 1.1 (R1, R2, R3, R5, R6). **Nothing here is guessed**:
every type is quoted from a package on disk or a downloaded tarball, and the
compile claims were reproduced with `tsc` (see §12). Each section marks
`[verified]` (read in a file / compiled) or `[docs-only]` (documentation claim,
not reproducible from installed code).

Read alongside: [`plan.md`](plan.md), [`sdd.md`](sdd.md),
[`../harness-monorepo-awareness/workspace-contract.md`](../harness-monorepo-awareness/workspace-contract.md)
(plan root / workspace anchoring — the TUI reads `W/docs/plans` like every other
skill, never a package-local tree).

## 1. Versions — installed vs host vs reference

`[verified]` via `node_modules`, `pnpm-lock.yaml` and `pacman -Qo`.

| Package | In this repo | Host runtime | Status |
|---|---|---|---|
| `@opencode/plugin` | **2.0.20** (`dependencies`, direct) | opencode **2.2.7-1.1** (pacman) | installed |
| `@opencode/client` | **2.0.20** — transitive only, **not hoisted** (`node_modules/@opencode/client` does not exist; only `node_modules/.pnpm/@opencode+client@2.0.20_effect@4.0.0-rc.112/...`) | 2.2.7 | installed (indirect) |
| `@opencode/theme` | **missing** | 2.2.7 | optional peer of `@opencode/plugin`, required by `@opencode/plugin/tui` **types** |
| `@opentui/core` | **missing** | host-provided at runtime (runtime-module rewrite) | optional peer |
| `@opentui/solid` | **missing** | host-provided at runtime (runtime-module rewrite) | optional peer |
| `solid-js` | **missing** | host-provided at runtime (runtime-module rewrite) | optional peer |

**Consequence (blocker today):** `pnpm typecheck` cannot compile any file that
imports `@opencode/plugin/tui` because its `.d.ts` references
`@opencode/theme/tui`, `@opentui/core`, `@opentui/solid` and `solid-js`
(`dist/tui/context.d.ts:1-5`). This must be resolved in **1.3** (dev/peer deps);
it is not a bug in the harness.

**Peer declarations (exact, `[verified]`):**

```jsonc
// @opencode/plugin@2.0.20  (installed today)
"peerDependencies": {
  "@opencode/theme": "2.0.20",
  "@opentui/core": ">=0.5.12",
  "@opentui/solid": ">=0.5.12",
  "solid-js": ">=1.9.0"
}                                   // every entry optional (peerDependenciesMeta)

// @opencode/plugin@2.2.7  (matches the installed host)
"peerDependencies": {
  "@opencode/theme": "2.2.7",
  "@opentui/core": ">=0.8.1",
  "@opentui/solid": ">=0.8.1",
  "solid-js": ">=1.9.0",
  "electron": "*", "vite": ">=6", "vite-plugin-solid": ">=2.11"
}                                   // all 7 marked optional in peerDependenciesMeta
                                     // @opentui/solid@0.8.4|0.9.0 peer: solid-js ^1.9.12
                                     // @opentui/core@0.8.4 peer: web-tree-sitter 0.25.10
```

**Version drift — the important finding:** the installed typings (2.0.20) are
**older than the host** (2.2.7). The docs page targets the newer line (it
documents `dialog.select({ search, actions })`, absent from 2.0.20). Diffed
`dist/tui/context.d.ts` 2.0.20 vs 2.2.7 (`[verified]`):

- **Identical:** `Storage`, `Data`, `SlotMap`, `SlotClaim`, `PanelInput`,
  `Context`, `UI`, `KeymapCommand`, `KeymapLayer`, `Keymap` members, `Route`,
  `Page`, `App`, `Toast`, `Attention`, dialogs (except select), tabs, model.
- **Added in 2.2.7:** `DialogSelectAction`, `DialogSelectOptions.search`,
  `DialogSelectOptions.actions` (unused by this plan).
- **JSDoc-only change:** `Keymap.layer` now documents the "removal on
  deactivate/disposal", "factory must be pure", "runs once untracked" semantics.

⇒ Everything below is valid for both versions. **Recommendation for 1.3/4.1:**
align `@opencode/plugin` with the host (2.2.7+) before shipping, because peers
and `DialogSelect` differ; the TUI surface this plan uses does not.

## 2. Package loading — how `./tui` is discovered

`[verified]` in `@opencode/plugin/dist/host.js`:

```ts
export function resolve(target: { directory: string; name?: string }): Entrypoints {
  const entry = (subpaths) => { /* resolveModule(specifier, target.directory); try/catch elided */ };
  return { server: entry(["server", ""]), tui: entry(["tui"]), rpc: entry(["rpc"]) };
}
```

- **Package target** (`name` set): resolves `<name>/tui`, i.e. the package's
  **`exports["./tui"]`**. This is the contract for `dev-harness-skills` (it has
  both `name` and `exports`).
- **Directory target** (`name` unset): resolves `<directory>/tui`.
- `[docs-only]` "A local plugin directory with a `package.json` `name` and
  `exports` loads its parts through them, like the published package. Without
  them, it uses file names at its root: `server` (else `index`), `tui`, `rpc`
  with a `.ts`, `.tsx` or `.js` extension."
- `[docs-only]` "One entry loads every part. The TUI loads the TUI parts of the
  plugins its server loads." A package with **only** a TUI part goes in
  `cli.json`; a package with a server part does not need `cli.json`.
- `[docs-only]` "Discovered plugins can import `@opencode/plugin/tui` directly;
  OpenCode resolves the package at runtime."

**Runtime module resolution — why peers are externalized `[verified]`:**
`@opentui/core/dist/runtime-plugin.js` header states it exposes *runtime-only
modules* "(`@opentui/core`, `@opentui/solid`, `solid-js`) to externally loaded
plugins by rewriting matching imports to virtual `opentui:runtime-module:*`
ids"; `@opentui/solid/runtime-plugin-support/configure.js` registers
`@opentui/solid`, `@opentui/solid/jsx-runtime`, `@opentui/solid/jsx-dev-runtime`,
`@opentui/solid/components`, `solid-js`, `solid-js/store`. `@opencode/util`'s
`#runtime-import` maps to `import.bun.js` by default ⇒ the host loads plugins
under Bun and injects its own OpenTUI/Solid instances.

⇒ **Bundle-vs-peer decision for 1.3:** mark `solid-js`, `@opentui/core`,
`@opentui/solid` as **external** and declare them as peers/devDependencies —
bundling a second `solid-js` would split reactivity/context, and bundling
`@opentui/core` would create renderables in a non-host instance. `Plugin.define`
itself is a pure identity function (`dist/tui/plugin.js`: `return plugin`), so
importing `@opencode/plugin/tui` is safe either way.

**Unresolved (1.3 spike):** whether a **managed install without `node_modules`**
resolves peer specifiers. Host rewriting covers `solid-js`/`@opentui/*`/
`@opencode/plugin/tui`, but the managed artifact must at least not *require*
them at import time. Verify by loading a built `dist/tui.js` from a directory
with no `node_modules`.

## 3. TUI plugin definition

`[verified]` `node_modules/@opencode/plugin/dist/tui/plugin.d.ts` (whole file):

```ts
export type Cleanup = () => Promise<void> | void;
export interface Definition {
  readonly id: string;
  readonly setup: (context: Context) => Promise<Cleanup | void> | Cleanup | void;
}
export declare function define(plugin: Definition): Definition;
```

`dist/tui/index.d.ts` (whole file): `export * as Plugin from "./plugin.js"` and
`export { PluginContextProvider, usePlugin } from "./solid.js"`.

⇒ Shape for 3.3 (default export, not named):

```tsx
import { Plugin } from "@opencode/plugin/tui";
export default Plugin.define({ id: "dev-harness-skills.tui", setup(context) { /* ... */ return cleanup; } });
```

`usePlugin(): Context` (`dist/tui/solid.js`) reads a Solid context and **throws
`"PluginContextProvider is missing"`** outside a host-rendered component — safe
inside a slot/route/dialog render, not at setup time (use the `setup(context)`
argument there).

## 4. `Context` surface (exact)

`[verified]` `dist/tui/context.d.ts:458-474`:

```ts
export interface Context {
  readonly options: Readonly<Record<string, any>>;      // plugin options from config
  readonly location: LocationRef | undefined;           // NOT guaranteed
  readonly app: App;                                    // { version: string; channel: string }
  readonly renderer: CliRenderer;                       // @opentui/core
  readonly client: OpenCodeClient;
  readonly data: Data;
  readonly attention: Attention;
  readonly theme: ResolvedTheme;                        // @opencode/theme/tui
  readonly themeMode: "dark" | "light";
  readonly markdown: { registerCodeBlockRenderer(language: string, render: MarkdownCodeBlockRenderer): () => void };
  readonly keymap: Keymap;
  readonly storage: Storage;
  readonly ui: UI;
}
```

`LocationRef` `[verified]` (`@opencode/client/dist/promise/generated/types.d.ts:281`):
`{ directory: string; workspaceID?: string }`.

## 5. Slots — placement API and inputs

`[verified]` `dist/tui/context.d.ts:161-179` — exactly **10** slot paths:

```ts
export interface SlotMap {
  readonly app: Readonly<Record<string, never>>;
  readonly "home.footer": Readonly<Record<string, never>>;
  readonly "home.footer.status": Readonly<Record<string, never>>;
  readonly "prompt.footer": PromptFooterInput;         // { sessionID?, mode, showDetails }
  readonly "prompt.footer.status": PromptFooterInput;
  readonly "prompt.footer.file": PromptFooterInput;
  readonly "session.composer.top": { readonly sessionID: string };
  readonly "session.panel": PanelInput;
  readonly "sidebar.content": { readonly sessionID: string };
  readonly "sidebar.footer": { readonly sessionID: string };
}
export type SlotPath = keyof SlotMap;
```

`[verified]` `dist/tui/context.d.ts:199-231` — one placement key, mutually
exclusive via `?: never`:

```ts
export type SlotClaim<Path extends SlotPath = SlotPath> = Path extends SlotPath
  ? { readonly render: (input: SlotMap[Path]) => JSX.Element } &
      ( { readonly prepend: Path; append?: never; before?: never; after?: never; replace?: never }
      | { readonly append:  Path; prepend?: never; before?: never; after?: never; replace?: never }
      | { readonly before:  Path; prepend?: never; append?: never; after?: never; replace?: never }
      | { readonly after:   Path; prepend?: never; append?: never; before?: never; replace?: never }
      | { readonly replace: Path; prepend?: never; append?: never; before?: never; after?: never } )
  : never;
```

`UI.slot` `[verified]` (`:456`): `readonly slot: (claim: SlotClaim) => () => void;`
— the returned function **removes the claim**; call it from `setup`'s cleanup.

Placement semantics `[verified]` from the `SlotClaim` JSDoc:

- `prepend`/`append` — first/last **inside** the target boundary.
- `before`/`after` — siblings **outside** the boundary.
- `replace` — takes over the target; original content and inner claims are
  suppressed (recorded, not silently dropped); last-enabled claim wins at one
  target; an ancestor replacement beats a descendant one.
- A claim aimed at a path the host no longer publishes degrades: additive
  claims append to the nearest surviving ancestor, replacements are suppressed.
- Several claims at one anchor coexist in **plugin enable order**.

**`sidebar.content` render props: exactly `{ sessionID: string }`** — no width,
no theme, no session object. Width-aware rendering must come from elsewhere (§11).

## 6. Session panels

`[verified]` `dist/tui/context.d.ts:137-149` (whole type):

```ts
export type PanelPresentation = "panel" | "fullscreen";
/** Client-local state of the selected session panel. The host owns its layout and input scope. */
export interface PanelInput {
  readonly name: string;            // selected content name, set by ui.panel.open
  readonly sessionID: string;
  readonly width: number;
  readonly presentation: PanelPresentation;
  readonly focused: boolean;
  readonly focus: () => void;
  readonly close: () => void;
  readonly toggleFullscreen: () => void;
}
```

`[verified]` `dist/tui/context.d.ts:407-419`:

```ts
readonly panel: {
  /** Opens the session.panel slot in the current session. */
  open(name: string, options?: { readonly presentation?: PanelPresentation }): boolean;
  /** Closes this plugin's active panel. Other plugins' panels are unaffected. */
  close(): void;
  /** This plugin's active panel, if any. Reactive when read in a Solid computation. */
  current(): { readonly name: string; readonly sessionID: string } | undefined;
};
```

**There is no `context.ui.panel.toggleFullscreen`** — fullscreen/toggle lives on
`PanelInput` (fallback table, §13). `[docs-only]` extras worth knowing:

- Opening outside a session returns `false`.
- The selected `name` reaches **every** `session.panel` contribution; each
  decides whether to render (filter with `panel.name === "dev-harness-skills.plan"`).
- Names are shared **selection values**, not registrations: opening a name with
  no matching renderer leaves the slot empty. Prefix it to avoid collisions.
- Changing presentation preserves mounted contributions; closing disposes them.
- Panel keymaps/input modes are active only while the panel owns input.
- The host keeps narrow terminals full-screen; `toggleFullscreen` is a no-op
  until there is room for a side panel.

Pattern `[verified]` (compiled, §12): `append` the contribution and open from a
command — the panel is *not* auto-opened.

## 7. Commands and keymaps

`[verified]` `dist/tui/context.d.ts:323-363`:

```ts
export interface KeymapCommand {
  readonly id?: string;                       // omit for an inline command
  readonly title?: string;                    // discovery + keyboard help
  readonly description?: string;
  readonly group?: string;
  readonly enabled?: boolean | (() => boolean);
  readonly bind?: false | string;             // auto-binding, or disable one for a named command
  readonly palette?: true;                    // command palette
  readonly slash?: { readonly name: string; readonly aliases?: string[]; readonly arguments?: true };
  readonly suggested?: boolean | (() => boolean);
  readonly run: (input?: string, event?: KeyEvent) => void | false | Promise<void>; // false => continue dispatch
}
export interface KeymapLayer {
  readonly mode?: string;                     // one OpenCode input mode; "global" opts out; default "base"
  readonly enabled?: boolean | (() => boolean);
  readonly target?: () => Renderable | null | undefined;  // limit to a focused renderable
  readonly priority?: number;
  readonly commands?: readonly KeymapCommand[];
  readonly bindings?: readonly string[];      // ids whose configured bindings are active in this layer
}
```

`[verified]` `dist/tui/context.d.ts:375-395`:

```ts
export interface Keymap {
  layer(input: () => KeymapLayer): void;      // returns NOTHING — no per-layer disposer
  dispatch(id: string, input?: string): void;
  shortcuts(id: string): readonly string[];
  commands(): readonly KeymapCommand[];       // reactive in a Solid computation
  pending(): readonly KeymapPending[];
  active(): readonly KeymapActive[];
  readonly mode: { current(): string; push(mode: string): () => void };
}
```

**Disposal semantics (the trap):** `layer()` returns `void`. Per the 2.2.7 JSDoc
`[verified]` + docs `[docs-only]`, a layer is removed when **(a)** the plugin is
disabled/reloaded/fails setup, or **(b)** the component/reactive computation that
created it (slot, route, dialog) is disposed. So:

- a **global** command layer created in `setup` lives for the plugin's lifetime
  (fine, it is torn down with the plugin — no manual disposer exists);
- a **panel-scoped** layer belongs in the panel component body and dies with it;
- the factory must be **pure**, is evaluated once **untracked** to validate the
  command shape (a palette command without `id` throws synchronously), then
  reactively;
- gate with `enabled: () => panel.focused` when a layer must be inert.

## 8. Storage

`[verified]` `dist/tui/context.d.ts:6-22` (whole interface):

```ts
export interface Storage {
  /** Durable JSON state: persisted to disk, survives hot reloads and TUI restarts, live-synced across TUI instances. */
  store<Value extends object>(key: string, options: { readonly initial: Value }):
    readonly [Store<Value>, (mutation: (draft: Value) => void) => Promise<void>];
  /** Ephemeral in-memory state: survives plugin hot reloads (old and new generations share the same live store),
   *  gone when the TUI exits. Updates are synchronous and values need not be JSON-serializable. */
  memory<Value extends object>(key: string, options: { readonly initial: Value }):
    readonly [Store<Value>, (mutation: (draft: Value) => void) => void];
}
```

- `memory` updater is **synchronous** (`void`), `store` updater returns
  `Promise<void>`.
- `Value extends object` — store an object, e.g. `{ plan: PlanProgress | null }`,
  not a bare array/primitive.
- Use `memory` for the derived progress model + activity (R5: no disk writes,
  read-only TUI). `Store<Value>` is a Solid store ⇒ reads are reactive in JSX.

## 9. Location and session data

`[verified]` `dist/tui/context.d.ts:33-111`:

```ts
export interface Data {
  readonly on: <Type extends OpenCodeEvent["type"]>(type: Type, handler: (event: OpenCodeEventMap[Type]) => void) => () => void;
  readonly listen: (handler: (event: { details: OpenCodeEvent }) => void) => () => void;
  readonly session: {
    list(): SessionInfo[];
    get(sessionID: string): SessionInfo | undefined;
    root(sessionID: string): string;
    family(sessionID: string): string[];
    cost(sessionID: string): number;
    status(sessionID: string): "idle" | "running";        // <-- only two states
    sync(sessionID: string): Promise<void>;
    invalidate(sessionID: string): void;
    readonly pending: { list(sessionID: string): SessionInboxInfo[]; sync(...): Promise<void>; invalidate(sessionID: string): void };
    readonly message: {
      list(sessionID: string): SessionMessageInfo[];
      get(sessionID: string, messageID: string): SessionMessageInfo | undefined;
      sync(sessionID: string): Promise<void>;
      invalidate(sessionID: string): void;
    };
    readonly permission: { list(sessionID: string): PermissionRequest[] | undefined; /* sync, invalidate */ };
    readonly form: { /* list, sync, invalidate, reply, cancel */ };
  };
  readonly location: {
    default(): LocationRef;
    sync(location?: LocationRef): Promise<void>;
    invalidate(location?: LocationRef): void;
    readonly vcs: { info(location?: LocationRef): VcsInfo | undefined; /* sync, invalidate */ };
    readonly agent: LocationCollection<AgentInfo>;   // { list(location?), sync(location?), invalidate(location?) }
    readonly command: LocationCollection<CommandInfo>;
    /* ... integration, mcp.server, mcp.resource, model, provider, reference, skill */
  };
  readonly project: { /* list, get, sync, invalidate, permission */ };
  readonly shell: { /* list, get, sync, invalidate */ };
}
```

`[verified]` `Data.listen` in the TUI context yields **`{ details }` only**
(`@opencode/client`'s `createData` yields `{ name, details }` — do not assume
`name`).

**Status shape asymmetry (critical for 2.3):**

| Source | Type |
|---|---|
| `context.data.session.status(id)` | `"idle" \| "running"` (retry/busy collapse into `"running"`) |
| `session.status` event payload `data.status` | `{ type: "idle" } \| { type: "retry"; attempt; message; action?; next } \| { type: "busy" }` |

`[verified]` `SessionStatus` in `generated/types.d.ts`. The retry `message` is a
provider/error string — **never render verbatim** (privacy, §13).

**Reactivity `[verified]`:** `@opencode/client/dist/solid/data.js` → chunk
`shared-events-h11j9btw.js` uses `createSignal`/`createStore`, so `data.*` reads
inside a Solid computation track. Belt-and-braces: also subscribe with
`data.on(...)` and write into your own `storage.memory` signal (3.3/2.3).

`SessionInfo` `[verified]` (`generated/types.d.ts`): `id`, `parentID?`,
`projectID`, `agent?: string`, `model?: ModelRef`, `cost`, `tokens`,
`outcome?: "succeeded" | "failed" | "interrupted"`, `time: { created, updated,
idle?, viewed?, archived? }`, `title?`, `subpath?`, `metadata?`,
`permissions?`, `revert?`, `location: LocationPublicRef` — `agent` is the
session's selected agent (cheap fallback for the sidebar agent line).

## 10. Events — exact type names from the typings

`[verified]`: `OpenCodeEvent = EventSubscribeOutput = V2Event`
(`generated/types.d.ts:8045`, `:3346`); **153** event types expose a `type`
literal, **53** of them `session.*`. `data.on` is keyed by those literals.

Events relevant to the activity line (payload fields quoted from typings):

| `type` | Type | Payload `data` |
|---|---|---|
| `session.status` | `SessionStatusUpdated` | `{ sessionID, status: SessionStatus }` |
| `session.idle` | `SessionIdle` | `{ sessionID }` |
| `session.retry.scheduled` | `SessionRetryScheduled` | `{ sessionID, assistantMessageID, attempt, at, error: SessionStructuredError }` |
| `session.execution.started` | `SessionExecutionStarted` | `{ sessionID }` |
| `session.execution.succeeded` / `.failed` / `.interrupted` | `SessionExecution*` | `{ sessionID }` |
| `session.step.started` | `SessionStepStarted` | `{ sessionID, assistantMessageID, agent, model, snapshot?, started }` |
| `session.step.ended` | `SessionStepEnded` | `{ sessionID, assistantMessageID, finish, rawFinish?, cost, tokens, ... }` |
| `session.agent.selected` | `SessionAgentSelected` | `{ sessionID, agent, previous? }` |
| `session.tool.input.started` | `SessionToolInputStarted` | `{ sessionID, assistantMessageID, id, **name** }` |
| `session.tool.called` | `SessionToolCalled` | `{ sessionID, assistantMessageID, id, input, executed, state? }` — **no tool name** |
| `session.tool.progress` | `SessionToolProgress` | `{ sessionID, assistantMessageID, id, metadata }` |
| `session.tool.success` | `SessionToolSuccess` | `{ sessionID, assistantMessageID, id, content, metadata?, executed, resultState? }` |
| `session.tool.failed` | `SessionToolFailed` | `{ sessionID, assistantMessageID, id, error, content?, metadata?, executed, resultState? }` |
| `session.skill.activated` | `SessionSkillActivated` | `{ sessionID, id, name, text }` |
| `session.shell.started` / `.ended` | `SessionShell*` | `{ sessionID, shell: ShellInfo }` |
| `session.text.delta` | `SessionTextDelta` | `{ sessionID, assistantMessageID, ordinal, delta }` (message body — do not render) |
| `session.message.content.updated` | `SessionMessageContentUpdated` | `{ sessionID, messageID, content: Array<SessionMessageAssistantContentEncoded> }` |
| `permission.asked` / `permission.replied` | `PermissionAsked` / `PermissionReplied` | `{ id, ... }` |
| `form.created` / `form.replied` / `form.cancelled` | `Form*` | `{ form }` / … |
| `tui.prompt.append`, `tui.command.execute`, `tui.toast.show`, `tui.session.select` | `Tui*` | host→plugin TUI messages |
| `vcs.branch.updated` | `VcsBranchUpdated` | branch info at a location |

All events carry `{ id, created, metadata?, type, location?, data }` and most
`session.*` also carry `durable: { aggregateID, seq, version }`. Filter by
`event.location?.directory` when multiple locations may be active.

Sources for the activity line `[verified]` (`SessionMessageInfo`, `:3292`):

- Union members: `user`, `assistant`, `agent-switched`, `model-switched`,
  `location-switched`, `system`, `synthetic`, `skill`, `shell`, `compaction`,
  `idle`, `session.message.content.updated`.
- `SessionMessageAssistant`: `{ id, time, type: "assistant", agent: string,
  model: ModelRef, content: Array<…Text | …Reasoning | …Tool>, finish?, cost?,
  tokens?, error?, retry? }`.
- `SessionMessageAssistantTool`: `{ type: "tool", id, name, executed?, state }`
  where `state.status` is `"streaming" | "running" | "completed" | "error"`.
- `SessionMessageIdle`: `{ type: "idle", outcome: "succeeded" | "failed" | "interrupted" }`.

## 11. Formatting, theme tokens and the renderer

`[verified]` `dist/tui/context.d.ts:399-401`:
`format: { path(value: string): string }` — abbreviates the home directory;
the only formatting helper on the context.

`[verified]` theme tokens (`@opencode/theme@2.2.7` `dist/tui/types.d.ts`,
`ResolvedThemeTokens`; the host passes the resolved object as `context.theme`):

```text
theme.text.base | text.muted | text.faint
theme.text.action.primary|secondary|destructive → StatefulColor (RGBA + $hovered/…)
theme.text.formfield, theme.text.feedback.{error,warning,success,info}.{base,muted}
theme.background.base | background.raised.{base,high,max}
theme.background.action.* | background.formfield | background.feedback.*.base
theme.border.base | theme.scrollbar.base
theme.diff.{text,background,highlight,lineNumber}.*
theme.syntax.<SyntaxToken>   (comment|keyword|function|variable|string|number|type|operator|punctuation)
theme.markdown.<MarkdownToken> (text|heading|link|linkText|code|blockQuote|emphasis|strong|horizontalRule|listItem|listEnumeration|image|imageText|codeBlock)
theme.hue.<accent|interactive|neutral>.<100..900>, theme.categorical[]
theme.surface("dialog" | "dialog.footer")  → ResolvedTheme
```

For the sidebar card: `theme.text.base` (title), `theme.text.muted` (labels),
`theme.text.faint` (meta), `theme.text.feedback.*` + text/symbols for status —
never color alone (R2).

Renderer `[verified]` in `@opentui/core@0.6.6` `renderer.d.ts`:
`CliRenderer.width: number`, `.height: number`, `.terminalWidth: number`,
`.idle(): Promise<void>`, `.nativeScene: NativeScene`. Use
`context.renderer.width` for narrow-width behavior in `sidebar.content`
(that slot publishes no width) and to release OpenTUI resources on cleanup
(`context.renderer.idle().then(() => style.destroy())` — `[docs-only]`).

## 12. Compile evidence (reproducible)

`[verified]` — scratch project outside the repo, **no repo files touched**:
`/tmp/opencode/tui-verify` with `@opencode/plugin@2.2.7`, `@opencode/theme@2.2.7`,
`@opentui/core@0.8.4`, `@opentui/solid@0.8.4`, `solid-js@1.9.15`,
`typescript@5.9.3`.

```jsonc
// tsconfig.json — the JSX/type settings that work
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "jsx": "react-jsx", "jsxImportSource": "@opentui/solid",
    "strict": true, "noEmit": true, "skipLibCheck": true, "types": ["node"]
  },
  "include": ["src"]
}
```

`tsc -p tsconfig.json` → **exit 0** with, in one file: `Plugin.define` default
export + `Context` import; `@opencode/plugin/tui/context` subpath import for
`PanelInput` (proves the `"./*"` wildcard export); `ui.slot({ append:
"sidebar.content", render: ({ sessionID }) => <Card sessionID={sessionID} /> })`
with correct prop inference; `ui.slot({ append: "session.panel", render: (panel)
=> … })` typed as `PanelInput`; `panel.open/current/close`; a keymap layer with
`bind`/`palette`/`slash{name,aliases}`/`enabled`/`suggested`/`bindings`;
`storage.memory` tuple destructure; `data.session.status`; `data.on("session.status")`
payload narrowing to `idle|retry|busy`; `data.listen`; `ui.format.path`;
`theme.text.base|muted|faint`; `PanelInput.close/toggleFullscreen/focus`.

Negative controls (same project): a wrong field type and an unknown
`PanelInput` member fail with `TS2322`/`TS2339`; two placement keys on one claim
fail to compile (`prepend?: never` violation). ⇒ the surface above is real, not
permissive `any`.

Caveat: the repo cannot reproduce this yet — peers are missing (§1). Add them as
devDependencies (typed) + peers (runtime) in **1.3**, then re-run this snippet
inside the repo before committing the TUI entry.

## 13. Fallbacks — what to do when an API is missing

| Need | Available API | Fallback if unavailable / insufficient |
|---|---|---|
| Sidebar width | none in `sidebar.content` input | `context.renderer.width`; or fixed compact layout (2–3 lines) |
| Fullscreen toggle | `PanelInput.toggleFullscreen` | no `ui.panel.*` equivalent — hide the binding when `presentation === "fullscreen"` is already forced by a narrow host |
| Panel close | `PanelInput.close` / `ui.panel.close` | command layer with `bind: "escape"`, `run: () => panel.close()` |
| Retry detail | `session.status` event / `session.retry.scheduled` | `status(id) === "running"` + "running" label only |
| Current tool name | `session.tool.input.started.data.name`; last assistant message `content[]` tool `name` | active sub-task name from the plan (R6 fallback) |
| Current agent | `SessionMessageAssistant.agent`; `SessionInfo.agent` | active sub-task's `Delegated to agent` line |
| Per-layer keymap disposal | none (`layer(): void`) | create the layer inside the panel component; use `enabled` to inert it |
| Path display | `ui.format.path` | raw `directory` |
| Theme tokens | `context.theme` | `text.base`/`muted`/`faint` + symbols only |
| Vertical scrolling in the panel | not part of the plugin API (`[docs-only]`: host renderables are not API) | render a windowed slice of phases (own scroll offset in `storage.memory` + keymap) |

## 14. Open questions handed to 1.3 / 4.1

1. **Peer install:** which `@opentui/*`/`@opencode/theme` versions to add, and
   whether to also bump `@opencode/plugin` 2.0.20 → host-aligned (2.2.7+). Peer
   ranges differ (`>=0.5.12` vs `>=0.8.1`). `@opencode/client` is **not
   resolvable from this repo** today (transitive only) — add it as a
   devDependency if the TUI code needs `OpenCodeEvent`, `SessionInfo`,
   `SessionMessageInfo` or `LocationRef` types directly; otherwise derive them
   from `Context` (`Context["data"]["session"]["message"]["list"]`).
2. **Managed-install resolution:** can a cached copy with no `node_modules`
   import the built `dist/tui.js`? Host runtime rewriting covers
   `solid-js`/`@opentui/*`/`@opencode/plugin/tui`; prove it, else bundle the
   minimum that cannot resolve — never bundle `solid-js`.
3. **Source mode:** does `file://` loading of this repo pick up
   `exports["./tui"]` before a build, or does it need `dist/tui.js`? Docs say
   local directories with `name`+`exports` load through them.
4. **Reactive reads:** confirm `data.session.message.list()` inside a slot
   re-renders on new messages (store-backed ⇒ expected) or drive the activity
   line purely from `data.on` events.
5. **Panel scroll:** decide windowed rendering vs a host scroll container.

## 15. References

- Installed: `node_modules/@opencode/plugin/dist/tui/{context,plugin,index,solid}.d.ts`
  (2.0.20); `node_modules/.pnpm/@opencode+client@2.0.20_effect@4.0.0-rc.112/node_modules/@opencode/client/dist/promise/generated/types.d.ts`.
- Reference tarballs (not installed, host-matched): `@opencode/plugin@2.2.7`,
  `@opencode/theme@2.2.7`, `@opentui/core@0.6.6|0.8.4`, `@opentui/solid@0.9.0`.
- Docs: [TUI plugins](https://opencode.ai/v2/docs/build/plugins/cli) (`Context`,
  `Events`, `Sessions`, `Location data`, `Theme and renderer`, `Solid components`,
  `Commands and keymaps`, `Storage`, `Dialogs and toasts`, `Routes and tabs`,
  `Slots`, `Session panels`, `Formatting`, `Publish and load`),
  [Plugins overview](https://opencode.ai/v2/docs/build/plugins) (`Parts`, `Load`),
  [CLI plugins](https://opencode.ai/v2/docs/cli/plugins) (discovery paths).
- Plan: [`plan.md`](plan.md) §Phase 1; [`sdd.md`](sdd.md) R1–R7;
  [`../../LOADING.md`](../../LOADING.md).

## 16. Build spike results (1.3)

`[verified]` 2026-11-15 in this repository: opencode **2.2.7**, node **v24.18.0**,
pnpm **11.9.0** (via `corepack`, the repo ships no `packageManager` field),
tsdown **0.23.7** (rolldown **1.3.0**), typescript **6.0.3**; toolchain peers
`@opencode/plugin@2.0.20`, `@opencode/theme@2.0.20`, `@opentui/core@0.9.0`,
`@opentui/solid@0.9.0`, `solid-js@1.9.19`.

This section answers §14 questions 1–3 and records the decisions 4.1 must keep.

### 16.1 Decisions

| Area | Decision | Why |
|---|---|---|
| Entry | `tsdown` config gains a 4th **single-entry** build `{ tui: 'src/tui/index.tsx' }`; the three server entries are untouched | Rolldown rejects `codeSplitting: false` with multiple inputs, and the managed installer copies single files (4.2) |
| Base fields | inherits `format: esm`, `platform: node`, `target: node20`, `outDir: dist`, `clean: false`, `outExtensions: .js`, `sourcemap: false`, `dts: false`, `outputOptions.codeSplitting: false` | identical artifact conventions to `dist/plugin.js` |
| Host modules | `deps.neverBundle: ['@opencode/plugin', /^@opencode\/plugin\//, 'solid-js', /^solid-js\//, /^@opentui\//]`, `alwaysBundle: []` | the host injects its own instances (§2); bundling `solid-js` splits reactivity/context and `@opentui/core` would build renderables in a foreign renderer |
| Server aliases | `alias: {}` on the TUI entry | the base aliases point at bundled `yaml`/`jsonc-parser` copies the TUI never imports |
| Banner | `banner: undefined` | `dist/tui.js` is imported, not executed: no shebang, no `+x` bit (the base shebang would leak both) |
| JSX | **only** `tsconfig.json`: `"jsx": "react-jsx"`, `"jsxImportSource": "@opentui/solid"` | one source of truth for `tsc` and oxc; oxc reads the tsconfig and emits `import { jsx } from "@opentui/solid/jsx-runtime"`. Adding `inputOptions.transform.jsx` too made tsdown emit `[CONFIGURATION_FIELD_CONFLICT]` (same value, redundant) |
| Peers | optional peers `@opentui/core >=0.8.1`, `@opentui/solid >=0.8.1`, `solid-js >=1.9.12` (+ `peerDependenciesMeta` optional) | matches the 2.2.7 host range (§1) while staying installable for server-only users |
| devDeps | `@opentui/core@0.9.0`, `@opentui/solid@0.9.0`, `solid-js@1.9.19`, `@opencode/theme@2.0.20` | types + build only; `@opencode/theme` is pinned to the *installed typing* version (`context.d.ts` imports `ResolvedTheme` from `@opencode/theme/tui`), not to the host |
| Export | `exports["./tui"] = { types: "./dist/tui/index.d.ts", import: "./dist/tui.js", default: "./dist/tui.js" }` | `tsdown` emits `dist/tui.js`; `tsc --emitDeclarationOnly` emits `dist/tui/index.d.ts` (600 B, `declare const _default: Plugin.Definition`) |
| Lint/analysis | `biome.json` and `knip.project` now include `**/src/**/*.tsx`; `src/tui/plugin-id.ts` holds `TUI_PLUGIN_ID` so the entry is not a dependency-cruiser orphan | without the glob, TSX would be unlinted; without a relative import the entry has zero in-graph dependencies and `no-orphans` fails (dependency-cruiser cannot resolve `@opencode/plugin/tui` under `includeOnly: ^src`) |

### 16.2 Bundle and peer-resolution result

- **`pnpm build` emits `dist/tui.js` (966 B, 0.58 kB gzip, sha256
  `dbf02a1a…`)** next to the three server artifacts. `dist/plugin.js`
  (200,961 B), `dist/cli.js` (168,599 B) and `dist/mcp/stdio.js` (254,173 B) are
  **byte-identical** to a build of `HEAD` (`814a8b7`) produced in a detached
  worktree — same SHA-256 (`1667a061…`, `be9a3cc0…`, `fffe050a…`). The server
  packaging is untouched.
- The artifact has exactly **two static imports**, both host-provided:
  `@opencode/plugin/tui` and `@opentui/solid/jsx-runtime` — no relative imports,
  no bundled Solid/OpenTUI code. `test/tui-bundle.test.ts` locks that contract
  (allowed specifiers, `< 8 KiB`, valid `Plugin.define`, one `sidebar.content`
  claim, disposer works).
- **Managed-layout resolution proven.** A temporary project
  (`/tmp/opencode/tui-spike-project`) with the production layout
  (`package.json` `name` + `exports["."]` + `exports["./tui"]`, `index.ts`,
  `dist/plugin.js`, `dist/assets`) and **no `node_modules`** was opened with the
  real TUI. `opencode --print-logs --log-level debug` shows the host resolving
  the package export and evaluating the module:

  ```text
  level=DEBUG message="plugin operation started" component=plugin id=21 stage=read reconciliation=2
    target=…/.opencode/plugins/dev-harness-skills
    entrypoint=file://…/.opencode/plugins/dev-harness-skills/dist/tui.js role=cli
  level=DEBUG message="plugin operation completed" component=plugin id=21 stage=read durationMs=0 …
  level=INFO  message="plugin reconciliation completed" component=plugin id=3 durationMs=1 plugins=15 role=cli
  ```

  A deliberate `throw new Error("TUI-SPIKE-PROBE")` prepended to the artifact
  turned the same step into
  `level=WARN message="plugin operation failed" … error=TUI-SPIKE-PROBE … role=cli`,
  proving the host **evaluates our code** and that the bare `@opencode/plugin/tui`
  and `@opentui/solid/jsx-runtime` specifiers resolve through the host's
  `opentui:runtime-module:*` rewrite **without any `node_modules`**. ⇒ §14
  question 2 answered: **do not bundle the host peers**.
- Under plain Node the artifact imports cleanly and behaves:
  `id === "dev-harness-skills.tui"`, `setup(context)` registers exactly one
  `sidebar.content` claim and returns a disposer that removes it.
- `pnpm peers check` reports one **pre-existing, build-time-only** warning:
  `bun-ffi-structs@0.3.1` (transitive of `@opentui/core`) wants `typescript ^5`
  while the repo uses 6.0.3. Nothing ships from it.

### 16.3 Blockers and limits (reported, not worked around)

1. **Sidebar pixels not observed.** The v2.2.7 home screen renders no sidebar —
   `opencode.sidebar.*` contributions only mount inside a session — and opening
   a session requires a model turn. The spike deliberately avoided spending a
   model call, so the card was **not** seen on screen. Phase 3/4 must do the
   visual check with a live session.
2. **No headless JSX snapshot.** `@opentui/solid#testRender` →
   `@opentui/core/testing` throws
   `OpenTUI native FFI is not available for this runtime yet` under Node, and no
   standalone `bun` is installed (the host embeds its own). Render-level tests
   stay manual; 2.4 unit-tests the pure model instead.
3. **Typing line drift.** The repo builds against `@opencode/plugin@2.0.20`
   typings while the host is 2.2.7 (§1). The TUI surface this plan uses is
   identical, so nothing failed, but 4.1 **should** align the dependency with the
   host. That changes the bundled server artifact, so it needs the full
   bundle/smoke gates, not just this spike.
4. **Managed install still ships no TUI part.** The installed copy in this repo
   (`.opencode/plugins/dev-harness-skills/package.json`, version 0.5.0) exports
   only `"."`, so today's managed session loads no `./tui`; 4.2 must copy
   `dist/tui.js` and add the export (the spike proved the host path works once
   the export exists).
5. **Two `@opentui/core` copies in the dev tree** (`0.9.0` from our devDeps,
   `0.5.12` as a regular dependency of `@opencode/theme@2.0.20`). Types stay
   compatible (`RGBA` is structural), but if 4.1 adopts a newer
   `@opencode/theme`, add a pnpm override so a single `@opentui/core` is typed.

### 16.4 JSX reactivity caveat (read from the runtime, not yet live)

`@opentui/solid@0.9.0/jsx-runtime.js` maps JSX to
`createComponent`/`createElement`/`spread`; `spreadExpression`
(`index.js:434-452`) applies props inside one `createRenderEffect`, and
`insertExpression` (`:243-249`) unwraps function children
(`while (typeof current === "function") current = current()`). Consequences for
3.1/3.2:

- **Value children are evaluated eagerly** — there is no `babel-preset-solid`
  fine-grained transform in this pipeline. Dynamic text must be passed as an
  accessor child (`{() => state().title}`) or produced inside a component that
  reads signals in its own computation.
- **Scalar props (`fg`, `width`, `border`) are applied once at mount**, because
  the props object is built by the caller before `jsx()` runs. A theme switch
  will not repaint an already-mounted card unless a signal read inside the
  render effect changes.
- If this proves too weak in Phase 3, add a Solid JSX compile step (babel/oxc
  pass) — a build-only change that does not touch the plugin API.

### 16.5 Reproduce

```sh
pnpm build            # emits dist/plugin.js, dist/cli.js, dist/mcp/stdio.js, dist/tui.js
pnpm typecheck        # tsx compiles with jsx=react-jsx, jsxImportSource=@opentui/solid
pnpm test             # incl. test/tui-bundle.test.ts (host-module contract)
node scripts/smoke-load.mjs
```

Manual host check (isolated temp project, no user config or session touched):

```sh
mkdir -p /tmp/opencode/tui-spike-project/.opencode/plugins/dev-harness-skills/dist
cp dist/plugin.js dist/tui.js /tmp/opencode/tui-spike-project/.opencode/plugins/dev-harness-skills/dist/
cp -r dist/assets /tmp/opencode/tui-spike-project/.opencode/plugins/dev-harness-skills/dist/
# package.json there: name + "exports": { ".": "./dist/plugin.js", "./tui": "./dist/tui.js" }
opencode --print-logs --log-level debug /tmp/opencode/tui-spike-project   # grep for stage=read … dist/tui.js
```


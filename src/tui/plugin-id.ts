/**
 * Host-visible ids of the TUI part (`Plugin.define({ id })`).
 *
 * Prefixed with the package name so slot claims, keymap commands and panel
 * names can never collide with the host's built-in `opencode.*` contributions.
 */
export const TUI_PLUGIN_ID = 'dev-harness-skills.tui';

/** `session.panel` selection name opened by `/plan-progress` (§6). */
export const TUI_PLAN_PANEL = 'dev-harness-skills.plan';

/** Slash/palette command that opens the plan progress panel. */
export const TUI_PLAN_COMMAND = 'dev-harness-skills.plan-progress';

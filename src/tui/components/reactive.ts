import type { JSX } from '@opentui/solid';

/**
 * Wrap a string accessor as a JSX child.
 *
 * `@opentui/solid` re-runs function children inside a render effect
 * (`insert()` → `createRenderEffect`, see tui-api-notes §16.4), which is what
 * keeps text live without a compile-time Solid transform. `JSX.Element` does
 * not include functions, so this helper centralizes the cast.
 */
export function reactiveText(read: () => string): JSX.Element {
  return read as unknown as JSX.Element;
}

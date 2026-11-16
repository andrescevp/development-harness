import type { JSX } from '@opentui/solid';
import { Show, type JSX as SolidJSX } from 'solid-js';

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

/**
 * `Show` with an accessor condition.
 *
 * This JSX transform does not wrap prop expressions on its own, so a literal
 * `when={!something()}` is evaluated once. Passing getters here keeps the
 * condition reactive.
 */
export function reactiveShow(props: {
  when: () => boolean;
  fallback?: SolidJSX.Element;
  children: SolidJSX.Element;
}): SolidJSX.Element {
  return Show({
    get when() {
      return props.when();
    },
    get fallback() {
      return props.fallback;
    },
    children: props.children,
  });
}

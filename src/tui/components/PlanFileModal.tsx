import type { Keymap } from '@opencode/plugin/tui/context';
import type { ResolvedTheme } from '@opencode/theme/tui';
import { type CliRenderer, type ScrollBoxRenderable, SyntaxStyle, type ThemeTokenStyle } from '@opentui/core';
import { useTerminalDimensions } from '@opentui/solid';
import { createMemo, createSignal, onCleanup } from 'solid-js';
import { planFileMarkdown, planTreeText } from '../plan-file-model.js';
import { PLAN_MAX_BYTES, readFileAt } from '../plan-read-files.js';
import { reactiveShow, reactiveText } from './reactive.js';

export interface PlanFileModalProps {
  /** Absolute plan.md path; null renders the unavailable state. */
  path: string | null;
  title: string;
  theme: ResolvedTheme;
  /** Host renderer; supplies the native scene that owns the syntax style. */
  renderer: CliRenderer;
  /** Host keymap: adds modal tab/scroll keys while this component is mounted. */
  keymap: Keymap;
}

type PlanFileTab = 'tree' | 'markdown';

/** Markdown/code syntax colors from the host theme (plugin-safe subset). */
function createSyntaxStyle(theme: ResolvedTheme, owner: ConstructorParameters<typeof SyntaxStyle>[2]): SyntaxStyle {
  const rule = (
    scope: string[],
    foreground: ThemeTokenStyle['style']['foreground'],
    style: Omit<ThemeTokenStyle['style'], 'foreground'> = {}
  ): ThemeTokenStyle => ({ scope, style: { foreground, ...style } });
  return SyntaxStyle.fromTheme(
    [
      rule(['default'], theme.text.base),
      rule(['comment'], theme.syntax.comment, { italic: true }),
      rule(['string', 'symbol'], theme.syntax.string),
      rule(['number', 'boolean', 'constant'], theme.syntax.number),
      rule(['keyword', 'keyword.return', 'keyword.conditional'], theme.syntax.keyword, { italic: true }),
      rule(['function', 'function.method', 'function.call'], theme.syntax.function),
      rule(['type', 'module', 'class', 'namespace'], theme.syntax.type),
      rule(['variable', 'variable.parameter', 'property', 'field'], theme.syntax.variable),
      rule(['operator', 'punctuation', 'punctuation.bracket'], theme.syntax.operator),
      rule(['markup.heading', 'markup.heading.2', 'markup.heading.3'], theme.markdown.heading, { bold: true }),
      rule(['markup.heading.4', 'markup.heading.5', 'markup.heading.6'], theme.markdown.heading, { bold: true }),
      rule(['markup.bold', 'markup.strong'], theme.markdown.strong, { bold: true }),
      rule(['markup.italic'], theme.markdown.emphasis, { italic: true }),
      rule(['markup.list'], theme.markdown.listItem),
      rule(['markup.quote'], theme.markdown.blockQuote, { italic: true }),
      rule(['markup.raw', 'markup.raw.block'], theme.markdown.code),
      rule(['markup.raw.inline'], theme.markdown.code),
      rule(['markup.link', 'markup.link.url'], theme.markdown.link, { underline: true }),
      rule(['markup.link.label'], theme.markdown.linkText, { underline: true }),
      rule(['markup.strikethrough'], theme.text.muted),
    ],
    owner
  );
}

/**
 * Read-only plan-file modal opened from a sidebar `[open]` action.
 *
 * Two tabs: a plan tree (phases/sub-tasks/statuses) and the rendered Markdown
 * of plan.md. The host dialog owns the overlay, Escape handling, and
 * dismissal; the Markdown tab uses the host renderer, so fenced mermaid blocks
 * go through the builtin merman plugin.
 */
export function PlanFileModal(props: PlanFileModalProps) {
  const dimensions = useTerminalDimensions();
  const [tab, setTab] = createSignal<PlanFileTab>('tree');
  const syntax = createSyntaxStyle(props.theme, props.renderer.nativeScene);
  let scroll: ScrollBoxRenderable | undefined;
  const height = () => Math.max(8, dimensions().height - 14);

  onCleanup(() => {
    void props.renderer.idle().then(() => syntax.destroy());
  });

  const contents = createMemo(() => {
    if (props.path === null) return 'Plan file is unavailable.';
    const source = readFileAt(props.path, props.path, {
      maxBytes: PLAN_MAX_BYTES,
      severity: 'error',
      issues: [],
    });
    if (source === null) return 'Plan file is unavailable or unreadable.';
    return source.contents.replace(/\r\n/g, '\n');
  });

  const markdown = createMemo(() => planFileMarkdown(contents()));
  const tree = createMemo(() => planTreeText(contents(), props.path ?? '<plan>'));

  const cycleTab = (): void => {
    setTab(tab() === 'tree' ? 'markdown' : 'tree');
  };

  props.keymap.layer(() => ({
    mode: 'modal',
    commands: [
      { bind: 'tab', title: 'Next plan-file tab', run: cycleTab },
      {
        bind: '1',
        title: 'Plan tree tab',
        run: () => {
          setTab('tree');
        },
      },
      {
        bind: '2',
        title: 'Markdown tab',
        run: () => {
          setTab('markdown');
        },
      },
      { bind: 'up', title: 'Scroll plan up', run: () => scroll?.scrollBy(-1) },
      { bind: 'down', title: 'Scroll plan down', run: () => scroll?.scrollBy(1) },
      { bind: 'pageup', title: 'Scroll plan up one page', run: () => scroll?.scrollBy(-height()) },
      { bind: 'pagedown', title: 'Scroll plan down one page', run: () => scroll?.scrollBy(height()) },
      { bind: 'home', title: 'Jump to plan start', run: () => scroll?.scrollTo(0) },
      { bind: 'end', title: 'Jump to plan end', run: () => scroll?.scrollTo(Infinity) },
    ],
  }));

  const tabButton = (value: PlanFileTab, label: string) => (
    // biome-ignore lint/a11y/noStaticElementInteractions: OpenTUI has no button primitive; box mouse handler is the control.
    <box onMouseUp={() => setTab(value)}>
      <text fg={props.theme.text.muted}>{reactiveText(() => (tab() === value ? `[ ${label} ]` : `  ${label}  `))}</text>
    </box>
  );

  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1}>
      <text fg={props.theme.text.base}>{reactiveText(() => props.title)}</text>
      <text fg={props.theme.text.faint}>{reactiveText(() => props.path ?? 'no path')}</text>
      <box flexDirection="row" gap={1}>
        {tabButton('tree', 'Plan tree')}
        {tabButton('markdown', 'Markdown')}
      </box>
      <scrollbox
        ref={(value: ScrollBoxRenderable) => {
          scroll = value;
        }}
        height={height()}
        focused
        scrollbarOptions={{ visible: true }}
      >
        {reactiveShow({
          when: () => tab() === 'tree',
          children: <text fg={props.theme.text.muted}>{reactiveText(() => tree())}</text>,
        })}
        {reactiveShow({
          when: () => tab() === 'markdown',
          children: <markdown content={markdown()} syntaxStyle={syntax} fg={props.theme.text.base} conceal />,
        })}
      </scrollbox>
      <text fg={props.theme.text.faint}>tab 1/2 switch · ↑/↓ PgUp/PgDn scroll · esc close</text>
    </box>
  );
}

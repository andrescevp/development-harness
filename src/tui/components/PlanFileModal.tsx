import type { Keymap } from '@opencode/plugin/tui/context';
import type { ResolvedTheme } from '@opencode/theme/tui';
import {
  type CliRenderer,
  createMarkdownCodeBlockRenderer,
  type MarkdownRenderable,
  type ScrollBoxRenderable,
  SyntaxStyle,
  TextRenderable,
  type ThemeTokenStyle,
} from '@opentui/core';
import { useTerminalDimensions } from '@opentui/solid';
import { createComponent, createEffect, createMemo, createSignal, For, onCleanup } from 'solid-js';
import { planFileMarkdown, planMermaidAscii } from '../plan-file-model.js';
import {
  defaultPlanFile,
  directoryPaths,
  type PlanFileNode,
  readPlanFileTree,
  visiblePlanFiles,
} from '../plan-file-tree.js';
import { PLAN_MAX_BYTES, readFileAt } from '../plan-read-files.js';
import { reactiveShow, reactiveText } from './reactive.js';

export interface PlanFileModalProps {
  /** Absolute plan.md path; null renders the unavailable state. */
  path: string | null;
  title: string;
  theme: ResolvedTheme;
  /** Host renderer; supplies the native scene that owns the syntax style. */
  renderer: CliRenderer;
  /** Host keymap: adds modal tree/preview keys while this component is mounted. */
  keymap: Keymap;
}

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

interface Preview {
  kind: 'markdown' | 'text' | 'empty';
  text: string;
}

/**
 * Read-only plan-file modal opened from a sidebar `[open]` action.
 *
 * 80% × 80% of the terminal, centered: a 30% file tree (plan directory:
 * plan.md, sdd.md, tasks/, diagrams/, sidecars) and a 70% preview. Arrow keys
 * select/toggle nodes, clicks select; Markdown previews include Mermaid
 * flowcharts rendered as terminal diagrams.
 */
export function PlanFileModal(props: PlanFileModalProps) {
  const dimensions = useTerminalDimensions();
  const syntax = createSyntaxStyle(props.theme, props.renderer.nativeScene);
  const mermaid = createMarkdownCodeBlockRenderer({
    mermaid: (block) => {
      const ascii = planMermaidAscii(block.text);
      if (ascii === null) return undefined;
      return new TextRenderable(props.renderer, {
        content: ascii,
        width: '100%',
        wrapMode: 'none',
        selectable: false,
        fg: props.theme.text.base,
      });
    },
  });

  const width = () => Math.min(116, Math.max(50, Math.floor(dimensions().width * 0.8)));
  const height = () => Math.max(16, Math.floor(dimensions().height * 0.8));
  const panelHeight = () => Math.max(8, height() - 6);

  const tree = createMemo(() => (props.path === null ? [] : readPlanFileTree(props.path)));
  const [expanded, setExpanded] = createSignal<ReadonlySet<string>>(new Set(directoryPaths(tree())));
  const initial = defaultPlanFile(tree());
  const [selected, setSelected] = createSignal<string | null>(initial?.path ?? null);
  let treeScroll: ScrollBoxRenderable | undefined;
  let previewScroll: ScrollBoxRenderable | undefined;
  let markdownView: MarkdownRenderable | undefined;

  const rows = createMemo(() => visiblePlanFiles(tree(), (relative) => expanded().has(relative)));
  const selectedRow = createMemo(() => rows().find((row) => row.node.path === selected()) ?? null);

  const preview = createMemo<Preview>(() => {
    const node = selectedRow()?.node;
    if (!node || node.directory) return { kind: 'empty', text: 'Select a file to preview.' };
    const source = readFileAt(node.path, node.relative, {
      maxBytes: PLAN_MAX_BYTES,
      severity: 'error',
      issues: [],
    });
    if (source === null) return { kind: 'empty', text: 'File is unavailable or unreadable.' };
    return node.name.endsWith('.md')
      ? { kind: 'markdown', text: planFileMarkdown(source.contents) }
      : { kind: 'text', text: source.contents };
  });

  onCleanup(() => {
    void props.renderer.idle().then(() => syntax.destroy());
  });

  createEffect(() => {
    const value = preview();
    if (markdownView) markdownView.content = value.kind === 'markdown' ? value.text : '';
  });

  const selectAt = (index: number): void => {
    const list = rows();
    if (list.length === 0) return;
    const next = Math.min(list.length - 1, Math.max(0, index));
    setSelected(list[next]!.node.path);
    previewScroll?.scrollTo(0);
    treeScroll?.scrollTo(Math.max(0, next - 2));
  };

  const selectedIndex = (): number => rows().findIndex((row) => row.node.path === selected());

  const move = (delta: number): void => {
    const current = selectedIndex();
    selectAt((current < 0 ? 0 : current) + delta);
  };

  const toggleDirectory = (relative: string): void => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(relative)) next.delete(relative);
      else next.add(relative);
      return next;
    });
  };

  const activate = (): void => {
    const node = selectedRow()?.node;
    if (node?.directory) toggleDirectory(node.relative);
  };

  const collapseOrParent = (): void => {
    const node = selectedRow()?.node;
    if (!node) return;
    if (node.directory && expanded().has(node.relative)) {
      toggleDirectory(node.relative);
      return;
    }
    const parent = node.relative.includes('/') ? node.relative.slice(0, node.relative.lastIndexOf('/')) : null;
    const target = parent === null ? null : rows().find((row) => row.node.relative === parent);
    if (target) {
      setSelected(target.node.path);
      previewScroll?.scrollTo(0);
    }
  };

  const expandOrFile = (): void => {
    const node = selectedRow()?.node;
    if (node?.directory) toggleDirectory(node.relative);
  };

  const choose = (nodePath: string, directory: boolean, relative: string): void => {
    setSelected(nodePath);
    previewScroll?.scrollTo(0);
    if (directory) toggleDirectory(relative);
  };

  props.keymap.layer(() => ({
    mode: 'modal',
    commands: [
      { bind: 'up', title: 'Previous plan file', run: () => move(-1) },
      { bind: 'down', title: 'Next plan file', run: () => move(1) },
      { bind: 'left', title: 'Collapse folder', run: collapseOrParent },
      { bind: 'right', title: 'Expand folder', run: expandOrFile },
      { bind: 'return', title: 'Toggle folder', run: activate },
      { bind: 'pageup', title: 'Preview up one page', run: () => previewScroll?.scrollBy(-panelHeight()) },
      { bind: 'pagedown', title: 'Preview down one page', run: () => previewScroll?.scrollBy(panelHeight()) },
      { bind: 'home', title: 'Preview start', run: () => previewScroll?.scrollTo(0) },
      { bind: 'end', title: 'Preview end', run: () => previewScroll?.scrollTo(Infinity) },
    ],
  }));

  const treeRows = createComponent(For, {
    get each() {
      return rows();
    },
    children: (row: { node: PlanFileNode; depth: number }) => (
      // biome-ignore lint/a11y/noStaticElementInteractions: OpenTUI has no button primitive; box mouse handler is the control.
      <box onMouseUp={() => choose(row.node.path, row.node.directory, row.node.relative)}>
        <text fg={props.theme.text.muted}>
          {reactiveText(() => {
            const marker = selected() === row.node.path ? '›' : ' ';
            const icon = row.node.directory ? (expanded().has(row.node.relative) ? '▾' : '▸') : '·';
            return `${marker} ${'  '.repeat(row.depth)}${icon} ${row.node.name}`;
          })}
        </text>
      </box>
    ),
  });

  return (
    <box flexDirection="column" width={width()} height={height()} alignSelf="center" paddingLeft={1} paddingRight={1}>
      <text fg={props.theme.text.base}>{reactiveText(() => props.title)}</text>
      <text fg={props.theme.text.faint}>{reactiveText(() => props.path ?? 'no path')}</text>
      <box flexDirection="row" flexGrow={1}>
        <box flexDirection="column" width="30%" border={['right']} borderColor={props.theme.border.base}>
          <text fg={props.theme.text.base}>Files</text>
          <scrollbox
            ref={(value: ScrollBoxRenderable) => {
              treeScroll = value;
              const index = selectedIndex();
              if (index >= 0) value.scrollTo(Math.max(0, index - 2));
            }}
            height={panelHeight()}
            scrollbarOptions={{ visible: true }}
          >
            {treeRows}
          </scrollbox>
        </box>
        <box flexDirection="column" width="70%" paddingLeft={1}>
          <text fg={props.theme.text.base}>{reactiveText(() => selectedRow()?.node.relative ?? 'Preview')}</text>
          <scrollbox
            ref={(value: ScrollBoxRenderable) => {
              previewScroll = value;
            }}
            height={panelHeight()}
            scrollbarOptions={{ visible: true }}
          >
            <markdown
              ref={(value: MarkdownRenderable) => {
                markdownView = value;
                const current = preview();
                value.content = current.kind === 'markdown' ? current.text : '';
              }}
              content=""
              syntaxStyle={syntax}
              renderBlock={mermaid}
              fg={props.theme.text.base}
              conceal
            />
            {reactiveShow({
              when: () => preview().kind !== 'markdown',
              children: <text fg={props.theme.text.muted}>{reactiveText(() => preview().text)}</text>,
            })}
          </scrollbox>
        </box>
      </box>
      <text fg={props.theme.text.faint}>↑/↓ files · ←/→ folders · Enter toggle · PgUp/PgDn preview · esc close</text>
    </box>
  );
}

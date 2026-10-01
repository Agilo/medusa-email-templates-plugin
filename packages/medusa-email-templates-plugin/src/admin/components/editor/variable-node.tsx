import { Tooltip, TooltipProvider } from '@medusajs/ui';
import { EmailNode } from '@react-email/editor/core';
import type { RawCommands } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';

import type { EmailTemplateVariable } from '../../lib/types';
import { FORMAT_LABELS, variablesAt } from '../../lib/variables';
import { formatDate, formatMoney } from '../../../lib/rendering/format-value';
import {
  isVariableFormat,
  toLiquidExpression,
  type VariableFormat,
} from '../../../lib/rendering/variable-format';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variable: {
      setVariable: (attrs?: Record<string, unknown>) => ReturnType;
    };
  }
}

export const UNSET_VARIABLE_LABEL = 'Choose a variable';

type VariableNodeOptions = {
  variables: EmailTemplateVariable[];
};

/**
 * Parses a pill's inline CSS (written by the Inspector's Typography section
 * as `a-b: c; …`) into a React style object. The library's own parser is
 * internal.
 */
export const styleFromCss = (css: unknown): CSSProperties => {
  if (typeof css !== 'string' || !css.trim()) {
    return {};
  }

  return Object.fromEntries(
    css
      .split(';')
      .map((declaration) => {
        const index = declaration.indexOf(':');

        return index < 0
          ? null
          : [
              declaration
                .slice(0, index)
                .trim()
                .replace(/-([a-z])/g, (_, letter: string) =>
                  letter.toUpperCase(),
                ),
              declaration.slice(index + 1).trim(),
            ];
      })
      .filter((entry): entry is [string, string] =>
        Boolean(entry?.[0] && entry[1]),
      ),
  );
};

/**
 * Builds the Liquid expression for a pill.
 *
 * No key yields `''` (a new pill has none yet, and throwing here would crash
 * the canvas). A malformed key still throws: it can only come from
 * hand-edited JSON, and failing beats sending broken Liquid.
 */
const expressionFor = (attrs: Record<string, unknown> | undefined): string => {
  const key = typeof attrs?.key === 'string' ? attrs.key.trim() : '';

  if (!key) {
    return '';
  }

  const format = isVariableFormat(attrs?.format) ? attrs.format : 'text';
  const currencySource =
    typeof attrs?.currencySource === 'string'
      ? attrs.currencySource
      : undefined;

  return toLiquidExpression(key, format, { currencySource });
};

/*
 * `inline`, not `inline-flex`, so the pill's padding and ring don't push the
 * paragraph's lines apart.
 *
 * No font family, size or weight: the pill inherits the surrounding text and
 * its marks (e.g. bold from the bubble menu).
 *
 * These classes reach the host's stylesheet only via
 * `scripts/write-admin-safelist.mjs`: the host's Tailwind never scans the
 * extensionless admin chunks.
 */
const PILL_BASE = [
  'inline whitespace-nowrap align-baseline mx-px px-[5px] py-px',
  'rounded-md border leading-none',
  'cursor-default select-none transition-fg',
].join(' ');

const PILL_TONES = {
  chosen: {
    idle: 'border-ui-tag-blue-border bg-ui-tag-blue-bg text-ui-tag-blue-text hover:bg-ui-tag-blue-bg-hover',
    active: 'bg-ui-tag-blue-bg-hover',
  },
  empty: {
    idle: 'border-dashed border-ui-tag-orange-border bg-ui-tag-orange-bg text-ui-tag-orange-text hover:bg-ui-tag-orange-bg-hover',
    active: 'bg-ui-tag-orange-bg-hover',
  },
  stale: {
    idle: 'border-ui-tag-orange-border bg-ui-tag-orange-bg text-ui-tag-orange-text hover:bg-ui-tag-orange-bg-hover',
    active: 'bg-ui-tag-orange-bg-hover',
  },
} as const;

const exampleText = (
  variable: EmailTemplateVariable,
  format: VariableFormat,
  variables: EmailTemplateVariable[],
  currencySource: string | undefined,
): string => {
  if (format === 'money') {
    return formatMoney(
      variable.example,
      variables.find((entry) => entry.key === currencySource)?.example,
    );
  }

  if (format !== 'text') {
    return formatDate(variable.example, format);
  }

  return typeof variable.example === 'string' ||
    typeof variable.example === 'number'
    ? String(variable.example)
    : '';
};

const VariablePill = ({
  node,
  extension,
  selected,
  editor,
  getPos,
}: ReactNodeViewProps) => {
  /*
   * Resolved at the pill's position: `item.title` is valid only inside a
   * Repeat block. A moved pill is a new node view, so this stays current.
   * Changing a block's list does not redraw pills inside it, which is fine
   * while each event has one list.
   */
  const variables = variablesAt(
    editor.state.doc,
    getPos(),
    (extension.options as VariableNodeOptions).variables ?? [],
  );
  const key = typeof node.attrs.key === 'string' ? node.attrs.key : '';
  const textStyle = styleFromCss(node.attrs.style);
  const format: VariableFormat = isVariableFormat(node.attrs.format)
    ? node.attrs.format
    : 'text';
  const variable = variables?.find((entry) => entry.key === key);

  const state = !key ? 'empty' : variable ? 'chosen' : 'stale';
  const tone = PILL_TONES[state];
  const showFormat = format !== 'text';

  const currencySource =
    typeof node.attrs.currencySource === 'string'
      ? node.attrs.currencySource
      : undefined;

  // `||`, not `??`: an unusable example is `''`, which `??` would keep and
  // render as a blank pill.
  const text =
    state === 'empty'
      ? UNSET_VARIABLE_LABEL
      : variable
        ? exampleText(variable, format, variables ?? [], currencySource) ||
          variable.label
        : key;

  const name =
    state === 'empty' ? UNSET_VARIABLE_LABEL : (variable?.label ?? key);

  const description = [
    name,
    showFormat ? FORMAT_LABELS[format] : null,
    state === 'stale' ? 'not available for this event' : null,
  ]
    .filter(Boolean)
    .join(', ');

  const tooltip =
    state === 'empty'
      ? null
      : state === 'stale'
        ? `${name} — not available for this event`
        : name;

  return (
    <NodeViewWrapper
      as="span"
      /*
       * Required for the pill to be clickable: an inline node view inherits
       * editability, and `NodeView.stopEvent` swallows events on editable
       * targets, so ProseMirror would never select the node.
       */
      contentEditable={false}
      /*
       * Select the node ourselves: ProseMirror won't, since `stopEvent`
       * swallows the click and `updateSelection` skips an unchanged selection.
       * `focus()` is required too — the Inspector only targets a node while
       * the editor is focused.
       */
      onMouseDown={(event: ReactMouseEvent) => {
        const pos = getPos();

        if (typeof pos !== 'number') {
          return;
        }

        event.preventDefault();

        editor.chain().setNodeSelection(pos).focus().run();
      }}
      className={[
        PILL_BASE,
        tone.idle,
        selected ? `shadow-borders-focus ${tone.active}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`Variable: ${description}`}
      data-variable-node=""
      data-variable-key={key || undefined}
      data-variable-state={state}
    >
      {/*
        A real tooltip, since `title` never appears inside contenteditable.
        On an inner span so `Tooltip`'s `asChild` handlers don't collide with
        the wrapper's `onMouseDown`. Its own provider because Radix throws
        without one and an ancestor isn't guaranteed. It never takes focus, so
        the editor's focus scope is unaffected.

        The pill's typography styles the value, not its border and fill.
      */}
      {tooltip ? (
        <TooltipProvider>
          <Tooltip content={tooltip}>
            <span style={textStyle}>{text}</span>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <span style={textStyle}>{text}</span>
      )}
    </NodeViewWrapper>
  );
};

export const VariableNode = EmailNode.create<VariableNodeOptions>({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { variables: [] };
  },

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-variable'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-variable': attributes.key,
        }),
      },
      format: {
        // Keeps documents saved before formats existed rendering as before.
        default: 'text' satisfies VariableFormat,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-format') ?? 'text',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-format': attributes.format,
        }),
      },
      currencySource: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-currency-source'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.currencySource
            ? { 'data-currency-source': attributes.currencySource }
            : {},
      },
      style: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('style') ?? '',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.style ? { style: attributes.style } : {},
      },
    };
  },

  /**
   * Inserts a pill and selects it. The selection is computed after the insert
   * is queued: a position captured beforehand is stale within the chain, and
   * `NodeSelection` doesn't validate it, so it would throw and abort the
   * chain. Mirrors `setHorizontalRule`.
   */
  addCommands() {
    return {
      setVariable:
        (attrs: Record<string, unknown> = {}) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { key: '', ...attrs } })
            .command(({ tr, dispatch }) => {
              if (!dispatch) {
                return true;
              }

              const { $from } = tr.selection;
              const inserted = $from.nodeBefore;

              // The caret is just after the insert. Select only once confirmed,
              // so anything unexpected means no selection, not a throw.
              if (inserted?.type.name === this.name) {
                tr.setSelection(
                  NodeSelection.create(tr.doc, $from.pos - inserted.nodeSize),
                );
              }

              return true;
            })
            .run(),
    } satisfies Partial<RawCommands>;
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariablePill);
  },

  parseHTML() {
    return [{ tag: 'span[data-variable]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      { ...HTMLAttributes, class: 'email-template-variable' },
      expressionFor(node.attrs) || UNSET_VARIABLE_LABEL,
    ];
  },

  renderText({ node }) {
    return expressionFor(node.attrs);
  },

  /**
   * The expression, wrapped in a styled `<span>` if the pill has typography.
   * React's quotes go around the style attribute, never into the Liquid.
   */
  renderToReactEmail({ node }) {
    const expression = expressionFor(node.attrs);
    const style = styleFromCss(node.attrs?.style);

    return expression && Object.keys(style).length ? (
      <span style={style}>{expression}</span>
    ) : (
      expression
    );
  },
});

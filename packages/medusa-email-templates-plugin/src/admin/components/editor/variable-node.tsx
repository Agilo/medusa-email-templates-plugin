import { EmailNode } from '@react-email/editor/core';
import type { RawCommands } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import type { MouseEvent as ReactMouseEvent } from 'react';

import type { EmailTemplateVariable } from '../../lib/types';
import { FORMAT_LABELS } from '../../lib/variables';
import {
  isVariableFormat,
  toLiquidExpression,
  type VariableFormat,
} from '../../../lib/rendering/variable-format';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variable: {
      /** Inserts a pill and selects it, which is what the Inspector reads. */
      setVariable: (attrs?: Record<string, unknown>) => ReturnType;
    };
  }
}

/** Shown on the canvas for a pill whose variable has not been chosen yet. */
export const UNSET_VARIABLE_LABEL = 'Choose a variable';

type VariableNodeOptions = {
  /** Supplies each pill with its variable's human label. */
  variables: EmailTemplateVariable[];
};

/**
 * Builds the expression for a node's attributes.
 *
 * An absent key yields an empty string rather than throwing: a freshly
 * inserted pill has no variable yet, and `renderHTML` runs on every canvas
 * render, so throwing there would take the editor down. A key that is present
 * but malformed still throws — that can only arrive through hand-edited JSON,
 * and failing loudly beats emitting broken Liquid into a real email.
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
 * Only classes Medusa's own components already use reach this plugin.
 *
 * The dashboard ships one prebuilt stylesheet. The Tailwind pass that builds
 * it scans files ending in .js, .ts, .jsx or .tsx — but this plugin's admin
 * code is emitted as extensionless files under `_chunks/`, so none of it is
 * ever scanned and a class we invent resolves to nothing at all. Every class
 * below was checked against `@medusajs/dashboard/dist/app.css`; whatever that
 * file does not already emit is set inline instead.
 *
 * `inline`, not `inline-flex`: an inline-level box keeps the line box sized
 * by the surrounding text, so the pill's padding, border and focus ring paint
 * outside it without pushing a paragraph's lines apart.
 */
const PILL_BASE = [
  'inline whitespace-nowrap px-[5px] py-px',
  'rounded-md border font-sans font-medium leading-none',
  'cursor-default select-none transition-fg',
].join(' ');

/*
 * `align-baseline`, `mx-px` and `text-[0.875em]` are absent from the bundle,
 * so they are set here. Sizing in `em` keeps the pill tracking whatever text
 * it sits in — a heading, or a small footer — rather than locking to one
 * pixel size everywhere.
 */
const PILL_STYLE = {
  verticalAlign: 'baseline',
  marginInline: '1px',
  fontSize: '0.875em',
} as const;

/*
 * The separator, likewise inline: `ml-[5px]` and `pl-[5px]` are not in the
 * bundle either, and a bare `border-l` would take a default grey that is
 * invisible against the pill's own fill.
 */
const RULE_STYLE = {
  marginLeft: '5px',
  paddingLeft: '5px',
  borderLeftWidth: '1px',
  borderLeftStyle: 'solid',
} as const;

/*
 * Blue is a configured variable; orange flags one that needs attention —
 * either nothing chosen yet (dashed, so the outline itself reads as a blank
 * to fill), or a key the event no longer publishes (solid, because something
 * *was* chosen and has since gone).
 *
 * `rule` is a custom property rather than a class. The `-icon` tokens exist,
 * but Medusa only ever pairs them with `bg-` and `text-`, so the utility
 * `border-ui-tag-blue-icon` is never generated. Reading the variable directly
 * still follows the theme, which redefines these for dark mode.
 *
 * No hover tone: the bundle has no `bg-ui-tag-*-bg-hover` in any form, so
 * selection is carried by the focus ring alone.
 */
const PILL_TONES = {
  chosen: {
    idle: 'border-ui-tag-blue-border bg-ui-tag-blue-bg text-ui-tag-blue-text',
    rule: 'var(--tag-blue-icon)',
  },
  empty: {
    idle: 'border-dashed border-ui-tag-orange-border bg-ui-tag-orange-bg text-ui-tag-orange-text',
    rule: 'var(--tag-orange-icon)',
  },
  stale: {
    idle: 'border-ui-tag-orange-border bg-ui-tag-orange-bg text-ui-tag-orange-text',
    rule: 'var(--tag-orange-icon)',
  },
} as const;

/**
 * What the pill shows on the canvas.
 *
 * The whole point of the structured model is that an admin never reads Liquid,
 * so this renders the variable's label and, when it is displayed some
 * particular way, the format beside it — never `{{ order.total | money: … }}`.
 */
const VariablePill = ({
  node,
  extension,
  selected,
  editor,
  getPos,
}: ReactNodeViewProps) => {
  const { variables } = extension.options as VariableNodeOptions;
  const key = typeof node.attrs.key === 'string' ? node.attrs.key : '';
  const format: VariableFormat = isVariableFormat(node.attrs.format)
    ? node.attrs.format
    : 'text';
  const variable = variables?.find((entry) => entry.key === key);

  // A key with no matching variable is not the same as no key at all: the
  // event stopped publishing it, or it was authored against another event.
  // Either way the export still emits it, so it has to be visible.
  const state = !key ? 'empty' : variable ? 'chosen' : 'stale';
  const tone = PILL_TONES[state];
  const showFormat = format !== 'text';

  /*
   * Spelled out because the pill is one run of text to a screen reader, which
   * would otherwise read the label and the format as unrelated words, and the
   * blue-versus-orange distinction not at all.
   */
  const description = [
    state === 'empty' ? UNSET_VARIABLE_LABEL : (variable?.label ?? key),
    showFormat ? FORMAT_LABELS[format] : null,
    state === 'stale' ? 'not available for this event' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <NodeViewWrapper
      as="span"
      /*
       * Without this the pill cannot be clicked. `NodeView.stopEvent` swallows
       * any event whose target `isContentEditable`, and an inline node view
       * inherits editability from the paragraph around it — so ProseMirror
       * never reaches `selectClickedLeaf`, which is what turns a click on a
       * selectable atom into a NodeSelection. Block node views such as the
       * library's own divider never hit this, because their clicks land
       * outside the editable text run.
       */
      contentEditable={false}
      /*
       * Selection is set from the node's own position rather than left to
       * ProseMirror, because two separate things stop a click landing:
       * `NodeView.stopEvent` swallows events inside a node view, and
       * `updateSelection` bails without dispatching when the new selection
       * equals the current one.
       *
       * `focus()` is not optional. The Inspector's target selector starts
       * with `if (!editor.isFocused) return BODY_FOCUSED`, so without it the
       * panel collapses to the body and never sees this node — which is what
       * the breadcrumb reading "Body / Text / Element" was telling us. The
       * library's own breadcrumb pairs the two commands the same way.
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
        /*
         * `shadow-borders-focus`, not `…-interactive-with-active`: the pill is
         * not a control, and the interactive ring invites a click that does
         * nothing. This one reads as "this is the thing the Inspector is
         * editing", which is exactly what selection means here.
         */
        selected ? 'shadow-borders-focus' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={PILL_STYLE}
      aria-label={`Variable: ${description}`}
      /* Always present, unlike the key, so the pill is addressable even
         before a variable has been chosen. */
      data-variable-node=""
      data-variable-key={key || undefined}
      data-variable-state={state}
    >
      {/* `||`, not `??`: an unchosen pill has an empty-string key, which is
          not nullish, so `??` would return it and render nothing at all. */}
      {variable?.label || key || UNSET_VARIABLE_LABEL}
      {/* Only worth naming when it is not the plain default. A hairline rule
          rather than a separator character, which would be read aloud and
          would wrap as its own token. */}
      {showFormat && (
        <span
          className="font-normal"
          style={{ ...RULE_STYLE, borderLeftColor: tone.rule }}
        >
          {FORMAT_LABELS[format]}
        </span>
      )}
    </NodeViewWrapper>
  );
};

/**
 * Inline, non-editable variable pill. Stores the variable's key and how it
 * should be displayed; the Liquid expression is generated on export, so an
 * admin never types a filter and a stray keystroke cannot corrupt one.
 */
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
        // Documents saved before formats existed carry no attribute, so the
        // default is what makes them keep rendering exactly as before.
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
    };
  },

  /**
   * Insertion lives here rather than in the caller so the selection is
   * derived *after* the insert step is queued.
   *
   * Computing a position up front does not work: in a chain, `deleteRange`
   * and `insertContent` queue into one transaction, so a coordinate captured
   * beforehand is stale by the time it is used. `NodeSelection`'s constructor
   * then reads `nodeAfter.nodeSize` without checking — its own comment says
   * it "does not verify the validity of its argument" — so a wrong position
   * throws and silently aborts the rest of the chain, leaving a pill that
   * exists but is never selected. This mirrors `setHorizontalRule`.
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

              // The caret sits just after what was inserted. Only select it
              // once confirmed, so a surprise here degrades to no selection
              // rather than a thrown chain.
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

  renderToReactEmail({ node }) {
    return expressionFor(node.attrs);
  },
});

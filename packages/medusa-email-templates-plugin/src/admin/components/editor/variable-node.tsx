import { Tooltip, TooltipProvider } from '@medusajs/ui';
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
import { formatDate, formatMoney } from '../../../lib/rendering/format-value';
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
 * `inline`, not `inline-flex`: an inline-level box keeps the line box sized
 * by the surrounding text, so the pill's padding, border and focus ring paint
 * outside it without pushing a paragraph's lines apart.
 *
 * No font family, size or weight of its own. The pill is chrome around the
 * value, and the type is the text's: a pill in a heading reads as heading
 * text, and one made bold from the bubble menu reads as bold. ProseMirror
 * draws a mark as an element around the node view, so these only have to
 * inherit — a `font-medium` here used to override the `<strong>` and hide a
 * formatting choice that the sent email carried all along.
 *
 * These are ordinary classes again. They used to be set inline, because the
 * host's Tailwind pass never saw this plugin's code: it globs the admin
 * directory for .js/.ts/.jsx/.tsx while the admin build emits its chunks
 * without any extension. `scripts/write-admin-safelist.mjs` closes that gap
 * at build time, so a class here reaches the stylesheet like any other.
 */
const PILL_BASE = [
  'inline whitespace-nowrap align-baseline mx-px px-[5px] py-px',
  'rounded-md border leading-none',
  'cursor-default select-none transition-fg',
].join(' ');

/*
 * Blue is a configured variable; orange flags one that needs attention —
 * either nothing chosen yet (dashed, so the outline itself reads as a blank
 * to fill), or a key the event no longer publishes (solid, because something
 * *was* chosen and has since gone).
 *
 * `active` is the fill a selected pill takes, alongside the focus ring.
 *
 * Each tone carried a third entry, for the hairline between the label and the
 * format name. Both are gone: the pill shows the formatted example now, so
 * there is no second segment to divide.
 */
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

/**
 * The value a variable will stand for, rendered exactly as a recipient sees it.
 *
 * Through the send path's own formatters, not a copy of them —
 * `format-value.ts` is kept dependency-free for this. A canvas that formatted
 * its own way would be showing a guess.
 *
 * An empty string means the example cannot be shown: `formatMoney` and
 * `formatDate` both answer that way for input they cannot read, and a host's
 * custom event is free to declare `example: {}`. The caller falls back to the
 * label, because a name is more use than `[object Object]` sitting inline.
 */
const exampleText = (
  variable: EmailTemplateVariable,
  format: VariableFormat,
  variables: EmailTemplateVariable[],
  currencySource: string | undefined,
): string => {
  if (format === 'money') {
    /*
     * The currency is another variable's example — `order.total` names
     * `order.currency_code`, whose own example is `eur`. Without it
     * `formatMoney` gives a bare `40.00`, which is still honest: that is what
     * sends when the currency key is missing.
     */
    return formatMoney(
      variable.example,
      variables.find((entry) => entry.key === currencySource)?.example,
    );
  }

  if (format !== 'text') {
    return formatDate(variable.example, format);
  }

  // Plain text takes the example as it stands, including a date left
  // unformatted — an ISO string is unlovely, but it is what that pill sends.
  return typeof variable.example === 'string' ||
    typeof variable.example === 'number'
    ? String(variable.example)
    : '';
};

/**
 * What the pill shows on the canvas.
 *
 * The example value, not the variable's name. The canvas is where the email is
 * composed, so it should read like the email: line lengths, wrapping and the
 * look of a formatted total are all things you are judging while you write,
 * and `Total | Money` tells you nothing about any of them. It also makes the
 * Inspector's Format control demonstrate itself — pick Long date and the pill
 * says `October 1, 2026` instead of the words "Long date".
 *
 * The name has not gone, it has moved: a tooltip on hover, `aria-label` for a
 * screen reader, and the Inspector's own Variable row whenever the pill is
 * selected. What stays as text is the two states that have no value to show —
 * a pill with no variable chosen, and one whose key the event has stopped
 * publishing.
 *
 * Either way an admin never reads Liquid; that part is unchanged.
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

  const currencySource =
    typeof node.attrs.currencySource === 'string'
      ? node.attrs.currencySource
      : undefined;

  /*
   * `||` at every step, not `??`: an unusable example renders as an empty
   * string rather than null, and an unchosen pill's key is `''`. Both are
   * falsy but neither is nullish, so `??` would keep them and the pill would
   * render blank.
   */
  const text =
    state === 'empty'
      ? UNSET_VARIABLE_LABEL
      : variable
        ? exampleText(variable, format, variables ?? [], currencySource) ||
          variable.label
        : key;

  const name =
    state === 'empty' ? UNSET_VARIABLE_LABEL : (variable?.label ?? key);

  /*
   * Spelled out because the pill is one run of text to a screen reader, which
   * would otherwise read the label and the format as unrelated words, and the
   * blue-versus-orange distinction not at all.
   *
   * The format belongs here even though the tooltip drops it: `aria-label`
   * replaces the element's text, so a screen reader is told "Total, Money" and
   * never hears the `€55.00` a sighted reader is looking at. Commas because
   * they are what a screen reader pauses on.
   */
  const description = [
    name,
    showFormat ? FORMAT_LABELS[format] : null,
    state === 'stale' ? 'not available for this event' : null,
  ]
    .filter(Boolean)
    .join(', ');

  /*
   * The tooltip says only what the pill cannot.
   *
   * No format: the pill already shows `€55.00` or `October 1, 2026`, so naming
   * the format repeats what is on screen, and the Inspector has the control
   * for changing it. What is left is the variable's name, which the pill gave
   * up when it started showing values.
   *
   * Nothing at all for a pill with no variable chosen — its text is already
   * "Choose a variable", and a tooltip repeating that is noise.
   *
   * An em dash for a stale pill rather than a comma, because the warning is
   * subordinate to the name rather than a second fact of equal weight.
   */
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
        selected ? `shadow-borders-focus ${tone.active}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`Variable: ${description}`}
      /* Always present, unlike the key, so the pill is addressable even
         before a variable has been chosen. */
      data-variable-node=""
      data-variable-key={key || undefined}
      data-variable-state={state}
    >
      {/*
        The name, now that the pill shows the value instead.

        A real tooltip rather than `title`, which never surfaced inside the
        contenteditable however the attribute was set — and which takes about a
        second to appear even where it does work, too slow for something you
        read while scanning a template.

        Wrapped around an inner span on purpose. `Tooltip` renders its trigger
        `asChild`, so it merges its handlers onto whatever element it is given,
        and the wrapper above carries the `onMouseDown` that selection depends
        on — the comments there explain how narrow that path already is. The
        span keeps the two sets apart; the mousedown still reaches the wrapper
        by bubbling.

        Its own provider, rather than relying on the dashboard's. Node views
        render through portals that do carry React context, so the app's
        provider would reach this in the admin — but nothing guarantees an
        ancestor, and Radix throws without one. Nesting providers is supported
        and a provider is context and a timer, nothing more.

        Unlike the picker that started all this, a tooltip never takes focus
        and installs no outside-mousedown listener, so the editor's focus scope
        has nothing to react to.
      */}
      {tooltip ? (
        <TooltipProvider>
          <Tooltip content={tooltip}>
            <span>{text}</span>
          </Tooltip>
        </TooltipProvider>
      ) : (
        text
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

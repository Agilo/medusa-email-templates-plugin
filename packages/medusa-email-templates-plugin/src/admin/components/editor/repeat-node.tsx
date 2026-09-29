import { EmailNode } from '@react-email/editor/core';
import type { JSONContent, RawCommands } from '@tiptap/core';
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import type { MouseEvent as ReactMouseEvent } from 'react';

import {
  REPEAT_ATTRIBUTE,
  REPEAT_BODY_ATTRIBUTE,
} from '../../../lib/events/built-in/default-templates/repeat';
import { toLiquidLoop } from '../../../lib/rendering/variable-format';
import type { EmailTemplateVariable } from '../../lib/types';
import { listVariables } from '../../lib/variables';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    repeat: {
      /**
       * Inserts a Repeat block over `source`, holding `content`. Refused
       * inside another Repeat block: the loop alias is always `item`, so a
       * nested block would shadow its parent's entries.
       */
      setRepeat: (attrs: {
        source: string;
        content: JSONContent[];
      }) => ReturnType;
    };
  }
}

type RepeatNodeOptions = {
  /** Every variable the event declares; the block reads its lists. */
  variables: EmailTemplateVariable[];
};

/** Shown for a block whose list has not been chosen yet. */
export const UNSET_REPEAT_LABEL = 'Choose what to repeat';

/*
 * Neutral while it repeats something real, orange — the pill's own warning
 * tone — when it repeats nothing or a list this event no longer declares.
 */
const FRAME_BASE = 'my-2 rounded-md border border-dashed p-2';
const FRAME_TONES = {
  chosen: 'border-ui-border-strong',
  attention: 'border-ui-tag-orange-border',
} as const;
const LABEL_BASE = 'txt-compact-xsmall mb-1 cursor-default select-none';
const LABEL_TONES = {
  chosen: 'text-ui-fg-subtle',
  attention: 'text-ui-tag-orange-text',
} as const;

/**
 * The block on the canvas: a frame around one entry, which is edited like
 * any other content.
 *
 * Only one entry is drawn. The pills inside show example values, which is
 * enough to judge a line's layout, and the label says the rest.
 */
const RepeatFrame = ({
  node,
  extension,
  selected,
  editor,
  getPos,
}: ReactNodeViewProps) => {
  const { variables } = extension.options as RepeatNodeOptions;
  const source = typeof node.attrs.source === 'string' ? node.attrs.source : '';
  const list = listVariables(variables ?? []).find(
    (entry) => entry.key === source,
  );
  const tone = list ? 'chosen' : 'attention';

  const label = !source
    ? UNSET_REPEAT_LABEL
    : list
      ? `Repeats for each: ${list.label}`
      : `Repeats for each: ${source} — not available for this event`;

  return (
    <NodeViewWrapper
      className={[
        FRAME_BASE,
        FRAME_TONES[tone],
        selected ? 'shadow-borders-focus' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-repeat-frame=""
      data-repeat-state={tone}
    >
      {/*
        The label is the handle for the block itself. Clicking inside the
        content puts the caret in a paragraph, which is what editing a row
        needs; clicking here selects the whole block, which is what brings up
        its "Repeat for each" setting. Same mechanics as the variable pill —
        see `VariablePill` for why the selection is set by hand and why
        `focus()` is needed.
      */}
      <div
        contentEditable={false}
        className={`${LABEL_BASE} ${LABEL_TONES[tone]}`}
        onMouseDown={(event: ReactMouseEvent) => {
          const pos = getPos();

          if (typeof pos !== 'number') {
            return;
          }

          event.preventDefault();
          editor.chain().setNodeSelection(pos).focus().run();
        }}
      >
        {label}
      </div>
      <NodeViewContent />
    </NodeViewWrapper>
  );
};

/**
 * Repeats its content once per entry of a list.
 *
 * The content is ordinary editor content — tables, paragraphs, pills — so an
 * entry is styled with the same bubble menu and Inspector as everything else.
 * Pills inside it may use the list's `item.*` values; see `variablesAt`.
 */
export const RepeatNode = EmailNode.create<RepeatNodeOptions>({
  name: 'repeat',
  group: 'block',
  content: 'block+',
  // The library's own `section` settings: a boundary that editing does not
  // merge across, and that keeps its type when content is pasted into it.
  isolating: true,
  defining: true,

  addOptions() {
    return { variables: [] };
  },

  addAttributes() {
    return {
      source: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute(REPEAT_ATTRIBUTE),
        renderHTML: (attributes: Record<string, unknown>) => ({
          [REPEAT_ATTRIBUTE]: attributes.source,
        }),
      },
    };
  },

  addCommands() {
    return {
      setRepeat:
        ({ source, content }) =>
        ({ state, commands }) => {
          const { $from } = state.selection;

          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === this.name) {
              return false;
            }
          }

          return commands.insertContent({
            type: this.name,
            attrs: { source },
            content: content.length ? content : [{ type: 'paragraph' }],
          });
        },
    } satisfies Partial<RawCommands>;
  },

  addNodeView() {
    return ReactNodeViewRenderer(RepeatFrame);
  },

  parseHTML() {
    return [
      {
        tag: `div[${REPEAT_ATTRIBUTE}]`,
        /*
         * Above the library's `div` rule, which would otherwise claim the
         * element as a plain container and leave the loop tags as text.
         */
        priority: 1000,
        /*
         * Content comes from the body alone, so the `{% for %}` and
         * `{% endfor %}` either side of it are never read. Falls back to the
         * element itself for HTML without a body — a hand-written block, say.
         */
        contentElement: (element: HTMLElement) =>
          element.querySelector<HTMLElement>(
            `:scope > [${REPEAT_BODY_ATTRIBUTE}]`,
          ) ?? element,
      },
    ];
  },

  // The same shape the export writes, minus the loop, so copying a block and
  // pasting it back parses the same way.
  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, ['div', { [REPEAT_BODY_ATTRIBUTE]: '' }, 0]];
  },

  /**
   * The shape `repeat()` writes for a default template, so an exported block
   * and a built-in one are the same HTML.
   *
   * With no list chosen the content is written once, without a loop — an
   * unfinished block should not take the email down. A source that is
   * present but malformed still throws, like a malformed pill key: it can
   * only come from hand-edited JSON, and failing loudly beats sending
   * broken Liquid.
   */
  renderToReactEmail({ node, children }) {
    const source =
      typeof node.attrs?.source === 'string' ? node.attrs.source.trim() : '';

    if (!source) {
      return <>{children}</>;
    }

    const { open, close } = toLiquidLoop(source);
    const outer = { [REPEAT_ATTRIBUTE]: source };
    const body = { [REPEAT_BODY_ATTRIBUTE]: '' };

    return (
      <div {...outer}>
        {open}
        <div {...body}>{children}</div>
        {close}
      </div>
    );
  },
});

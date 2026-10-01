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
      setRepeat: (attrs: {
        source: string;
        content: JSONContent[];
      }) => ReturnType;
    };
  }
}

type RepeatNodeOptions = {
  variables: EmailTemplateVariable[];
};

export const UNSET_REPEAT_LABEL = 'Choose what to repeat';

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

export const RepeatNode = EmailNode.create<RepeatNodeOptions>({
  name: 'repeat',
  group: 'block',
  content: 'block+',
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
        // Beats the library's `div` rule, which would leave the loop tags as text.
        priority: 1000,
        // Read only the body, skipping the loop tags around it. Falls back to
        // the element for HTML without a body (e.g. hand-written).
        contentElement: (element: HTMLElement) =>
          element.querySelector<HTMLElement>(
            `:scope > [${REPEAT_BODY_ATTRIBUTE}]`,
          ) ?? element,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, ['div', { [REPEAT_BODY_ATTRIBUTE]: '' }, 0]];
  },

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

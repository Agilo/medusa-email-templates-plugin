import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import { ORDER_TOTALS } from '../../../../lib/events/built-in/default-templates/order-placed';
import { RepeatNode } from '../repeat-node';
import { snippetSlashCommands } from '../snippet-slash-command';
import { VariableNode } from '../variable-node';

const editors: Editor[] = [];

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

const collect = (node: JSONContent, type: string): JSONContent[] => [
  ...(node.type === type ? [node] : []),
  ...(node.content ?? []).flatMap((child) => collect(child, type)),
];

const withSlash = () => {
  const editor = new Editor({
    extensions: [
      StarterKit.configure(),
      EmailTheming.configure({ theme: 'basic' }),
      VariableNode,
      RepeatNode,
    ],
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '/' }] }],
    },
  });
  editors.push(editor);

  let from = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text === '/') {
      from = pos;
    }
  });

  return { editor, range: { from, to: from + 1 } };
};

describe('snippetSlashCommands', () => {
  const [totals] = snippetSlashCommands([
    { key: 'order-totals', label: 'Order totals', html: ORDER_TOTALS },
  ]);

  it('offers one command per snippet, titled with its label', () => {
    expect(totals.title).toBe('Order totals');
  });

  it('inserts the snippet as editable rows of pills', () => {
    const { editor, range } = withSlash();

    totals.command({ editor, range } as Parameters<typeof totals.command>[0]);

    const doc = editor.getJSON();

    expect(collect(doc, 'twoColumns')).toHaveLength(5);
    expect(collect(doc, 'variable').map((node) => node.attrs?.key)).toEqual([
      'order.subtotal',
      'order.discount_total',
      'order.shipping_total',
      'order.tax_total',
      'order.total',
    ]);
    expect(collect(doc, 'text').map((node) => node.text)).not.toContain('/');
  });

  it('inserts nothing for a snippet that does not parse into content', () => {
    const [empty] = snippetSlashCommands([
      { key: 'empty', label: 'Empty', html: '' },
    ]);
    const { editor, range } = withSlash();

    expect(() =>
      empty.command({ editor, range } as Parameters<typeof empty.command>[0]),
    ).not.toThrow();
  });
});

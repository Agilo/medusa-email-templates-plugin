import { composeReactEmail } from '@react-email/editor/core';
import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import type { EmailTemplateVariable } from '../../../lib/types';
import { scalarVariables, variablesAt } from '../../../lib/variables';
import { RepeatNode } from '../repeat-node';
import { VariableNode } from '../variable-node';

const variables: EmailTemplateVariable[] = [
  { key: 'order.display_id', label: 'Order number', example: 1001 },
  { key: 'order.currency_code', label: 'Currency', example: 'eur' },
  {
    key: 'order.items',
    label: 'Order items',
    type: 'list',
    example: [],
    fields: [
      { key: 'title', label: 'Product', example: 'Shirt' },
      {
        key: 'total',
        label: 'Line total',
        example: 30,
        type: 'money',
        currencyKey: 'order.currency_code',
      },
    ],
  },
];

const editors: Editor[] = [];

const createEditor = (content: JSONContent[]) => {
  const editor = new Editor({
    extensions: [
      StarterKit.configure(),
      EmailTheming.configure({ theme: 'basic' }),
      VariableNode.configure({ variables }),
      RepeatNode.configure({ variables }),
    ],
    content: { type: 'doc', content },
  });
  editors.push(editor);

  return editor;
};

/** Position of the first node of a type, found rather than counted. */
const positionOf = (editor: Editor, type: string): number => {
  let position = -1;
  editor.state.doc.descendants((node, pos) => {
    if (position < 0 && node.type.name === type) {
      position = pos;
    }
  });

  return position;
};

const repeatOver = (
  source: string | null,
  content: JSONContent[],
): JSONContent => ({ type: 'repeat', attrs: { source }, content });

const pill = (key: string): JSONContent => ({
  type: 'variable',
  attrs: { key },
});

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('variablesAt', () => {
  it('offers only printable values outside a Repeat block', () => {
    const editor = createEditor([
      { type: 'paragraph', content: [pill('order.display_id')] },
    ]);
    const keys = variablesAt(
      editor.state.doc,
      positionOf(editor, 'variable'),
      variables,
    ).map((variable) => variable.key);

    expect(keys).toEqual(['order.display_id', 'order.currency_code']);
  });

  it('adds the entry values inside a Repeat block', () => {
    const editor = createEditor([
      repeatOver('order.items', [
        { type: 'paragraph', content: [pill('item.title')] },
      ]),
    ]);
    const scoped = variablesAt(
      editor.state.doc,
      positionOf(editor, 'variable'),
      variables,
    );

    expect(scoped.map((variable) => variable.key)).toEqual([
      'order.display_id',
      'order.currency_code',
      'item.title',
      'item.total',
    ]);
    const lineTotal = scoped[scoped.length - 1];

    // The currency stays on the outer scope, which a loop can still read.
    expect(lineTotal.currencyKey).toBe('order.currency_code');
    expect(lineTotal.group).toBe('Order items');
  });

  it('adds nothing for a block over a list the event does not declare', () => {
    const editor = createEditor([
      repeatOver('order.gone', [
        { type: 'paragraph', content: [pill('item.title')] },
      ]),
    ]);

    expect(
      variablesAt(editor.state.doc, positionOf(editor, 'variable'), variables),
    ).toEqual(scalarVariables(variables));
  });
});

describe('RepeatNode export', () => {
  const exportHtml = async (content: JSONContent[]) =>
    (await composeReactEmail({ editor: createEditor(content) }))
      .unformattedHtml;

  it('wraps its content in a loop between the outer element and the body', async () => {
    const html = await exportHtml([
      repeatOver('order.items', [
        { type: 'paragraph', content: [pill('item.title')] },
      ]),
    ]);

    expect(html).toMatch(
      /<div data-repeat="order\.items">\{% for item in order\.items %\}<div data-repeat-body="">.*\{\{ item\.title \}\}.*<\/div>\{% endfor %\}<\/div>/,
    );
  });

  it('writes an unfinished block once, without a loop', async () => {
    const html = await exportHtml([
      repeatOver(null, [
        { type: 'paragraph', content: [{ type: 'text', text: 'Once' }] },
      ]),
    ]);

    expect(html).toContain('Once');
    expect(html).not.toContain('{%');
  });

  it('refuses a source that could break the loop tag', async () => {
    await expect(
      exportHtml([repeatOver('order.items %}{% raw', [{ type: 'paragraph' }])]),
    ).rejects.toThrow(/repeat source/);
  });
});

describe('setRepeat', () => {
  it('inserts a block over the list, holding the given content', () => {
    const editor = createEditor([{ type: 'paragraph' }]);

    editor.commands.setRepeat({
      source: 'order.items',
      content: [{ type: 'paragraph', content: [pill('item.title')] }],
    });

    const block = editor.state.doc.nodeAt(positionOf(editor, 'repeat'));

    expect(block?.attrs.source).toBe('order.items');
    expect(block?.textContent).toBe('');
    expect(positionOf(editor, 'variable')).toBeGreaterThan(
      positionOf(editor, 'repeat'),
    );
  });

  it('refuses to nest a block inside another', () => {
    const editor = createEditor([
      repeatOver('order.items', [{ type: 'paragraph' }]),
    ]);

    editor.commands.setTextSelection(positionOf(editor, 'repeat') + 2);

    expect(
      editor.commands.setRepeat({ source: 'order.items', content: [] }),
    ).toBe(false);
  });
});

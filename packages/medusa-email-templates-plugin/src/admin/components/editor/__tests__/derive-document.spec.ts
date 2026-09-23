import { composeReactEmail } from '@react-email/editor/core';
import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import { orderPlacedDefaultTemplate } from '../../../../lib/events/built-in/default-templates/order-placed';
import { deriveEditorContent, withVariableNodes } from '../derive-document';
import { VariableNode } from '../variable-node';

const extensions = [
  StarterKit.configure(),
  EmailTheming.configure({ theme: 'basic' }),
  VariableNode,
];

const editors: Editor[] = [];

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

/** Every node of a type, anywhere in the document. */
const collect = (node: JSONContent, type: string): JSONContent[] => {
  const found: JSONContent[] = [];
  const walk = (current: JSONContent) => {
    if (current.type === type) {
      found.push(current);
    }
    (current.content ?? []).forEach(walk);
  };
  walk(node);

  return found;
};

const paragraphWith = (text: string): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('withVariableNodes', () => {
  it('splits an expression out of the prose around it', () => {
    const doc = withVariableNodes(
      paragraphWith('Hi {{ order.customer_name }},'),
    );

    expect(doc.content?.[0].content).toEqual([
      { type: 'text', text: 'Hi ' },
      {
        type: 'variable',
        attrs: {
          key: 'order.customer_name',
          format: 'text',
          currencySource: null,
        },
      },
      { type: 'text', text: ',' },
    ]);
  });

  it('replaces a run that is nothing but an expression', () => {
    const doc = withVariableNodes(
      paragraphWith('{{ order.total | money: order.currency_code }}'),
    );

    // No empty text nodes either side: ProseMirror rejects those outright.
    expect(doc.content?.[0].content).toEqual([
      {
        type: 'variable',
        attrs: {
          key: 'order.total',
          format: 'money',
          currencySource: 'order.currency_code',
        },
      },
    ]);
  });

  it('keeps the marks a run carried on both sides of the pill', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'bold' }],
              text: 'Total {{ order.total }} due',
            },
          ],
        },
      ],
    };

    const [before, , after] = withVariableNodes(doc).content?.[0].content ?? [];

    expect(before).toEqual({
      type: 'text',
      marks: [{ type: 'bold' }],
      text: 'Total ',
    });
    expect(after).toEqual({
      type: 'text',
      marks: [{ type: 'bold' }],
      text: ' due',
    });
  });

  it('leaves an expression it cannot regenerate as plain text', () => {
    const doc = withVariableNodes(
      paragraphWith('{{ order.created_at | date: "%b %d" }}'),
    );

    expect(collect(doc, 'variable')).toEqual([]);
    expect(doc.content?.[0].content?.[0].text).toContain('date:');
  });

  it('descends into nested structure', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [paragraphWith('{{ order.total }}').content![0]],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(collect(withVariableNodes(doc), 'variable')).toHaveLength(1);
  });
});

describe('deriveEditorContent', () => {
  it('turns the real default template into a document with pills', () => {
    const doc = deriveEditorContent(
      orderPlacedDefaultTemplate.html,
      extensions,
    );

    const keys = collect(doc, 'variable').map((node) => node.attrs?.key);

    expect(keys).toEqual([
      'order.customer_name',
      'order.display_id',
      'order.subtotal',
      'order.shipping_total',
      'order.tax_total',
      'order.total',
      'store.name',
    ]);
  });

  it('leaves no raw Liquid anywhere in the document text', () => {
    const doc = deriveEditorContent(
      orderPlacedDefaultTemplate.html,
      extensions,
    );

    collect(doc, 'text').forEach((node) => {
      expect(node.text).not.toMatch(/\{\{|\{%/);
    });
  });

  it('keeps the structure the HTML described', () => {
    const doc = deriveEditorContent(
      orderPlacedDefaultTemplate.html,
      extensions,
    );

    expect(collect(doc, 'heading')).toHaveLength(1);
    expect(collect(doc, 'table')).toHaveLength(1);
    // Four totals rows, each still carrying its own cells.
    expect(collect(doc, 'tableRow')).toHaveLength(4);
  });

  /*
   * The property the whole feature rests on. Deriving a document and exporting
   * it must reproduce the same expressions the HTML started with — otherwise
   * opening a template and saving it would silently rewrite the email.
   */
  it('exports back to the expressions it was derived from', async () => {
    const editor = new Editor({
      extensions,
      content: deriveEditorContent(orderPlacedDefaultTemplate.html, extensions),
    });
    editors.push(editor);

    /*
     * `unformattedHtml`, not `html`. The formatted variant exists for source
     * views and wraps long lines, which splits the longest expression here
     * across a line break — the Liquid stays valid but stops being a
     * contiguous substring. The unformatted variant is what `getBody` stores
     * as `html_template`, so it is also the one that actually sends.
     */
    const { unformattedHtml } = await composeReactEmail({ editor });

    [
      '{{ order.customer_name }}',
      '{{ order.display_id }}',
      '{{ order.subtotal | money: order.currency_code }}',
      '{{ order.shipping_total | money: order.currency_code }}',
      '{{ order.tax_total | money: order.currency_code }}',
      '{{ order.total | money: order.currency_code }}',
      '{{ store.name }}',
    ].forEach((expression) => {
      expect(unformattedHtml).toContain(expression);
    });
  });
});

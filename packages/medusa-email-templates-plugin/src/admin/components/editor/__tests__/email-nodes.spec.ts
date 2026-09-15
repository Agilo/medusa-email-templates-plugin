import { composeReactEmail } from '@react-email/editor/core';
import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
import { Editor, type JSONContent } from '@tiptap/core';
import { Liquid } from 'liquidjs';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ORDER_ITEMS_LOOP_END,
  ORDER_ITEMS_LOOP_START,
  OrderItemsNode,
} from '../order-items-node';
import { toLiquidOutput, VariableNode } from '../variable-node';

const content: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Order #' },
        { type: 'variable', attrs: { key: 'order.display_id' } },
      ],
    },
    { type: 'orderItems' },
  ],
};

const editors: Editor[] = [];

const exportEmail = async () => {
  const editor = new Editor({
    extensions: [
      StarterKit.configure(),
      EmailTheming.configure({ theme: 'basic' }),
      VariableNode,
      OrderItemsNode,
    ],
    content,
  });
  editors.push(editor);

  return composeReactEmail({ editor });
};

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('email editor nodes export', () => {
  it('exports a variable as a literal Liquid output tag', async () => {
    const { html, text } = await exportEmail();

    expect(html).toContain('{{ order.display_id }}');
    expect(text).toContain('{{ order.display_id }}');
  });

  it('exports the order items block with an intact Liquid loop', async () => {
    const { html } = await exportEmail();

    expect(html).toContain(ORDER_ITEMS_LOOP_START);
    expect(html).toContain(ORDER_ITEMS_LOOP_END);
    expect(html).toContain('{{ item.title }}');
  });

  it('produces HTML that liquidjs parses and renders', async () => {
    const { html } = await exportEmail();
    const liquid = new Liquid({ outputEscape: 'escape', strictFilters: true });

    const rendered = await liquid.parseAndRender(html, {
      order: {
        display_id: 1001,
        items: [
          { title: 'Medusa T-Shirt', quantity: 2, total: '40.00' },
          { title: 'Sweatpants <XL>', quantity: 1, total: '35.00' },
        ],
      },
    });

    expect(rendered).toContain('1001');
    expect(rendered).toContain('Medusa T-Shirt');
    expect(rendered).toContain('Sweatpants &lt;XL&gt;');
    expect(rendered).not.toContain('{{');
    expect(rendered).not.toContain('{%');
  });

  it('rejects variable keys that could break Liquid output', () => {
    expect(toLiquidOutput('order.display_id')).toBe('{{ order.display_id }}');
    expect(() => toLiquidOutput('order."id"')).toThrow();
    expect(() => toLiquidOutput('order.id | date: "%b"')).toThrow();
  });
});

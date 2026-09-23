import { composeReactEmail } from '@react-email/editor/core';
import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

// The real renderer, so this test sees the same registered filters a send
// does. A bare `new Liquid()` has none, and `strictFilters` would reject any
// generated filter the nodes emit.
import { createEmailLiquid } from '../../../../lib/rendering/liquid';
import { toLiquidExpression } from '../../../../lib/rendering/variable-format';

import {
  ORDER_ITEMS_LOOP_END,
  ORDER_ITEMS_LOOP_START,
  OrderItemsNode,
} from '../order-items-node';
import { UNSET_VARIABLE_LABEL, VariableNode } from '../variable-node';

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

const exportEmail = async (doc: JSONContent = content) => {
  const editor = new Editor({
    extensions: [
      StarterKit.configure(),
      EmailTheming.configure({ theme: 'basic' }),
      VariableNode,
      OrderItemsNode,
    ],
    content: doc,
  });
  editors.push(editor);

  return composeReactEmail({ editor });
};

/** A document holding one variable pill, for exercising formats. */
const variableDoc = (attrs: Record<string, unknown>): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'variable', attrs }] }],
});

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
    const liquid = createEmailLiquid({ escapeOutput: true });

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
    expect(toLiquidExpression('order.display_id')).toBe(
      '{{ order.display_id }}',
    );
    expect(() => toLiquidExpression('order."id"')).toThrow();
    expect(() => toLiquidExpression('order.id | date: "%b"')).toThrow();
  });
});

describe('variable formats', () => {
  it('exports a money variable with its currency as an identifier', async () => {
    const { html } = await exportEmail(
      variableDoc({
        key: 'order.total',
        format: 'money',
        currencySource: 'order.currency_code',
      }),
    );

    // An identifier argument survives export; a quoted one would not.
    expect(html).toContain('{{ order.total | money: order.currency_code }}');
  });

  it('exports a date variable through a no-argument filter', async () => {
    const { html } = await exportEmail(
      variableDoc({ key: 'order.created_at', format: 'date_long' }),
    );

    expect(html).toContain('{{ order.created_at | date_long }}');
  });

  it('keeps an unformatted variable exactly as before', async () => {
    const { html } = await exportEmail(
      variableDoc({ key: 'order.display_id' }),
    );

    expect(html).toContain('{{ order.display_id }}');
    expect(html).not.toContain('|');
  });

  it('omits a pill whose variable has not been chosen', async () => {
    const { html } = await exportEmail(variableDoc({ key: '' }));

    expect(html).not.toContain('{{');
    expect(html).not.toContain(UNSET_VARIABLE_LABEL);
  });

  it('renders the generated expressions through the real renderer', async () => {
    const money = await exportEmail(
      variableDoc({
        key: 'order.total',
        format: 'money',
        currencySource: 'order.currency_code',
      }),
    );
    const date = await exportEmail(
      variableDoc({ key: 'order.created_at', format: 'date_long' }),
    );
    const liquid = createEmailLiquid({ escapeOutput: true });
    const data = {
      order: {
        total: 40,
        currency_code: 'eur',
        created_at: '2026-10-01T10:00:00.000Z',
      },
    };

    await expect(liquid.parseAndRender(money.html, data)).resolves.toContain(
      '€40.00',
    );
    await expect(liquid.parseAndRender(date.html, data)).resolves.toContain(
      'October',
    );
  });
});

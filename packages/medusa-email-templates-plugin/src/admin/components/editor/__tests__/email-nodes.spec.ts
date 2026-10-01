import { composeReactEmail } from '@react-email/editor/core';
import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import { createEmailLiquid } from '../../../../lib/rendering/liquid';
import { toLiquidExpression } from '../../../../lib/rendering/variable-format';

import {
  styleFromCss,
  UNSET_VARIABLE_LABEL,
  VariableNode,
} from '../variable-node';

const content: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Order #' },
        { type: 'variable', attrs: { key: 'order.display_id' } },
        { type: 'text', text: ' from ' },
        { type: 'variable', attrs: { key: 'store.name' } },
      ],
    },
  ],
};

const editors: Editor[] = [];

const exportEmail = async (doc: JSONContent = content) => {
  const editor = new Editor({
    extensions: [
      StarterKit.configure(),
      EmailTheming.configure({ theme: 'basic' }),
      VariableNode,
    ],
    content: doc,
  });
  editors.push(editor);

  return composeReactEmail({ editor });
};

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

  it('produces HTML that liquidjs parses and renders', async () => {
    const { html } = await exportEmail();
    const liquid = createEmailLiquid({ escapeOutput: true });

    const rendered = await liquid.parseAndRender(html, {
      order: { display_id: 1001 },
      // Angle brackets on purpose: this is the only assertion proving
      // `outputEscape` is on, and a value that reached the inbox unescaped
      // would break the markup around it.
      store: { name: 'Shop <XL>' },
    });

    expect(rendered).toContain('1001');
    expect(rendered).toContain('Shop &lt;XL&gt;');
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

describe('variable typography', () => {
  it('reads the declaration list the Inspector writes', () => {
    expect(
      styleFromCss('color: #ff0000; font-size: 20px;line-height:120%'),
    ).toEqual({ color: '#ff0000', fontSize: '20px', lineHeight: '120%' });
    expect(styleFromCss('')).toEqual({});
    expect(styleFromCss(null)).toEqual({});
  });

  it('wraps only the expression in a styled span', async () => {
    const { unformattedHtml: html } = await exportEmail({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Total ' },
            {
              type: 'variable',
              attrs: {
                key: 'order.total',
                format: 'money',
                currencySource: 'order.currency_code',
                style: 'color:#ff0000;font-size:20px',
              },
            },
          ],
        },
      ],
    });

    expect(html).toContain(
      '<span style="color:#ff0000;font-size:20px">{{ order.total | money: order.currency_code }}</span>',
    );
    await expect(
      createEmailLiquid({ escapeOutput: true }).parseAndRender(html, {
        order: { total: 55, currency_code: 'eur' },
      }),
    ).resolves.toContain(
      '<span style="color:#ff0000;font-size:20px">€55.00</span>',
    );
  });

  it('adds no span to an unstyled pill', async () => {
    const { html } = await exportEmail(
      variableDoc({ key: 'order.display_id', style: '' }),
    );

    expect(html).not.toMatch(/<span[^>]*>\{\{ order\.display_id \}\}/);
  });
});

describe('variable formatting', () => {
  it('wraps a formatted pill in its marks around the Liquid', async () => {
    const { html } = await exportEmail({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'variable',
              attrs: { key: 'order.display_id' },
              marks: [{ type: 'bold' }, { type: 'italic' }],
            },
          ],
        },
      ],
    });

    expect(html).toContain('<em><strong>{{ order.display_id }}</strong></em>');
    await expect(
      createEmailLiquid({ escapeOutput: true }).parseAndRender(html, {
        order: { display_id: 1001 },
      }),
    ).resolves.toContain('<em><strong>1001</strong></em>');
  });
});

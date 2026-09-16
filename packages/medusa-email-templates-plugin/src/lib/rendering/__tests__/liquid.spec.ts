import { describe, expect, it } from 'vitest';

import { createEmailLiquid } from '../liquid';
import { sanitizeTemplateContext } from '../sanitize-context';

const liquid = createEmailLiquid();

describe('createEmailLiquid hardening', () => {
  it.each([
    ['include', '{% include "other" %}'],
    ['render', '{% render "other" %}'],
    ['layout', '{% layout "base" %}'],
  ])('rejects the %s tag', async (_name, template) => {
    await expect(liquid.parseAndRender(template, {})).rejects.toThrow(
      'not allowed in email templates',
    );
  });

  it('rejects unknown filters', async () => {
    await expect(
      liquid.parseAndRender('{{ name | exfiltrate }}', { name: 'x' }),
    ).rejects.toThrow();
  });

  it('hides prototype properties', async () => {
    await expect(
      liquid.parseAndRender('[{{ order.constructor }}][{{ order.toString }}]', {
        order: { id: 'order_1' },
      }),
    ).resolves.toBe('[][]');
  });

  it('stops templates that exceed the parse limit', async () => {
    const huge = '{{ name }}'.repeat(200_000);

    await expect(liquid.parseAndRender(huge, { name: 'x' })).rejects.toThrow();
  });

  it('renders undefined variables as empty strings', async () => {
    await expect(
      liquid.parseAndRender('[{{ missing.deep }}]', {}),
    ).resolves.toBe('[]');
  });

  it('escapes output only when asked', async () => {
    const htmlLiquid = createEmailLiquid({ escapeOutput: true });
    const data = { name: '<script>alert(1)</script>' };

    await expect(htmlLiquid.parseAndRender('{{ name }}', data)).resolves.toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    await expect(liquid.parseAndRender('{{ name }}', data)).resolves.toBe(
      data.name,
    );
  });
});

describe('money filter', () => {
  it.each([
    [40, 'eur', '€40.00'],
    [1234.5, 'usd', '$1,234.50'],
    ['25', 'usd', '$25.00'],
    [10, undefined, '10.00'],
    ['not a number', 'usd', ''],
  ])('formats %s %s', async (amount, currency, expected) => {
    const result = await liquid.parseAndRender(
      currency ? '{{ amount | money: currency }}' : '{{ amount | money }}',
      { amount, currency },
    );

    expect(result).toBe(expected);
  });
});

describe('sanitizeTemplateContext', () => {
  it('drops functions and class instances but keeps plain data', () => {
    class Order {
      id = 'order_1';
    }

    expect(
      sanitizeTemplateContext({
        order: new Order(),
        send: () => 'nope',
        items: [{ title: 'Shirt', quantity: 2 }],
      }),
    ).toEqual({
      order: { id: 'order_1' },
      items: [{ title: 'Shirt', quantity: 2 }],
    });
  });

  it('returns an empty object for missing data', () => {
    expect(sanitizeTemplateContext(null)).toEqual({});
    expect(sanitizeTemplateContext(undefined)).toEqual({});
  });
});

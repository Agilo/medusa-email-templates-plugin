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

describe('date filters', () => {
  const render = (filter: string, value: unknown) =>
    liquid.parseAndRender(`{{ value | ${filter} }}`, { value });

  const iso = '2026-10-01T10:00:00.000Z';

  // Exact output for the numeric format, which is stable across ICU versions.
  it('formats a short date', async () => {
    await expect(render('date_short', iso)).resolves.toBe('10/01/2026');
  });

  // The written formats vary between ICU versions (the "at" separator in
  // particular), so these assert on the parts rather than the whole string.
  it('formats a long date', async () => {
    const result = await render('date_long', iso);

    expect(result).toContain('October');
    expect(result).toContain('2026');
  });

  it('formats a date and time', async () => {
    const result = await render('date_time', iso);

    expect(result).toContain('October');
    expect(result).toContain('2026');
    expect(result).toContain('10:00');
  });

  it('renders in UTC rather than the machine timezone', async () => {
    // 23:30 UTC would be the following day in any positive offset.
    await expect(
      render('date_short', '2026-10-01T23:30:00.000Z'),
    ).resolves.toBe('10/01/2026');
  });

  it.each([['not a date'], [''], [null], [undefined], [{ nested: true }]])(
    'renders %s as an empty string',
    async (value) => {
      await expect(render('date_long', value)).resolves.toBe('');
    },
  );
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

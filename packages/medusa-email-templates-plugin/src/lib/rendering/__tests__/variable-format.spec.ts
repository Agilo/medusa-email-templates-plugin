import { describe, expect, it } from 'vitest';

import {
  findLiquidExpressions,
  fromLiquidExpression,
  toLiquidExpression,
  toLiquidLoop,
} from '../variable-format';

describe('fromLiquidExpression', () => {
  /*
   * The property that matters. Importing a template turns its text back into
   * variable attributes, and saving turns those attributes back into text. If
   * the two disagree for any format, opening a template and saving it would
   * silently rewrite expressions that were already correct.
   */
  it.each([
    ['plain text', 'order.display_id', 'text' as const, undefined],
    ['money without a currency', 'order.total', 'money' as const, undefined],
    [
      'money with a currency',
      'order.total',
      'money' as const,
      'order.currency_code',
    ],
    ['a long date', 'order.created_at', 'date_long' as const, undefined],
    ['a short date', 'order.created_at', 'date_short' as const, undefined],
    ['a date and time', 'order.created_at', 'date_time' as const, undefined],
  ])('round-trips %s', (_label, key, format, currencySource) => {
    const expression = toLiquidExpression(key, format, { currencySource });

    expect(fromLiquidExpression(expression)).toEqual(
      currencySource ? { key, format, currencySource } : { key, format },
    );
  });

  it('reads a tag regardless of its internal spacing', () => {
    expect(
      fromLiquidExpression('{{order.total|money:order.currency_code}}'),
    ).toEqual({
      key: 'order.total',
      format: 'money',
      currencySource: 'order.currency_code',
    });
  });

  /*
   * Everything below is left as literal text instead. A pill that claimed to
   * represent an expression it cannot regenerate would rewrite the template
   * the moment someone saved.
   */
  it.each([
    ['a quoted filter argument', '{{ order.created_at | date: "%b %d" }}'],
    ['a single-quoted argument', "{{ order.total | money: 'eur' }}"],
    ['an unknown filter', '{{ order.total | upcase }}'],
    ['an explicit text filter', '{{ order.total | text }}'],
    ['a no-argument filter given one', '{{ order.created_at | date_long: x }}'],
    ['a chain of filters', '{{ order.total | money | upcase }}'],
    ['a control-flow tag', '{% for item in order.items %}'],
    ['an uppercase key', '{{ Order.Total }}'],
    ['not an expression at all', 'Subtotal'],
  ])('refuses %s', (_label, expression) => {
    expect(fromLiquidExpression(expression)).toBeNull();
  });
});

describe('findLiquidExpressions', () => {
  // The exact strings the default order-placed template produces.
  const PROSE =
    'We received your order #{{ order.display_id }} and are getting it ready.';
  const WHOLE = '{{ order.subtotal | money: order.currency_code }}';

  it('locates an expression embedded in prose', () => {
    const [match] = findLiquidExpressions(PROSE);

    expect(match).toMatchObject({
      key: 'order.display_id',
      format: 'text',
      source: '{{ order.display_id }}',
    });
    // The offsets are what a document import slices on, so they have to name
    // exactly the tag and nothing around it.
    expect(PROSE.slice(match.start, match.end)).toBe('{{ order.display_id }}');
  });

  it('locates an expression that is the whole run', () => {
    const [match] = findLiquidExpressions(WHOLE);

    expect(match).toMatchObject({
      key: 'order.subtotal',
      format: 'money',
      currencySource: 'order.currency_code',
    });
    expect(match.start).toBe(0);
    expect(match.end).toBe(WHOLE.length);
  });

  it('finds several in one run, in order', () => {
    const text = 'Hi {{ order.customer_name }}, your {{ store.name }} order';

    expect(findLiquidExpressions(text).map((m) => m.key)).toEqual([
      'order.customer_name',
      'store.name',
    ]);
  });

  /*
   * `exec` on a global regex advances `lastIndex`, so a shared pattern would
   * return different results on a second call with the same input. This is the
   * bug that only ever shows up on the second template someone opens.
   */
  it('returns the same matches when called twice', () => {
    expect(findLiquidExpressions(PROSE)).toEqual(findLiquidExpressions(PROSE));
  });

  it('skips expressions it cannot regenerate, keeping the rest', () => {
    const text = '{{ order.total | money }} and {{ bad | date: "%b" }}';

    expect(findLiquidExpressions(text).map((m) => m.key)).toEqual([
      'order.total',
    ]);
  });

  it('finds nothing in ordinary text', () => {
    expect(findLiquidExpressions('Thanks for your order')).toEqual([]);
  });
});

describe('toLiquidLoop', () => {
  it('loops over a list as item', () => {
    expect(toLiquidLoop('order.items')).toEqual({
      open: '{% for item in order.items %}',
      close: '{% endfor %}',
    });
  });

  it.each([
    ['a quote', 'order."items"'],
    ['a filter', 'order.items | reverse'],
    ['a closing tag', 'order.items %}{% raw'],
    ['nothing', ''],
  ])('rejects a source containing %s', (_, source) => {
    expect(() => toLiquidLoop(source)).toThrow(/repeat source/);
  });
});

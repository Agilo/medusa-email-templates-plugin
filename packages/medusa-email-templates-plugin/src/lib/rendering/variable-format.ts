/**
 * Maps a variable's display format to the Liquid expression that produces it.
 *
 * Shared by two sides: the admin editor generates these expressions when it
 * exports a template, and the server registers the matching filters in
 * `./liquid.ts`. Keep this module dependency-free — it is bundled into the
 * admin's browser chunk, so it must not reach for Node APIs, `liquidjs`, or
 * anything from `@medusajs/framework`.
 *
 * Every expression it produces is quote-free by construction. React entity-
 * encodes `"` and `'` in text children, so a filter argument written as a
 * string literal is corrupted on export; only bare identifiers and
 * no-argument filters survive intact.
 */

const VARIABLE_FORMATS = [
  'text',
  'money',
  'date_long',
  'date_short',
  'date_time',
] as const;

export type VariableFormat = (typeof VARIABLE_FORMATS)[number];

/**
 * Dot-separated lowercase identifiers. Restricting the character set is what
 * guarantees a generated expression can never contain a quote.
 */
export const VARIABLE_KEY_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

export const isVariableFormat = (value: unknown): value is VariableFormat =>
  typeof value === 'string' &&
  (VARIABLE_FORMATS as readonly string[]).includes(value);

type ToLiquidExpressionOptions = {
  /**
   * Liquid path to the currency code, used by the `money` format. Emitted
   * verbatim rather than rewritten, so inside a `{% for %}` loop it still
   * refers to the outer scope — `order.currency_code`, not `item.*`.
   */
  currencySource?: string;
};

const assertIdentifier = (value: string, label: string): void => {
  if (!VARIABLE_KEY_PATTERN.test(value)) {
    throw new Error(`Invalid email template ${label}: "${value}"`);
  }
};

/**
 * Builds the Liquid output tag for a variable. The admin never lets someone
 * type an expression; it stores `{ key, format }` and calls this instead.
 */
export const toLiquidExpression = (
  key: string,
  format: VariableFormat = 'text',
  options: ToLiquidExpressionOptions = {},
): string => {
  assertIdentifier(key, 'variable key');

  if (format === 'text') {
    return `{{ ${key} }}`;
  }

  if (format === 'money') {
    const { currencySource } = options;

    // `formatMoney` falls back to a plain two-decimal string without a
    // currency, so omitting the argument is valid rather than an error.
    if (currencySource === undefined) {
      return `{{ ${key} | money }}`;
    }

    assertIdentifier(currencySource, 'currency source');

    return `{{ ${key} | money: ${currencySource} }}`;
  }

  return `{{ ${key} | ${format} }}`;
};

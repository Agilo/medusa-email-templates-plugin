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

/** What one output tag in a template resolves to. */
export type ParsedLiquidExpression = {
  key: string;
  format: VariableFormat;
  currencySource?: string;
};

/** A parsed expression together with where it sat in the surrounding text. */
export type LiquidExpressionMatch = ParsedLiquidExpression & {
  /** The whole `{{ … }}` tag, exactly as it appeared. */
  source: string;
  start: number;
  end: number;
};

/*
 * Deliberately narrow: `{{ key }}`, `{{ key | filter }}` or
 * `{{ key | filter: argument }}`, with identifiers on both sides and nothing
 * else. It is the inverse of `toLiquidExpression`, so it recognises only what
 * that could have produced — anything richer is left as text rather than
 * guessed at, because a variable pill claiming to be an expression it cannot
 * regenerate would silently rewrite the template on the next save.
 */
const EXPRESSION_PATTERN =
  /\{\{\s*([a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*(?:\|\s*([a-z0-9_]+)\s*(?::\s*([a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*)?)?\}\}/g;

/**
 * Reads one output tag back into the attributes that produce it.
 *
 * Returns null for anything this module could not have generated, which
 * includes an unknown filter, a quoted argument, or a `money` argument that is
 * not a bare identifier path.
 */
export const fromLiquidExpression = (
  expression: string,
): ParsedLiquidExpression | null => {
  // `exec` on a global regex is stateful, so this match is taken from a
  // one-shot copy rather than the shared pattern.
  const match = new RegExp(`^${EXPRESSION_PATTERN.source}$`, 's').exec(
    expression.trim(),
  );

  if (!match) {
    return null;
  }

  const [, key, filter, argument] = match;

  if (!filter) {
    return { key, format: 'text' };
  }

  if (!isVariableFormat(filter) || filter === 'text') {
    return null;
  }

  if (filter === 'money') {
    return argument
      ? { key, format: filter, currencySource: argument }
      : { key, format: filter };
  }

  // Every remaining format is a no-argument filter; an argument means this is
  // something else wearing a familiar name.
  return argument ? null : { key, format: filter };
};

/**
 * Every expression inside a run of text, with its position.
 *
 * Positions matter because an expression is often embedded in prose —
 * `Hi {{ order.customer_name }},` — so importing a template has to split the
 * run around it rather than replace the run wholesale.
 */
export const findLiquidExpressions = (
  text: string,
): LiquidExpressionMatch[] => {
  const matches: LiquidExpressionMatch[] = [];
  const pattern = new RegExp(EXPRESSION_PATTERN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const parsed = fromLiquidExpression(match[0]);

    // Skip what cannot be regenerated, leaving it as literal text.
    if (parsed) {
      matches.push({
        ...parsed,
        source: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return matches;
};

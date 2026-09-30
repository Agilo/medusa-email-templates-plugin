/**
 * Maps a variable's display format to the Liquid expression that produces it.
 *
 * Shared by the admin editor (which emits these on export) and the server
 * (which registers the matching filters in `./liquid.ts`). It is bundled into
 * the admin, so keep it dependency-free: no Node APIs, `liquidjs` or
 * `@medusajs/framework`.
 *
 * Expressions are quote-free by construction: React entity-encodes quotes on
 * export, which would corrupt string-literal filter arguments.
 */

const VARIABLE_FORMATS = [
  'text',
  'money',
  'date_long',
  'date_short',
  'date_time',
] as const;

export type VariableFormat = (typeof VARIABLE_FORMATS)[number];

/** Dot-separated lowercase identifiers, so an expression never has a quote. */
export const VARIABLE_KEY_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

export const isVariableFormat = (value: unknown): value is VariableFormat =>
  typeof value === 'string' &&
  (VARIABLE_FORMATS as readonly string[]).includes(value);

type ToLiquidExpressionOptions = {
  /**
   * Liquid path to the currency code for `money`. Emitted verbatim, so inside
   * a loop it still refers to the outer scope (`order.currency_code`).
   */
  currencySource?: string;
};

const assertIdentifier = (value: string, label: string): void => {
  if (!VARIABLE_KEY_PATTERN.test(value)) {
    throw new Error(`Invalid email template ${label}: "${value}"`);
  }
};

/**
 * Builds the Liquid output tag for a variable. The admin stores
 * `{ key, format }` and calls this; nobody types expressions.
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

    // Valid without a currency: `formatMoney` falls back to two decimals.
    if (currencySource === undefined) {
      return `{{ ${key} | money }}`;
    }

    assertIdentifier(currencySource, 'currency source');

    return `{{ ${key} | money: ${currencySource} }}`;
  }

  return `{{ ${key} | ${format} }}`;
};

/** The loop alias for each entry. Fixed, since Repeat blocks don't nest. */
export const LOOP_ITEM = 'item';

/**
 * The loop tags a Repeat block wraps its content in. Quote-free: the source
 * must pass the identifier check.
 */
export const toLiquidLoop = (
  source: string,
): { open: string; close: string } => {
  assertIdentifier(source, 'repeat source');

  return {
    open: `{% for ${LOOP_ITEM} in ${source} %}`,
    close: '{% endfor %}',
  };
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
 * Matches only what `toLiquidExpression` can produce: `{{ key }}`,
 * `{{ key | filter }}` or `{{ key | filter: arg }}`. Anything richer stays as
 * text, since a pill that can't regenerate it would rewrite it on save.
 */
const EXPRESSION_PATTERN =
  /\{\{\s*([a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*(?:\|\s*([a-z0-9_]+)\s*(?::\s*([a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*)?)?\}\}/g;

/**
 * Parses one output tag back into pill attributes, or null for anything this
 * module couldn't have generated (unknown filter, quoted or non-identifier
 * argument).
 */
export const fromLiquidExpression = (
  expression: string,
): ParsedLiquidExpression | null => {
  // A fresh regex: `exec` on the shared global one is stateful.
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

  // Remaining formats take no argument; one means it isn't ours.
  return argument ? null : { key, format: filter };
};

/**
 * Every expression in a run of text, with its position, so the run can be
 * split around it (`Hi {{ order.customer_name }},`).
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

import type { VariableFormat } from './variable-format';

/**
 * Turns a value into the text a recipient sees.
 *
 * Shared by two callers: `./liquid.ts` registers these as Liquid filters for
 * real sends, and the admin editor calls them directly to preview what a
 * format produces. Sharing them is the point — a preview that used its own
 * formatting would be a guess rather than the truth.
 *
 * Keep this module dependency-free. It is bundled into the admin's browser
 * chunk, so no Node APIs, no `liquidjs`, nothing from `@medusajs/framework`.
 */

export type DateFormat = Extract<VariableFormat, `date_${string}`>;

/**
 * Keyed off the shared format union, so adding a `date_*` format without
 * giving it options here is a compile error rather than a `strictFilters`
 * failure at send time.
 */
const DATE_FORMATS: Record<DateFormat, Intl.DateTimeFormatOptions> = {
  date_long: { day: 'numeric', month: 'long', year: 'numeric' },
  date_short: { day: '2-digit', month: '2-digit', year: 'numeric' },
  date_time: {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  },
};

export const DATE_FORMAT_NAMES = Object.keys(DATE_FORMATS) as DateFormat[];

export const formatMoney = (value: unknown, currencyCode?: unknown): string => {
  const amount = typeof value === 'string' ? Number(value) : value;

  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '';
  }

  const currency =
    typeof currencyCode === 'string' && currencyCode.length === 3
      ? currencyCode.toUpperCase()
      : undefined;

  if (!currency) {
    return amount.toFixed(2);
  }

  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    amount,
  );
};

/**
 * Dates always arrive as strings: `sanitizeTemplateContext` round-trips the
 * context through JSON, so a `Date` has become an ISO string long before a
 * filter sees it. Numbers are accepted too, for a timestamp placed into
 * context directly.
 *
 * Output is pinned to UTC so a send renders the same text whatever the
 * server's timezone, and to `en-US` to match `formatMoney`. Both are recorded
 * limitations — locale awareness is a follow-up, not a decision.
 */
export const formatDate = (value: unknown, format: DateFormat): string => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }

  const date = new Date(value);

  // Invalid input renders empty rather than throwing, matching `formatMoney`.
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    ...DATE_FORMATS[format],
  }).format(date);
};

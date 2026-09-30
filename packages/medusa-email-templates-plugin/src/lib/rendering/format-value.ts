import type { VariableFormat } from './variable-format';

/**
 * Turns a value into the text a recipient sees.
 *
 * Shared by sends (registered as Liquid filters in `./liquid.ts`) and the
 * editor's previews, so previews show exactly what sends.
 *
 * Bundled into the admin, so keep it dependency-free: no Node APIs,
 * `liquidjs` or `@medusajs/framework`.
 */

export type DateFormat = Extract<VariableFormat, `date_${string}`>;

/**
 * Keyed by the shared format union, so a new `date_*` format without options
 * is a compile error, not a send-time `strictFilters` failure.
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
 * Dates arrive as ISO strings (the context is round-tripped through JSON);
 * numeric timestamps are accepted too.
 *
 * Pinned to UTC (same output on any server) and `en-US` (like `formatMoney`).
 * Both are known limitations; locale support is a follow-up.
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

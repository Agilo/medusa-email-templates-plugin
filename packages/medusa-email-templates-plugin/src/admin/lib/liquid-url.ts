/**
 * URL validation that allows Liquid.
 *
 * An href is an attribute, so it holds the raw Liquid expression rather than
 * a pill. The editor's validator rejects that (`new URL('{{ x }}')` throws,
 * and spaces are refused), and a rejected href is cleared by the bubble menus.
 */

/** Matches the editor's own `SAFE_PROTOCOLS`, which it does not export. */
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

const LIQUID = /\{\{[^{}]*\}\}/;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/**
 * Whether a value contains Liquid and is safe to pass through untouched:
 * `{{ invite_url }}` or `https://shop.test/{{ token }}`. Any scheme must still
 * be a safe one, so `javascript:{{ x }}` is rejected.
 */
export const isLiquidUrl = (value: string): boolean => {
  if (!LIQUID.test(value)) {
    return false;
  }

  const scheme = SCHEME.exec(value.trim());

  // No scheme (the common case): `{{ invite_url }}` becomes a full URL at send.
  if (!scheme) {
    return true;
  }

  return SAFE_PROTOCOLS.has(`${scheme[1].toLowerCase()}:`);
};

/**
 * Reproduces the editor's internal `getUrlFromString` exactly, so non-Liquid
 * values behave as before (including adding `https://` to a bare domain).
 */
const stockUrl = (value: string): string | null => {
  if (value === '#') {
    return value;
  }

  try {
    const url = new URL(value);

    return SAFE_PROTOCOLS.has(url.protocol) ? value : null;
  } catch {
    // Not an absolute URL; try it as a bare domain below.
  }

  try {
    if (value.includes('.') && !value.includes(' ')) {
      return new URL(`https://${value}`).toString();
    }
  } catch {
    // Not salvageable as a domain either.
  }

  return null;
};

/** Passed to both bubble menus as `validateUrl`. */
export const validateUrl = (value: string): string | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return isLiquidUrl(trimmed) ? trimmed : stockUrl(trimmed);
};

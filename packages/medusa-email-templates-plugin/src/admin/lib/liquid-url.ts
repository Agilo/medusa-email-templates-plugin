/**
 * URL validation that admits Liquid.
 *
 * A link or button href is an *attribute*, not a text node, so a variable pill
 * cannot live there — the value has to be the Liquid expression itself. The
 * editor's own validator rejects that on two counts: `new URL('{{ x }}')`
 * throws, and its fallback branch refuses anything containing a space. A
 * rejected value is not merely ignored either — both bubble-menu forms clear
 * the href, which is why typing a variable made the link disappear.
 */

/** Matches the editor's own `SAFE_PROTOCOLS`, which it does not export. */
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

const LIQUID = /\{\{[^{}]*\}\}/;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/**
 * Whether a value carries Liquid and is safe to pass through untouched.
 *
 * Covers both `{{ invite_url }}` on its own and a URL with an expression in it
 * (`https://shop.test/{{ token }}`). A scheme, when present, still has to be
 * one of the safe four — otherwise `javascript:{{ x }}` would smuggle itself
 * past the check that exists to stop exactly that.
 */
export const isLiquidUrl = (value: string): boolean => {
  if (!LIQUID.test(value)) {
    return false;
  }

  const scheme = SCHEME.exec(value.trim());

  // No scheme at all is the common case: `{{ invite_url }}` renders to a full
  // URL at send time, so there is nothing to check here.
  if (!scheme) {
    return true;
  }

  return SAFE_PROTOCOLS.has(`${scheme[1].toLowerCase()}:`);
};

/**
 * Reproduces the editor's `getUrlFromString`, which is internal.
 *
 * Kept faithful on purpose: anything that is not Liquid must behave exactly as
 * it did before, including the bare-domain case that gets an `https://` prefix.
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

import { toLiquidLoop } from '../../../rendering/variable-format';

/*
 * The HTML shape of a Repeat block, written by default templates, parsed by
 * the editor and re-exported on save.
 *
 * The loop sits between the outer element and the body, so only the body
 * repeats, and the editor (reading only the body) never shows the loop tags
 * as text.
 *
 * Imported by the admin bundle: only the dependency-free `variable-format`
 * may be imported.
 */

/** On the outer element; its value is the list being repeated. */
export const REPEAT_ATTRIBUTE = 'data-repeat';

/** On the element that repeats, once per entry. */
export const REPEAT_BODY_ATTRIBUTE = 'data-repeat-body';

/** Wraps one entry's HTML so it renders once per entry of `source`. */
export const repeat = (source: string, body: string): string => {
  const { open, close } = toLiquidLoop(source);

  return `<div ${REPEAT_ATTRIBUTE}="${source}">${open}<div ${REPEAT_BODY_ATTRIBUTE}="">${body}</div>${close}</div>`;
};

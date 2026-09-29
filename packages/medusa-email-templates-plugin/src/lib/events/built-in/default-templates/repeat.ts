import { toLiquidLoop } from '../../../rendering/variable-format';

/*
 * The one HTML shape of a Repeat block, shared by three readers: a default
 * template writes it, the editor parses it into a block, and the editor
 * exports it again on save.
 *
 * The loop sits *between* the two elements, so the outer one appears once and
 * only the body repeats. That is also what makes it parseable: the editor
 * reads its content from the body alone, so the `{% for %}` and `{% endfor %}`
 * either side of it never become text on the canvas.
 *
 * Imported by the admin bundle, so this file may reach nothing beyond the
 * dependency-free `variable-format`.
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

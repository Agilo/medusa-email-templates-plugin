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

export const REPEAT_ATTRIBUTE = 'data-repeat';

export const REPEAT_BODY_ATTRIBUTE = 'data-repeat-body';

export const repeat = (source: string, body: string): string => {
  const { open, close } = toLiquidLoop(source);

  return `<div ${REPEAT_ATTRIBUTE}="${source}">${open}<div ${REPEAT_BODY_ATTRIBUTE}="">${body}</div>${close}</div>`;
};

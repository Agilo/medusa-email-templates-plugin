import type { Extensions, JSONContent } from '@tiptap/core';
import { generateJSON } from '@tiptap/react';

import { findLiquidExpressions } from '../../../lib/rendering/variable-format';

/**
 * Turns a template's stored HTML into an editor document.
 *
 * A template that nobody has edited has no `editor_content`, only the HTML its
 * event declared. Opening the editor on an empty document was the dangerous
 * part: the body would look blank, and the first keystroke made it dirty, so
 * saving exported that blankness over a designed email. Deriving means the
 * editor opens showing the real thing.
 *
 * Nothing here is persisted. The derived document is rebuilt each time the
 * editor opens, so it cannot go stale against an HTML default that changed
 * underneath it — `editor_content` stays null until someone actually edits.
 */

/**
 * Splits one text run around every expression inside it.
 *
 * Expressions arrive as literal text — `Hi {{ order.customer_name }},` — and
 * leaving them that way would put raw Liquid on the canvas, which is the one
 * thing the structured variable model exists to prevent. Splitting rather than
 * replacing matters because an expression is usually embedded in prose rather
 * than filling the run.
 */
const splitTextNode = (node: JSONContent): JSONContent[] => {
  const text = typeof node.text === 'string' ? node.text : '';
  const matches = findLiquidExpressions(text);

  if (matches.length === 0) {
    return [node];
  }

  const pieces: JSONContent[] = [];
  let cursor = 0;

  matches.forEach((match) => {
    // Spreading the original keeps whatever marks the run carried, so a bold
    // sentence stays bold either side of the pill.
    if (match.start > cursor) {
      pieces.push({ ...node, text: text.slice(cursor, match.start) });
    }

    pieces.push({
      type: 'variable',
      attrs: {
        key: match.key,
        format: match.format,
        currencySource: match.currencySource ?? null,
      },
    });

    cursor = match.end;
  });

  if (cursor < text.length) {
    pieces.push({ ...node, text: text.slice(cursor) });
  }

  return pieces;
};

/** Rewrites every text run in a document, depth first. */
export const withVariableNodes = (node: JSONContent): JSONContent => {
  if (!node.content) {
    return node;
  }

  return {
    ...node,
    content: node.content.flatMap((child) =>
      child.type === 'text' ? splitTextNode(child) : [withVariableNodes(child)],
    ),
  };
};

/**
 * Builds an editor document from a template's HTML.
 *
 * `extensions` is passed in rather than built here on purpose: the document
 * has to be generated against the same schema the editor will load it into.
 * Two separately assembled arrays could drift, and a document generated
 * against one schema throws on `nodeFromJSON` in another.
 */
export const deriveEditorContent = (
  html: string,
  extensions: Extensions,
): JSONContent =>
  withVariableNodes(generateJSON(html, extensions) as JSONContent);

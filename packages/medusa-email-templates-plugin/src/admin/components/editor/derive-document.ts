import type { Extensions, JSONContent } from '@tiptap/core';
import { generateJSON } from '@tiptap/react';

import { COLUMNS_ATTRIBUTE } from '../../../lib/events/built-in/default-templates/design';
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

    // The pill takes the run's marks too — `<strong>{{ item.title }}</strong>`
    // is a bold title, and a pill can carry marks like any inline content.
    pieces.push({
      type: 'variable',
      attrs: {
        key: match.key,
        format: match.format,
        currencySource: match.currencySource ?? null,
      },
      ...(node.marks ? { marks: node.marks } : {}),
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

/** The editor's own markup for each Columns layout, by column count. */
const COLUMN_LAYOUTS: Record<number, string> = {
  2: 'two-columns',
  3: 'three-columns',
  4: 'four-columns',
};

/**
 * Rewrites every `table[data-columns]` into the editor's Columns markup.
 *
 * The table is what a mail client needs, so it is what a default template
 * sends; the Columns layout is what the editor can reshape. Rewriting before
 * parsing lets the library's own nodes read it, rather than replacing them
 * with copies that carry an extra parse rule.
 *
 * A cell's inline style moves to its column, where the Inspector reaches it.
 * A table whose cell count has no layout (one, or more than four) is left as
 * a table — still correct, just not reshapeable.
 */
export const columnsFromTables = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tables = doc.querySelectorAll(`table[${COLUMNS_ATTRIBUTE}]`);

  if (tables.length === 0) {
    return html;
  }

  tables.forEach((table) => {
    const cells = [...table.querySelectorAll(':scope > tbody > tr > td')];
    const layoutType = COLUMN_LAYOUTS[cells.length];

    if (!layoutType) {
      return;
    }

    const layout = doc.createElement('div');
    layout.setAttribute('data-type', layoutType);

    cells.forEach((cell) => {
      const column = doc.createElement('div');
      const style = cell.getAttribute('style');

      column.setAttribute('data-type', 'column');
      if (style) {
        column.setAttribute('style', style);
      }
      column.innerHTML = cell.innerHTML;
      layout.append(column);
    });

    table.replaceWith(layout);
  });

  /*
   * Handed back in the shape it arrived in. A whole template keeps its
   * `<body>`, whose styling the theme reads back as the page colour; a
   * fragment such as an `itemTemplate` must not gain one, because the editor
   * has a Body node that would parse it as an extra wrapper.
   */
  return /<body[\s>]/i.test(html)
    ? doc.documentElement.outerHTML
    : doc.body.innerHTML;
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
  withVariableNodes(
    generateJSON(columnsFromTables(html), extensions) as JSONContent,
  );

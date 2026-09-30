import type { Extensions, JSONContent } from '@tiptap/core';
import { generateJSON } from '@tiptap/react';

import {
  COLUMNS_ATTRIBUTE,
  PAGE_ATTRIBUTE,
} from '../../../lib/events/built-in/default-templates/design';
import { findLiquidExpressions } from '../../../lib/rendering/variable-format';

/**
 * Turns a template's HTML into an editor document, for templates with no
 * `editor_content`, so the editor opens showing the real email rather than a
 * blank canvas. Rebuilt on every open and never persisted, so it can't go
 * stale.
 */

/**
 * Splits a text run around each expression, replacing it with a pill, so no
 * raw Liquid reaches the canvas (`Hi {{ order.customer_name }},`).
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
    // Spread to keep the run's marks either side of the pill.
    if (match.start > cursor) {
      pieces.push({ ...node, text: text.slice(cursor, match.start) });
    }

    // The pill keeps them too: `<strong>{{ item.title }}</strong>` is bold.
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
 * Rewrites each `table[data-columns]` into the editor's Columns markup before
 * parsing, so the library's own nodes read it (no custom parse rules needed).
 *
 * Cell styles move to their column, where the Inspector reaches them. Tables
 * with 1 or more than 4 cells stay tables.
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

  // Keep the input's shape: a full template keeps its `<body>` (the theme
  // reads the page colour from it), but a fragment must not gain one, or the
  // Body node would add a wrapper.
  return /<body[\s>]/i.test(html)
    ? doc.documentElement.outerHTML
    : doc.body.innerHTML;
};

/**
 * Replaces the page table (see `PAGE_ATTRIBUTE`) with the card inside it. The
 * editor draws its own page; kept, the whole email would parse as one Table.
 */
export const unwrapPageTables = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const pages = doc.querySelectorAll(`table[${PAGE_ATTRIBUTE}]`);

  if (pages.length === 0) {
    return html;
  }

  pages.forEach((page) => {
    const cell = page.querySelector(':scope > tbody > tr > td');

    page.replaceWith(...(cell ? [...cell.childNodes] : []));
  });

  // Same shape rule as `columnsFromTables`: a whole template keeps its body.
  return /<body[\s>]/i.test(html)
    ? doc.documentElement.outerHTML
    : doc.body.innerHTML;
};

/**
 * Builds an editor document from a template's HTML. Takes the editor's own
 * `extensions`: a document built against a different schema throws on
 * `nodeFromJSON`.
 */
export const deriveEditorContent = (
  html: string,
  extensions: Extensions,
): JSONContent =>
  withVariableNodes(
    generateJSON(
      columnsFromTables(unwrapPageTables(html)),
      extensions,
    ) as JSONContent,
  );

import type { Extensions, JSONContent } from '@tiptap/core';
import { generateJSON } from '@tiptap/react';

import {
  COLUMNS_ATTRIBUTE,
  PAGE_ATTRIBUTE,
} from '../../../lib/events/built-in/default-templates/design';
import { findLiquidExpressions } from '../../../lib/rendering/variable-format';

const splitTextNode = (node: JSONContent): JSONContent[] => {
  const text = typeof node.text === 'string' ? node.text : '';
  const matches = findLiquidExpressions(text);

  if (matches.length === 0) {
    return [node];
  }

  const pieces: JSONContent[] = [];
  let cursor = 0;

  matches.forEach((match) => {
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
      ...(node.marks ? { marks: node.marks } : {}),
    });

    cursor = match.end;
  });

  if (cursor < text.length) {
    pieces.push({ ...node, text: text.slice(cursor) });
  }

  return pieces;
};

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

const COLUMN_LAYOUTS: Record<number, string> = {
  2: 'two-columns',
  3: 'three-columns',
  4: 'four-columns',
};

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

  return /<body[\s>]/i.test(html)
    ? doc.documentElement.outerHTML
    : doc.body.innerHTML;
};

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

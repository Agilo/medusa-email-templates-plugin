import { composeReactEmail } from '@react-email/editor/core';
import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import { inviteCreatedDefaultTemplate } from '../../../../lib/events/built-in/default-templates/account';
import {
  CARD_MARGIN,
  columns,
  EMAIL_DESIGN,
} from '../../../../lib/events/built-in/default-templates/design';
import { EMAIL_THEME } from '../email-template-editor';
import { orderPlacedDefaultTemplate } from '../../../../lib/events/built-in/default-templates/order-placed';
import { createEmailLiquid } from '../../../../lib/rendering/liquid';
import {
  columnsFromTables,
  deriveEditorContent,
  withVariableNodes,
} from '../derive-document';
import { RepeatNode } from '../repeat-node';
import { VariableNode } from '../variable-node';

const extensions = [
  StarterKit.configure(),
  EmailTheming.configure({ theme: EMAIL_THEME }),
  VariableNode,
  RepeatNode,
];

const editors: Editor[] = [];

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

/** Every node of a type, anywhere in the document. */
const collect = (node: JSONContent, type: string): JSONContent[] => {
  const found: JSONContent[] = [];
  const walk = (current: JSONContent) => {
    if (current.type === type) {
      found.push(current);
    }
    (current.content ?? []).forEach(walk);
  };
  walk(node);

  return found;
};

const paragraphWith = (text: string): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('withVariableNodes', () => {
  it('splits an expression out of the prose around it', () => {
    const doc = withVariableNodes(
      paragraphWith('Hi {{ order.customer_name }},'),
    );

    expect(doc.content?.[0].content).toEqual([
      { type: 'text', text: 'Hi ' },
      {
        type: 'variable',
        attrs: {
          key: 'order.customer_name',
          format: 'text',
          currencySource: null,
        },
      },
      { type: 'text', text: ',' },
    ]);
  });

  it('replaces a run that is nothing but an expression', () => {
    const doc = withVariableNodes(
      paragraphWith('{{ order.total | money: order.currency_code }}'),
    );

    // No empty text nodes either side: ProseMirror rejects those outright.
    expect(doc.content?.[0].content).toEqual([
      {
        type: 'variable',
        attrs: {
          key: 'order.total',
          format: 'money',
          currencySource: 'order.currency_code',
        },
      },
    ]);
  });

  it('keeps the marks a run carried on both sides of the pill', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'bold' }],
              text: 'Total {{ order.total }} due',
            },
          ],
        },
      ],
    };

    const [before, pill, after] =
      withVariableNodes(doc).content?.[0].content ?? [];

    // The pill is part of the bold run too.
    expect(pill.marks).toEqual([{ type: 'bold' }]);
    expect(before).toEqual({
      type: 'text',
      marks: [{ type: 'bold' }],
      text: 'Total ',
    });
    expect(after).toEqual({
      type: 'text',
      marks: [{ type: 'bold' }],
      text: ' due',
    });
  });

  it('leaves an expression it cannot regenerate as plain text', () => {
    const doc = withVariableNodes(
      paragraphWith('{{ order.created_at | date: "%b %d" }}'),
    );

    expect(collect(doc, 'variable')).toEqual([]);
    expect(doc.content?.[0].content?.[0].text).toContain('date:');
  });

  it('descends into nested structure', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [paragraphWith('{{ order.total }}').content![0]],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(collect(withVariableNodes(doc), 'variable')).toHaveLength(1);
  });
});

describe('columnsFromTables', () => {
  const parse = (html: string) =>
    new DOMParser().parseFromString(html, 'text/html').body;

  it('rewrites a marked table as the Columns layout for its cell count', () => {
    const body = parse(
      columnsFromTables(
        columns([
          { html: '<p>A</p>', style: 'padding:8px 0' },
          { html: '<p>B</p>' },
          { html: '<p>C</p>' },
        ]),
      ),
    );
    const layout = body.querySelector('[data-type="three-columns"]');
    const cells = layout?.querySelectorAll(':scope > [data-type="column"]');

    expect(body.querySelector('table')).toBeNull();
    expect(cells).toHaveLength(3);
    // The cell's style moves to its column, where the Inspector reaches it.
    expect(cells?.[0].getAttribute('style')).toBe('padding:8px 0');
    expect(cells?.[2].innerHTML).toBe('<p>C</p>');
  });

  it('leaves unmarked tables, and cell counts with no layout, alone', () => {
    const plain = '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
    const single = columns([{ html: 'A' }]);

    expect(columnsFromTables(plain)).toBe(plain);
    expect(
      parse(columnsFromTables(single)).querySelector('table'),
    ).not.toBeNull();
  });

  it('keeps a fragment a fragment', () => {
    expect(
      columnsFromTables(columns([{ html: 'A' }, { html: 'B' }])),
    ).not.toMatch(/<body|<html/);
  });
});

describe('deriveEditorContent', () => {
  it('turns the real default template into a document with pills', () => {
    const doc = deriveEditorContent(
      orderPlacedDefaultTemplate.html,
      extensions,
    );

    const keys = collect(doc, 'variable').map((node) => node.attrs?.key);

    expect(keys).toEqual([
      'order.customer_name',
      'order.display_id',
      'item.title',
      'item.quantity',
      'item.variant_title',
      'item.total',
      'order.subtotal',
      'order.shipping_total',
      'order.tax_total',
      'order.total',
      'store.name',
    ]);
  });

  it('leaves no raw Liquid anywhere in the document text', () => {
    const doc = deriveEditorContent(
      orderPlacedDefaultTemplate.html,
      extensions,
    );

    collect(doc, 'text').forEach((node) => {
      expect(node.text).not.toMatch(/\{\{|\{%/);
    });
  });

  /*
   * A call to action has to arrive as a `button` node, not as link-marked text
   * in a paragraph. Both render an anchor, so the difference is invisible in
   * the inbox and total in the editor: the button's inspector section and
   * bubble menu key off the node type, and neither reaches a link mark.
   *
   * What decides it is one attribute. `@react-email/editor` parses buttons
   * from `a[data-id="react-email-button"]` alone, so an anchor styled to look
   * like a button — which is what these templates had — degrades silently.
   */
  it('derives the account templates call to action as a button', () => {
    const doc = deriveEditorContent(
      inviteCreatedDefaultTemplate.html,
      extensions,
    );

    const buttons = collect(doc, 'button');

    expect(buttons).toHaveLength(1);
    expect(buttons[0].attrs?.href).toBe('{{ invite_url }}');
    // The label is the button's own content, not a sibling paragraph's.
    expect(buttons[0].content?.[0].text).toBe('Accept the invitation');
    // The `<p>` that used to wrap it would be lifted off and left behind
    // empty, because a button is a block node.
    expect(collect(doc, 'paragraph').every((node) => node.content)).toBe(true);
  });

  it('keeps the structure the HTML described', () => {
    const doc = deriveEditorContent(
      orderPlacedDefaultTemplate.html,
      extensions,
    );

    expect(collect(doc, 'heading')).toHaveLength(1);
    // Every row opens as an editable layout rather than a fixed table: the
    // item row, then the four totals, each with its two cells.
    expect(collect(doc, 'table')).toHaveLength(0);
    expect(collect(doc, 'twoColumns')).toHaveLength(5);
    expect(collect(doc, 'columnsColumn')).toHaveLength(10);
  });

  /*
   * A row's height is set in one place, and it is a place the Inspector can
   * show and change. The theme's per-paragraph 0.5em used to stack on top of
   * the column's padding, with no control anywhere for it, and the Spacing
   * field showed 0 because the padding was written as a shorthand it never
   * reads.
   */
  it('spaces each row by its column padding alone', async () => {
    const doc = deriveEditorContent(
      orderPlacedDefaultTemplate.html,
      extensions,
    );

    collect(doc, 'columnsColumn').forEach((column) => {
      expect(column.attrs?.style).toContain('padding-top:8px');
      expect(column.attrs?.style).toContain('padding-bottom:8px');
    });

    const editor = new Editor({ extensions, content: doc });
    editors.push(editor);

    const { unformattedHtml } = await composeReactEmail({ editor });
    const cells = unformattedHtml.match(
      /<td data-id="__react-email-column"[\s\S]*?<\/td>/g,
    );

    expect(cells).toHaveLength(10);
    cells?.forEach((cell) => {
      expect(cell).not.toContain('padding-top:0.5em');
      expect(cell).not.toContain('padding-bottom:0.5em');
    });
  });

  /*
   * What converting to Columns was for. A table cell cannot be removed at
   * all; an emptied column goes with one Backspace, and the last one left
   * unwraps into plain content.
   */
  it('lets a column of the item row be removed', () => {
    const editor = new Editor({
      extensions,
      content: deriveEditorContent(orderPlacedDefaultTemplate.html, extensions),
    });
    editors.push(editor);

    // The item row is the first layout; its second column holds the total.
    let row = -1;
    editor.state.doc.descendants((node, pos) => {
      if (row < 0 && node.type.name === 'twoColumns') {
        row = pos;
      }
    });
    const layout = editor.state.doc.nodeAt(row)!;
    const column = row + 1 + layout.child(0).nodeSize;
    const size = layout.child(1).nodeSize;

    editor
      .chain()
      .setTextSelection({ from: column + 1, to: column + size - 1 })
      .deleteSelection()
      .setTextSelection(column + 2)
      .run();

    expect(editor.commands.keyboardShortcut('Backspace')).toBe(true);

    const [block] = collect(editor.getJSON(), 'repeat');

    expect(collect(block, 'twoColumns')).toHaveLength(0);
    expect(collect(block, 'variable').map((node) => node.attrs?.key)).toEqual([
      'item.title',
      'item.quantity',
      'item.variant_title',
    ]);
  });

  /*
   * The loop tags sit outside the element the block reads its content from,
   * so they must never surface as text — that is what the parse rule's
   * `contentElement` is for.
   */
  it('derives the item list as a Repeat block over order.items', () => {
    const doc = deriveEditorContent(
      orderPlacedDefaultTemplate.html,
      extensions,
    );
    const [block] = collect(doc, 'repeat');

    expect(collect(doc, 'repeat')).toHaveLength(1);
    expect(block.attrs?.source).toBe('order.items');
    expect(collect(block, 'variable').map((node) => node.attrs?.key)).toEqual([
      'item.title',
      'item.quantity',
      'item.variant_title',
      'item.total',
    ]);
    // `<strong>{{ item.title }}</strong>` arrives as a bold pill.
    expect(collect(block, 'variable')[0].marks).toEqual([{ type: 'bold' }]);
  });

  it('exports a loop that renders every item', async () => {
    const editor = new Editor({
      extensions,
      content: deriveEditorContent(orderPlacedDefaultTemplate.html, extensions),
    });
    editors.push(editor);

    const { unformattedHtml } = await composeReactEmail({ editor });
    const rendered = await createEmailLiquid({
      escapeOutput: true,
    }).parseAndRender(unformattedHtml, {
      order: {
        currency_code: 'eur',
        items: [
          { title: 'Shirt <XL>', variant_title: 'M', quantity: 2, total: 40 },
          { title: 'Hat', variant_title: null, quantity: 1, total: 15 },
        ],
      },
    });

    expect(unformattedHtml).toContain('{% for item in order.items %}');
    expect(rendered).toContain('Shirt &lt;XL&gt;');
    expect(rendered).toContain('€40.00');
    expect(rendered).toContain('Hat');
    expect(rendered).toContain('€15.00');
  });

  /*
   * The property the whole feature rests on. Deriving a document and exporting
   * it must reproduce the same expressions the HTML started with — otherwise
   * opening a template and saving it would silently rewrite the email.
   */
  it('exports back to the expressions it was derived from', async () => {
    const editor = new Editor({
      extensions,
      content: deriveEditorContent(orderPlacedDefaultTemplate.html, extensions),
    });
    editors.push(editor);

    /*
     * `unformattedHtml`, not `html`. The formatted variant exists for source
     * views and wraps long lines, which splits the longest expression here
     * across a line break — the Liquid stays valid but stops being a
     * contiguous substring. The unformatted variant is what `getBody` stores
     * as `html_template`, so it is also the one that actually sends.
     */
    const { unformattedHtml } = await composeReactEmail({ editor });

    [
      '{{ order.customer_name }}',
      '{{ order.display_id }}',
      '{{ item.title }}',
      '{{ item.total | money: order.currency_code }}',
      '{{ order.subtotal | money: order.currency_code }}',
      '{{ order.shipping_total | money: order.currency_code }}',
      '{{ order.tax_total | money: order.currency_code }}',
      '{{ order.total | money: order.currency_code }}',
      '{{ store.name }}',
    ].forEach((expression) => {
      expect(unformattedHtml).toContain(expression);
    });
  });

  /*
   * The whole reason `design.ts` exists. The default templates and the editor
   * theme describe one email from one set of numbers, so a template that is
   * opened and saved comes back looking like itself — grey page, white card,
   * rounded, padded, near-black text. Left to `basic` the export is white on
   * white, square, and with the text against the card's edge.
   *
   * Asserted against `EMAIL_DESIGN` rather than against literals, so the test
   * follows a deliberate change to the design and still fails when the two
   * sides drift apart, which is the thing worth catching.
   */
  it('exports the design the default template describes', async () => {
    const editor = new Editor({
      extensions,
      content: deriveEditorContent(orderPlacedDefaultTemplate.html, extensions),
    });
    editors.push(editor);

    const { unformattedHtml } = await composeReactEmail({ editor });
    const body = /<body[^>]*>/.exec(unformattedHtml)?.[0] ?? '';
    const card = /<table align="center"[^>]*>/.exec(unformattedHtml)?.[0] ?? '';
    const cell =
      /<td style="padding-top[^>]*>/.exec(unformattedHtml)?.[0] ?? '';

    expect(body).toContain(`background-color:${EMAIL_DESIGN.pageBackground}`);
    expect(card).toContain(`background-color:${EMAIL_DESIGN.cardBackground}`);
    expect(card).toContain(`color:${EMAIL_DESIGN.textColor}`);
    expect(card).toContain(`border-radius:${EMAIL_DESIGN.cardRadius}px`);
    expect(card).toContain(`max-width:${EMAIL_DESIGN.cardWidth}px`);
    expect(card).toContain(`margin:${CARD_MARGIN}`);
    expect(cell).toContain(`padding-top:${EMAIL_DESIGN.cardPadding}px`);
    expect(cell).toContain(`padding-left:${EMAIL_DESIGN.cardPadding}px`);
  });

  /*
   * The same property, for the button's size rather than its expressions.
   *
   * React Email's `Button` parses the padding out of the style it is handed
   * and re-emits the four longhand properties after spreading that style, and
   * `parsePadding` lets a longhand key override whatever the shorthand set.
   * The editor's theme supplies button padding in longhand, so a `padding`
   * shorthand on the node is always overridden and never reaches the export —
   * silently, and at any value. Opening a template and saving it would then
   * resize its button to the theme default.
   */
  it('exports the button at the size the template asked for', async () => {
    const editor = new Editor({
      extensions,
      content: deriveEditorContent(
        inviteCreatedDefaultTemplate.html,
        extensions,
      ),
    });
    editors.push(editor);

    const { unformattedHtml } = await composeReactEmail({ editor });
    const anchor = /<a[^>]*data-id="react-email-button"[^>]*>|<a[^>]*>/.exec(
      unformattedHtml,
    )?.[0];

    expect(anchor).toBeDefined();
    expect(anchor).toContain('padding-top:10px');
    expect(anchor).toContain('padding-right:18px');
    expect(anchor).toContain('padding-bottom:10px');
    expect(anchor).toContain('padding-left:18px');
  });
});

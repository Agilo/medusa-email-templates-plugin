import type { EmailEventDefaultTemplate } from '../../types';
import { columns, EMAIL_DESIGN, layout, NO_THEME_SPACING } from './design';
import { repeat } from './repeat';

/*
 * A row's spacing lives on its columns, and only there.
 *
 * Longhand, because the Inspector reads `paddingTop` and `paddingBottom` and
 * nothing else: written as `padding:8px 0`, the Spacing field showed 0 for a
 * row that was plainly padded, and typing 0 into it changed nothing.
 */
const ROW_PADDING = 'padding-top:8px;padding-bottom:8px';
const ROW_RULE = `${ROW_PADDING};border-bottom:1px solid #e5e7eb`;

/*
 * Paragraphs inside a row carry no spacing of their own.
 *
 * The editor's theme gives every paragraph 0.5em above and below, which the
 * paragraph's own panel has no control for — so inside a row it stacked a
 * second, unreachable 16px on top of the column's padding. Zeroed in longhand,
 * which is what overrides the theme's own longhands on the canvas and in the
 * export, the column's padding is the one place a row's height is set.
 *
 * It also keeps the default email honest: a mail client never applied the
 * theme's padding to this HTML, so the email only grew taller once it had
 * been opened and saved.
 */
const CELL_TEXT = `margin:0;${NO_THEME_SPACING}`;

/**
 * One line of the order: what was bought and how many on the left, the line
 * total on the right.
 *
 * Exported because it is also the `order.items` variable's `itemTemplate` —
 * the content a Repeat block starts with when inserted from the editor — so
 * the default email and a freshly inserted block look the same.
 *
 * Built with `columns`, so it sends as a table and opens as an editable
 * Columns layout: a column can be emptied and removed, or the row rebuilt
 * with three.
 */
export const ORDER_ITEM_ROW = columns([
  {
    style: ROW_RULE,
    html: `<p style="${CELL_TEXT}"><strong>{{ item.title }}</strong> × {{ item.quantity }}</p><p style="${CELL_TEXT};color:${EMAIL_DESIGN.mutedColor};font-size:12px">{{ item.variant_title }}</p>`,
  },
  {
    style: ROW_RULE,
    html: `<p style="${CELL_TEXT};text-align:right">{{ item.total | money: order.currency_code }}</p>`,
  },
]);

/*
 * The totals read as one compact block rather than a list of rows: a gap
 * above it to set it apart from the items, lines packed close, and the grand
 * total ruled off beneath them.
 *
 * Set on both cells of a row, not just the label's. A row's cells are laid out
 * separately, so padding one and not the other drops the value out of line
 * with its label.
 */
const TOTALS_FIRST = 'padding-top:24px;padding-bottom:2px';
const TOTALS_LINE = 'padding-top:2px;padding-bottom:2px';
const TOTALS_GRAND =
  'padding-top:8px;padding-bottom:2px;border-top:1px solid #e5e7eb';

/**
 * One totals line, as its own row of columns so each can be edited or
 * removed on its own. Quote-free Liquid, so it survives the editor round
 * trip.
 *
 * Bold through `<strong>` rather than a `font-weight` on the cell, so the
 * editor shows it as the bold mark the bubble menu toggles.
 */
const totalsRow = (
  label: string,
  key: string,
  {
    style = TOTALS_LINE,
    bold = false,
  }: { style?: string; bold?: boolean } = {},
): string => {
  const strong = (html: string) => (bold ? `<strong>${html}</strong>` : html);

  return columns([
    {
      style,
      html: `<p style="${CELL_TEXT}">${strong(label)}</p>`,
    },
    {
      style,
      html: `<p style="${CELL_TEXT};text-align:right">${strong(`{{ ${key} | money: order.currency_code }}`)}</p>`,
    },
  ]);
};

/**
 * The order's totals, one row each.
 *
 * Exported because it is also the "Order totals" snippet the editor inserts,
 * so a template that lost its totals gets back exactly these.
 *
 * Discount is always shown, as €0.00 on an order without one. Hiding it then
 * needs a condition the editor cannot express yet; until it can, an admin
 * who never discounts deletes the row.
 */
export const ORDER_TOTALS = [
  totalsRow('Subtotal', 'order.subtotal', { style: TOTALS_FIRST }),
  totalsRow('Discount', 'order.discount_total'),
  totalsRow('Shipping', 'order.shipping_total'),
  totalsRow('Tax', 'order.tax_total'),
  totalsRow('Total', 'order.total', { style: TOTALS_GRAND, bold: true }),
].join('');

/**
 * Default order confirmation. Only quote-free Liquid is used, so the template
 * survives a round trip through the visual editor (PLAN.md §1.5).
 */
export const orderPlacedDefaultTemplate: EmailEventDefaultTemplate = {
  subject: 'Your {{ store.name }} order #{{ order.display_id }}',
  html: layout(
    'Thanks for your order',
    `<p style="margin:0 0 8px;${NO_THEME_SPACING}">Hi {{ order.customer_name }},</p>
            <p style="margin:0 0 24px;${NO_THEME_SPACING}">We received your order #{{ order.display_id }} and are getting it ready.</p>
            ${repeat('order.items', ORDER_ITEM_ROW)}
            ${ORDER_TOTALS}`,
  ),
};

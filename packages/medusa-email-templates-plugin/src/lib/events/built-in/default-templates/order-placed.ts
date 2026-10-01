import type { EmailEventDefaultTemplate } from '../../types';
import { columns, EMAIL_DESIGN, layout, NO_THEME_SPACING } from './design';
import { repeat } from './repeat';

/*
 * A row's spacing lives only on its columns. Longhand, because the
 * Inspector's Spacing field reads only `paddingTop`/`paddingBottom`.
 */
const ROW_PADDING = 'padding-top:8px;padding-bottom:8px';
const ROW_RULE = `${ROW_PADDING};border-bottom:1px solid #e5e7eb`;

const CELL_TEXT = `margin:0;${NO_THEME_SPACING}`;

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

const TOTALS_FIRST = 'padding-top:24px;padding-bottom:2px';
const TOTALS_LINE = 'padding-top:2px;padding-bottom:2px';
const TOTALS_GRAND =
  'padding-top:8px;padding-bottom:2px;border-top:1px solid #e5e7eb';

/**
 * One totals line as its own Columns row, editable or removable on its own.
 * Quote-free Liquid survives the editor round trip. Bold via `<strong>`, so the
 * editor shows a toggleable bold mark.
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

export const ORDER_TOTALS = [
  totalsRow('Subtotal', 'order.subtotal', { style: TOTALS_FIRST }),
  totalsRow('Discount', 'order.discount_total'),
  totalsRow('Shipping', 'order.shipping_total'),
  totalsRow('Tax', 'order.tax_total'),
  totalsRow('Total', 'order.total', { style: TOTALS_GRAND, bold: true }),
].join('');

/** Default order confirmation. Quote-free Liquid, so it survives the editor. */
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

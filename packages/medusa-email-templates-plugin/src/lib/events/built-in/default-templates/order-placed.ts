import type { EmailEventDefaultTemplate } from '../../types';
import { layout } from './design';

/** One totals row. Quote-free Liquid, so it survives the editor round trip. */
const totalsRow = (label: string, key: string, bold = false): string => {
  const weight = bold ? ';font-weight:bold' : '';

  return `<tr>
                  <td style="padding:8px 0${weight}">${label}</td>
                  <td align="right" style="padding:8px 0${weight}">{{ ${key} | money: order.currency_code }}</td>
                </tr>`;
};

/**
 * Default order confirmation. Only quote-free Liquid is used, so the template
 * survives a round trip through the visual editor (PLAN.md §1.5).
 */
export const orderPlacedDefaultTemplate: EmailEventDefaultTemplate = {
  subject: 'Your {{ store.name }} order #{{ order.display_id }}',
  html: layout(
    'Thanks for your order',
    `<p style="margin:0 0 8px">Hi {{ order.customer_name }},</p>
            <p style="margin:0 0 24px">We received your order #{{ order.display_id }} and are getting it ready.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tbody>
                ${totalsRow('Subtotal', 'order.subtotal')}
                ${totalsRow('Shipping', 'order.shipping_total')}
                ${totalsRow('Tax', 'order.tax_total')}
                ${totalsRow('Total', 'order.total', true)}
              </tbody>
            </table>`,
  ),
};

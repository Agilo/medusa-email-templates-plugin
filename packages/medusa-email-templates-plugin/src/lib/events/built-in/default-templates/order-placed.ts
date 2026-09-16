import type { EmailEventDefaultTemplate } from '../../types';

/**
 * Default order confirmation. Only quote-free Liquid is used, so the template
 * survives a round trip through the visual editor (PLAN.md §1.5).
 */
export const orderPlacedDefaultTemplate: EmailEventDefaultTemplate = {
  subject: 'Your {{ store.name }} order #{{ order.display_id }}',
  html: `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background-color:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px">
      <tbody>
        <tr>
          <td style="padding:24px">
            <h1 style="margin:0 0 16px;font-size:20px">Thanks for your order</h1>
            <p style="margin:0 0 8px">Hi {{ order.customer_name }},</p>
            <p style="margin:0 0 24px">We received your order #{{ order.display_id }} and are getting it ready.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tbody>
                <tr>
                  <th align="left" style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:12px;text-transform:uppercase;color:#6b7280">Item</th>
                  <th align="center" style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:12px;text-transform:uppercase;color:#6b7280">Qty</th>
                  <th align="right" style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:12px;text-transform:uppercase;color:#6b7280">Total</th>
                </tr>
                {% for item in order.items %}
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f3f4f6">{{ item.title }}</td>
                  <td align="center" style="padding:8px 0;border-bottom:1px solid #f3f4f6">{{ item.quantity }}</td>
                  <td align="right" style="padding:8px 0;border-bottom:1px solid #f3f4f6">{{ item.total | money: order.currency_code }}</td>
                </tr>
                {% endfor %}
                <tr>
                  <td colspan="2" style="padding:8px 0">Subtotal</td>
                  <td align="right" style="padding:8px 0">{{ order.subtotal | money: order.currency_code }}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:8px 0">Shipping</td>
                  <td align="right" style="padding:8px 0">{{ order.shipping_total | money: order.currency_code }}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:8px 0">Tax</td>
                  <td align="right" style="padding:8px 0">{{ order.tax_total | money: order.currency_code }}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:8px 0;font-weight:bold">Total</td>
                  <td align="right" style="padding:8px 0;font-weight:bold">{{ order.total | money: order.currency_code }}</td>
                </tr>
              </tbody>
            </table>
            <p style="margin:24px 0 0;color:#6b7280;font-size:12px">{{ store.name }}</p>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`,
};

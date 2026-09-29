import type { MedusaContainer } from '@medusajs/framework/types';
import { describe, expect, it, vi } from 'vitest';

import { EMAIL_TEMPLATES_MODULE } from '../../../modules/email-templates';
import type { EmailTemplatesModuleOptions } from '../../../modules/email-templates/service';
import { orderPlacedEmailEvent } from '../built-in/order-placed';

const order = {
  id: 'order_1',
  display_id: 1001,
  email: 'jane@example.com',
  currency_code: 'eur',
  total: 55,
  subtotal: 40,
  shipping_total: 10,
  tax_total: 5,
  discount_total: 0,
  items: [
    {
      id: 'item_1',
      title: 'Medusa T-Shirt',
      quantity: 2,
      unit_price: 20,
      total: 40,
    },
  ],
  shipping_address: { city: 'Copenhagen' },
  customer: { first_name: 'Jane', last_name: 'Doe' },
};

const containerWith = (
  orders: unknown[],
  options: EmailTemplatesModuleOptions = {},
) => {
  const graph = vi.fn(async ({ entity }: { entity: string }) =>
    entity === 'store' ? { data: [{ name: 'Test Store' }] } : { data: orders },
  );

  return {
    container: {
      // Keyed, because the URL helpers resolve the module for its options
      // while everything else here wants the query service.
      resolve: (key: string) =>
        key === EMAIL_TEMPLATES_MODULE
          ? { getOptions: () => options }
          : { graph },
    } as unknown as MedusaContainer,
    graph,
  };
};

describe('order-placed email event', () => {
  it('uses the order email as the recipient', async () => {
    const { container } = containerWith([order]);

    await expect(
      orderPlacedEmailEvent.getRecipient({ id: 'order_1' }, container),
    ).resolves.toBe('jane@example.com');
  });

  it('skips orders without an email', async () => {
    const { container } = containerWith([{ ...order, email: null }]);

    await expect(
      orderPlacedEmailEvent.getRecipient({ id: 'order_1' }, container),
    ).resolves.toBeNull();
  });

  it('skips when the order no longer exists', async () => {
    const { container } = containerWith([]);

    await expect(
      orderPlacedEmailEvent.getRecipient({ id: 'order_1' }, container),
    ).resolves.toBeNull();
  });

  it('builds the template context', async () => {
    const { container } = containerWith([order]);

    const context = await orderPlacedEmailEvent.getContext(
      { id: 'order_1' },
      container,
    );

    expect(context).toMatchObject({
      order: {
        display_id: 1001,
        customer_name: 'Jane Doe',
        currency_code: 'eur',
        total: 55,
        items: [{ title: 'Medusa T-Shirt', quantity: 2, total: 40 }],
      },
      store: { name: 'Test Store' },
    });
  });

  /*
   * The editor offers exactly the declared fields inside the items block, so
   * each one has to be something `getContext` actually puts on an item — a
   * field it does not map would be a pill that always sends empty.
   */
  it('declares the items as a list of fields each item carries', async () => {
    const { container } = containerWith([
      { ...order, items: [{ ...order.items[0], variant_title: 'M' }] },
    ]);
    const context = (await orderPlacedEmailEvent.getContext(
      { id: 'order_1' },
      container,
    )) as { order: { items: Record<string, unknown>[] } };
    const items = orderPlacedEmailEvent.variables.find(
      (variable) => variable.key === 'order.items',
    );

    expect(items?.type).toBe('list');
    expect(items?.itemTemplate).toContain('{{ item.title }}');
    (items?.fields ?? []).forEach((field) => {
      expect(context.order.items[0]).toHaveProperty(field.key);
    });
  });

  /*
   * A snippet is inserted as pills, and a pill whose key the event does not
   * declare shows as stale the moment it lands.
   */
  it('offers an order totals snippet built only from declared values', () => {
    const [totals] = orderPlacedEmailEvent.snippets ?? [];
    const declared = new Set(
      orderPlacedEmailEvent.variables.map((variable) => variable.key),
    );
    const keys = [...totals.html.matchAll(/\{\{\s*([a-z0-9_.]+)/g)].map(
      (match) => match[1],
    );

    expect(totals.label).toBe('Order totals');
    expect(keys).toContain('order.discount_total');
    keys.forEach((key) => expect(declared).toContain(key));
  });

  /*
   * The link is composed here so the base follows the deployment. Written by
   * hand in a template it would be frozen into the saved HTML and wrong
   * everywhere but the environment it was typed in.
   */
  describe('order link', () => {
    const urlOf = async (options: EmailTemplatesModuleOptions) => {
      const { container } = containerWith([order], options);
      const context = (await orderPlacedEmailEvent.getContext(
        { id: 'order_1' },
        container,
      )) as { order_url: string | null };

      return context.order_url;
    };

    it('appends the order id to the configured storefront', async () => {
      await expect(
        urlOf({ storefront_url: 'https://shop.test' }),
      ).resolves.toBe('https://shop.test/orders/order_1');
    });

    it('takes the path from options, and tolerates a missing slash', async () => {
      await expect(
        urlOf({
          storefront_url: 'https://shop.test/',
          storefront_order_path: 'account/orders',
        }),
      ).resolves.toBe('https://shop.test/account/orders/order_1');
    });

    /*
     * The difference from the password reset, which throws here so the send is
     * skipped. This email is mostly an order summary and is worth sending
     * without a link, so the variable goes unresolved instead.
     */
    it('is null without a storefront, and does not stop the context', async () => {
      const { container } = containerWith([order]);
      const context = (await orderPlacedEmailEvent.getContext(
        { id: 'order_1' },
        container,
      )) as { order_url: string | null; order: { display_id: number } };

      expect(context.order_url).toBeNull();
      expect(context.order.display_id).toBe(1001);
    });

    it('reports the missing storefront to the admin list', () => {
      const { container: unset } = containerWith([order]);
      const { container: set } = containerWith([order], {
        storefront_url: 'https://shop.test',
      });

      expect(orderPlacedEmailEvent.getWarnings?.(unset)).toEqual([
        'storefront_url_not_configured',
      ]);
      expect(orderPlacedEmailEvent.getWarnings?.(set)).toEqual([]);
    });

    // `url` is what puts it in the editor's link picker; without it the
    // variable exists but no button or link can be pointed at it.
    it('is declared as a URL variable', () => {
      const declared = orderPlacedEmailEvent.variables.find(
        (variable) => variable.key === 'order_url',
      );

      expect(declared?.type).toBe('url');
    });
  });

  it('falls back to a friendly greeting without a customer', async () => {
    const { container } = containerWith([{ ...order, customer: null }]);

    const context = (await orderPlacedEmailEvent.getContext(
      { id: 'order_1' },
      container,
    )) as { order: { customer_name: string } };

    expect(context.order.customer_name).toBe('there');
  });

  it('provides a stable idempotency key and resource', () => {
    expect(orderPlacedEmailEvent.getIdempotencyKey?.({ id: 'order_1' })).toBe(
      'order.placed:order_1',
    );
    expect(orderPlacedEmailEvent.getResource?.({ id: 'order_1' })).toEqual({
      resource_id: 'order_1',
      resource_type: 'order',
    });
  });
});

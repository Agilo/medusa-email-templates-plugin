import type { MedusaContainer } from '@medusajs/framework/types';
import { describe, expect, it, vi } from 'vitest';

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

const containerWith = (orders: unknown[]) => {
  const graph = vi.fn(async ({ entity }: { entity: string }) =>
    entity === 'store' ? { data: [{ name: 'Test Store' }] } : { data: orders },
  );

  return {
    container: { resolve: () => ({ graph }) } as unknown as MedusaContainer,
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

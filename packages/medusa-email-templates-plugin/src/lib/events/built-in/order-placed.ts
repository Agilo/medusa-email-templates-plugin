import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { defineEmailEvent } from '../define-email-event';
import { orderPlacedDefaultTemplate } from './default-templates/order-placed';
import { retrieveStoreName } from './store';

export type OrderPlacedEventData = { id: string };

type OrderRecord = {
  id: string;
  display_id?: number;
  email?: string | null;
  currency_code?: string;
  created_at?: string | Date;
  total?: number;
  subtotal?: number;
  shipping_total?: number;
  tax_total?: number;
  discount_total?: number;
  items?: {
    id: string;
    title?: string;
    variant_title?: string | null;
    quantity?: number;
    unit_price?: number;
    total?: number;
  }[];
  shipping_address?: Record<string, unknown> | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
};

const ORDER_FIELDS = [
  'id',
  'display_id',
  'email',
  'currency_code',
  'created_at',
  'total',
  'subtotal',
  'shipping_total',
  'tax_total',
  'discount_total',
  'items.id',
  'items.title',
  'items.variant_title',
  'items.quantity',
  'items.unit_price',
  'items.total',
  'shipping_address.*',
  'customer.first_name',
  'customer.last_name',
];

const retrieveOrder = async (
  id: string,
  container: MedusaContainer,
): Promise<OrderRecord | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: 'order',
    fields: ORDER_FIELDS,
    filters: { id },
  });

  return (data[0] as OrderRecord | undefined) ?? null;
};

const customerName = (order: OrderRecord): string =>
  [order.customer?.first_name, order.customer?.last_name]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .trim() || 'there';

export const orderPlacedEmailEvent = defineEmailEvent<OrderPlacedEventData>({
  event: 'order.placed',
  templateKey: 'order-placed',
  label: 'Order placed',
  description: 'Sent to the customer when an order is placed.',
  defaultTemplate: orderPlacedDefaultTemplate,
  getIdempotencyKey: (data) => `order.placed:${data.id}`,
  getResource: (data) => ({ resource_id: data.id, resource_type: 'order' }),

  async getRecipient(data, container) {
    const order = await retrieveOrder(data.id, container);

    return order?.email ?? null;
  },

  async getContext(data, container) {
    const order = await retrieveOrder(data.id, container);

    if (!order) {
      throw new Error(`Order "${data.id}" was not found.`);
    }

    return {
      order: {
        id: order.id,
        display_id: order.display_id,
        email: order.email,
        currency_code: order.currency_code,
        created_at: order.created_at,
        customer_name: customerName(order),
        subtotal: order.subtotal,
        shipping_total: order.shipping_total,
        tax_total: order.tax_total,
        discount_total: order.discount_total,
        total: order.total,
        items: (order.items ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          variant_title: item.variant_title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        })),
        shipping_address: order.shipping_address ?? null,
      },
      store: { name: await retrieveStoreName(container) },
    };
  },

  variables: [
    {
      key: 'order.display_id',
      label: 'Order number',
      example: 1001,
      group: 'Order',
    },
    {
      key: 'order.customer_name',
      label: 'Customer name',
      example: 'Jane Doe',
      group: 'Order',
    },
    {
      key: 'order.email',
      label: 'Email',
      example: 'jane@example.com',
      group: 'Order',
    },
    {
      key: 'order.currency_code',
      label: 'Currency',
      example: 'eur',
      group: 'Order',
    },
    {
      key: 'order.created_at',
      label: 'Order date',
      example: '2026-10-01T10:00:00.000Z',
      type: 'date',
      group: 'Order',
    },
    {
      key: 'order.items',
      label: 'Items',
      description: 'Line items. Use the Order items block to list them.',
      example: [{ title: 'Medusa T-Shirt', quantity: 2, total: 40 }],
      group: 'Order',
      // Keys are relative to the loop alias: `total` renders as `item.total`.
      itemVariables: [
        { key: 'title', label: 'Item', example: 'Medusa T-Shirt' },
        { key: 'quantity', label: 'Qty', example: 2, type: 'number' },
        {
          key: 'total',
          label: 'Line total',
          example: 40,
          type: 'money',
          // Absolute on purpose: items carry no currency, and `order` is still
          // in scope inside the loop.
          currencyKey: 'order.currency_code',
        },
      ],
    },
    {
      key: 'order.subtotal',
      label: 'Subtotal',
      example: 40,
      type: 'money',
      currencyKey: 'order.currency_code',
      group: 'Totals',
    },
    {
      key: 'order.shipping_total',
      label: 'Shipping total',
      example: 10,
      type: 'money',
      currencyKey: 'order.currency_code',
      group: 'Totals',
    },
    {
      key: 'order.tax_total',
      label: 'Tax total',
      example: 5,
      type: 'money',
      currencyKey: 'order.currency_code',
      group: 'Totals',
    },
    {
      key: 'order.discount_total',
      label: 'Discount total',
      example: 0,
      type: 'money',
      currencyKey: 'order.currency_code',
      group: 'Totals',
    },
    {
      key: 'order.total',
      label: 'Total',
      example: 55,
      type: 'money',
      currencyKey: 'order.currency_code',
      group: 'Totals',
    },
    {
      key: 'store.name',
      label: 'Store name',
      example: 'Medusa Store',
      group: 'Store',
    },
  ],
});

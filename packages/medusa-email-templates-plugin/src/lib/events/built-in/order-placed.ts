import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { defineEmailEvent } from '../define-email-event';
import { getOrderUrl, getStorefrontUrl } from '../urls';
import {
  ORDER_ITEM_ROW,
  ORDER_TOTALS,
  orderPlacedDefaultTemplate,
} from './default-templates/order-placed';
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
  snippets: [
    {
      key: 'order-totals',
      label: 'Order totals',
      description: 'Subtotal, discount, shipping, tax and total',
      html: ORDER_TOTALS,
    },
  ],
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
      // Built from `storefront_url` so it follows the deployment; a URL typed
      // into the template would be wrong in other environments.
      order_url: getOrderUrl(container, order.id),
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
    // A list: a Repeat block source, never a pill (it would print
    // "[object Object]"). Fields match what `getContext` maps each item to.
    {
      key: 'order.items',
      label: 'Order items',
      type: 'list',
      group: 'Order',
      example: [
        {
          title: 'Medusa T-Shirt',
          variant_title: 'M / Black',
          quantity: 2,
          unit_price: 15,
          total: 30,
        },
        {
          title: 'Medusa Hoodie',
          variant_title: 'L',
          quantity: 1,
          unit_price: 10,
          total: 10,
        },
      ],
      itemTemplate: ORDER_ITEM_ROW,
      fields: [
        { key: 'title', label: 'Product', example: 'Medusa T-Shirt' },
        { key: 'variant_title', label: 'Variant', example: 'M / Black' },
        { key: 'quantity', label: 'Quantity', example: 2, type: 'number' },
        {
          key: 'unit_price',
          label: 'Unit price',
          example: 15,
          type: 'money',
          currencyKey: 'order.currency_code',
        },
        {
          key: 'total',
          label: 'Line total',
          example: 30,
          type: 'money',
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
      key: 'order_url',
      label: 'Order link',
      description:
        'Link to this order on the storefront. Needs storefront_url to be configured.',
      example: 'https://shop.example.com/orders/order_01J8Z',
      type: 'url',
      group: 'Order',
    },
    {
      key: 'store.name',
      label: 'Store name',
      example: 'Medusa Store',
      group: 'Store',
    },
  ],

  /*
   * Reported, not enforced: without `storefront_url` the email still sends,
   * just without `order_url`.
   *
   * Its own code, distinct from the password reset's
   * `storefront_url_not_configured` (which does stop the email), so admins
   * aren't told confirmations aren't sending.
   */
  getWarnings: (container) => {
    try {
      getStorefrontUrl(container);
      return [];
    } catch {
      return ['order_link_unavailable'];
    }
  },
});

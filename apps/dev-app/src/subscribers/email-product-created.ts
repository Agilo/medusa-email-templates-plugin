import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import {
  defineEmailEvent,
  sendEmailEventWorkflow,
} from 'medusa-email-templates-plugin/registry';

/**
 * Example of a host app adding its own email event. Subscriber files load at
 * startup, so it is registered before the admin lists templates.
 *
 * Enable it with:
 *   yarn --cwd apps/dev-app email:template:enable product-created
 */
defineEmailEvent<{ id: string }>({
  event: 'product.created',
  templateKey: 'product-created',
  label: 'Product created',
  description: 'Example custom event: notifies the team about a new product.',
  defaultTemplate: {
    subject: 'New product: {{ product.title }}',
    html: '<p>{{ product.title }} was created in {{ store_name }}.</p>',
  },

  async getRecipient() {
    // A real integration would look up who should hear about this.
    return 'josip.vojkovic@agilo.com';
  },

  async getContext(data, container) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: products } = await query.graph({
      entity: 'product',
      fields: ['id', 'title', 'handle'],
      filters: { id: data.id },
    });

    return {
      product: products[0] ?? { title: 'Unknown product' },
      store_name: 'Dev App',
    };
  },

  variables: [
    {
      key: 'product.title',
      label: 'Product title',
      example: 'Medusa T-Shirt',
      group: 'Product',
    },
    { key: 'store_name', label: 'Store name', example: 'Dev App' },
  ],
});

export default async function emailProductCreatedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    await sendEmailEventWorkflow(container).run({
      input: { event: event.name, data: event.data },
    });
  } catch (error) {
    logger.error(
      `Failed to send the product-created email: ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'product.created',
  context: { subscriberId: 'dev-app-email-product-created' },
};

import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { getErrorMessage } from '../lib/errors';
import { sendEmailEventWorkflow } from '../workflows/send-email-event';

export default async function emailOrderPlacedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const { result } = await sendEmailEventWorkflow(container).run({
      input: { event: event.name, data: event.data },
    });

    if (result.skipped) {
      logger.debug(
        `[email-templates] Skipped ${event.name} email: ${result.skipped}`,
      );
    }
  } catch (error) {
    logger.error(
      `[email-templates] Failed to send the ${event.name} email: ${getErrorMessage(error)}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
  context: { subscriberId: 'email-templates-order-placed' },
};

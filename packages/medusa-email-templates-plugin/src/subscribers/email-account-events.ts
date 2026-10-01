import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { getErrorMessage } from '../lib/errors';
import { sendEmailEventWorkflow } from '../workflows/send-email-event';

export default async function emailAccountEventsHandler({
  event,
  container,
}: SubscriberArgs<Record<string, unknown>>) {
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
  event: [
    'invite.created',
    'invite.resent',
    'auth.password_reset',
    'auth.verification_requested',
  ],
  context: { subscriberId: 'email-templates-account-events' },
};

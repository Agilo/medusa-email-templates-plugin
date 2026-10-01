import { Modules } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

import { getErrorMessage, transportFailedError } from '../../lib/errors';

export type SendTestEmailStepInput = {
  to: string;
  template: string;
  trigger_type: string;
  content: { subject: string; html: string; text?: string };
};

// The notification module prefixes provider errors with the notification id.
const NOTIFICATION_ERROR_PREFIX =
  /^Failed to send notification with id \S+:\s*/;

export const sendTestEmailStepId = 'send-email-templates-test-email';

export const sendTestEmailStep = createStep(
  sendTestEmailStepId,
  async (input: SendTestEmailStepInput, { container }) => {
    const notificationModule = container.resolve(Modules.NOTIFICATION);

    try {
      const [notification] = await notificationModule.createNotifications([
        {
          to: input.to,
          channel: 'email',
          template: input.template,
          trigger_type: input.trigger_type,
          content: input.content,
        },
      ]);

      return new StepResponse({
        notification_id: notification.id,
        external_id: notification.external_id ?? null,
      });
    } catch (error) {
      throw transportFailedError(
        getErrorMessage(error).replace(NOTIFICATION_ERROR_PREFIX, ''),
      );
    }
  },
);

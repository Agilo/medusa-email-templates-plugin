import { Modules } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

import type { ResolvedEmailEvent } from './resolve-email-event';

export type SendEmailEventNotificationResult = {
  sent: boolean;
  skipped: string | null;
  notification_id: string | null;
  external_id: string | null;
};

export const sendEmailEventNotificationStepId = 'send-email-event-notification';

/**
 * Creates the notification for a resolved event. The provider renders the
 * managed template from `template` and `data`.
 */
export const sendEmailEventNotificationStep = createStep(
  sendEmailEventNotificationStepId,
  async (input: ResolvedEmailEvent, { container }) => {
    if (!input.send) {
      return new StepResponse<SendEmailEventNotificationResult>({
        sent: false,
        skipped: input.skipped,
        notification_id: null,
        external_id: null,
      });
    }

    const notificationModule = container.resolve(Modules.NOTIFICATION);
    const [notification] = await notificationModule.createNotifications([
      {
        to: input.to,
        channel: 'email',
        template: input.template_key,
        data: input.data,
        trigger_type: input.template_key,
        ...(input.idempotency_key
          ? { idempotency_key: input.idempotency_key }
          : {}),
        ...(input.resource_id ? { resource_id: input.resource_id } : {}),
        ...(input.resource_type ? { resource_type: input.resource_type } : {}),
      },
    ]);

    return new StepResponse<SendEmailEventNotificationResult>({
      sent: true,
      skipped: null,
      notification_id: notification.id,
      external_id: notification.external_id ?? null,
    });
  },
);

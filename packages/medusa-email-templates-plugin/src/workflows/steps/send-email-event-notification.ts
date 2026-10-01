import type {
  FilterableNotificationProps,
  INotificationModuleService,
  NotificationDTO,
} from '@medusajs/framework/types';
import { Modules, NotificationStatus } from '@medusajs/framework/utils';
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
 * The notification an earlier delivery of this event created, if any.
 * `idempotency_key` is filterable (Medusa itself filters on it) but missing
 * from the public filter type, hence the cast.
 */
const findByIdempotencyKey = async (
  notificationModule: INotificationModuleService,
  idempotencyKey: string,
): Promise<NotificationDTO | undefined> => {
  const [existing] = await notificationModule.listNotifications(
    { idempotency_key: idempotencyKey } as FilterableNotificationProps,
    { take: 1 },
  );

  return existing;
};

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
    const previous = input.idempotency_key
      ? await findByIdempotencyKey(notificationModule, input.idempotency_key)
      : undefined;

    /*
     * Workaround for a Medusa bug (@medusajs/notification 2.21.0,
     * `NotificationModuleService.createNotifications_`): a failed key is
     * resent under a new id that is never inserted. The email goes out, then
     * the status update throws "Notification with id … not found" (whether or
     * not the send worked), and the row stays failed, so every redelivery
     * sends again. Revisit once Medusa resends under the existing row.
     */
    if (previous) {
      return new StepResponse<SendEmailEventNotificationResult>({
        sent: false,
        skipped:
          previous.status === NotificationStatus.FAILURE
            ? 'previously_failed'
            : 'already_sent',
        notification_id: previous.id,
        external_id: previous.external_id ?? null,
      });
    }

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

    // Still optional: a concurrent delivery can slip in after the lookup, and
    // Medusa (which takes no lock) then returns nothing.
    return new StepResponse<SendEmailEventNotificationResult>({
      sent: true,
      skipped: null,
      notification_id: notification?.id ?? null,
      external_id: notification?.external_id ?? null,
    });
  },
);

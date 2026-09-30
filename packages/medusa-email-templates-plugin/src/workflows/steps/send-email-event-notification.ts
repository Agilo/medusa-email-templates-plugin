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
  /**
   * Why nothing was sent: a reason from resolving the event, or — when this
   * event was delivered before — `already_sent` or `previously_failed`.
   */
  skipped: string | null;
  notification_id: string | null;
  external_id: string | null;
};

export const sendEmailEventNotificationStepId = 'send-email-event-notification';

/**
 * The notification an earlier delivery of this event created, if any.
 *
 * `idempotency_key` is a real column the module filters on — its own
 * `createNotifications` looks rows up by it — but the public filter type does
 * not declare it, hence the cast.
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

/**
 * Creates the notification for a resolved event. The provider renders the
 * managed template from `template` and `data`.
 *
 * An event can arrive more than once — a redelivery, a re-emitted event — and
 * the idempotency key is what stops the customer getting two emails. So an
 * event already delivered is settled here, before Medusa is asked, and never
 * reaches `createNotifications` with a key it has seen:
 *
 *  - the earlier send succeeded (or is still in flight): skipped as
 *    `already_sent`. Medusa would answer with an empty array rather than the
 *    existing row, and reading that as `[notification]` threw on every
 *    redelivery, logging a failure for an email that had gone out fine.
 *
 *  - the earlier send failed: skipped as `previously_failed`, not resent.
 *    Medusa (2.21) does try to resend a failed key, but under a freshly
 *    generated id it never creates a row for; the email goes out and the
 *    status update then throws "Notification … not found" — in a `finally`,
 *    so it throws the same way whether the send worked or not. The failed row
 *    stays failed, so each further delivery would send another copy. The
 *    original failure is already logged and recorded on its notification.
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
    const previous = input.idempotency_key
      ? await findByIdempotencyKey(notificationModule, input.idempotency_key)
      : undefined;

    /*
     * Workaround for a Medusa bug (seen in @medusajs/notification 2.21.0,
     * `NotificationModuleService.createNotifications_`): a repeated
     * idempotency key whose earlier notification failed is resent under a new
     * generated id that is never inserted, so the email goes out and the
     * status update in its `finally` throws "Notification with id … not
     * found". The failed row is never updated, so every later delivery would
     * send again. Settling repeated keys here keeps us off that path entirely.
     * Revisit once Medusa resends under the existing row.
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

    /*
     * Optional chaining still: another delivery of the same event can land
     * between the lookup above and this call, and Medusa then answers with
     * nothing. Its own comment says it takes no lock here either.
     */
    return new StepResponse<SendEmailEventNotificationResult>({
      sent: true,
      skipped: null,
      notification_id: notification?.id ?? null,
      external_id: notification?.external_id ?? null,
    });
  },
);

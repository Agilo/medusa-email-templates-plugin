import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from '@medusajs/framework/types';
import {
  AbstractNotificationProviderService,
  MedusaError,
} from '@medusajs/framework/utils';

import { resolveFromAppContainer } from '../../lib/container';
import { hasSubject, isRenderedContent } from '../../lib/content';
import {
  getErrorMessage,
  invalidDataError,
  transportFailedError,
} from '../../lib/errors';
import { resolveSelectedTransport } from '../../lib/provider-configuration';
import { redactSecrets } from '../../lib/redact';
import type { RenderedEmail } from '../../lib/transports/types';
import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';

type InjectedDependencies = {
  logger: Logger;
};

// The notification module passes the stored notification row, which also
// carries the idempotency key.
type NotificationToSend = ProviderSendNotificationDTO & {
  idempotency_key?: string | null;
};

export default class EmailTemplatesProviderService extends AbstractNotificationProviderService {
  static identifier = 'email-templates';

  protected logger_: Logger;

  constructor({ logger }: InjectedDependencies) {
    super();
    this.logger_ = logger;
  }

  async send(
    notification: NotificationToSend,
  ): Promise<ProviderSendNotificationResultsDTO> {
    if (notification.channel !== 'email') {
      throw invalidDataError(
        `The email-templates provider only supports the "email" channel, received "${notification.channel}".`,
      );
    }

    const { content } = notification;

    // Phase 2 adds rendering of plugin-managed templates (PLAN.md §4 step 3).
    if (!isRenderedContent(content)) {
      throw invalidDataError(
        notification.template
          ? `No managed email template "${notification.template}". Provide rendered content.html or content.text.`
          : 'The notification has no rendered content and no template.',
      );
    }

    if (!hasSubject(content)) {
      throw invalidDataError('content.subject is required to send an email.');
    }

    const service = resolveFromAppContainer<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );
    const { transport, context } = await resolveSelectedTransport(service, {
      logger: this.logger_,
      idempotencyKey: notification.idempotency_key,
    });

    const email: RenderedEmail = {
      to: notification.to,
      from:
        notification.from ??
        (typeof context.config.from_address === 'string'
          ? context.config.from_address
          : undefined),
      attachments: notification.attachments,
      template: notification.template,
      data: notification.data,
      provider_data: notification.provider_data,
      content: {
        subject: content.subject as string,
        html: content.html,
        text: content.text,
      },
    };

    try {
      const result = await transport.send(email, context);

      return { id: result.id };
    } catch (error) {
      const message = redactSecrets(getErrorMessage(error), [
        context.credential?.api_key,
      ]);

      if (error instanceof MedusaError) {
        throw new MedusaError(error.type, message, error.code);
      }

      throw transportFailedError(
        `${transport.label} failed to send the email: ${message}`,
      );
    }
  }
}

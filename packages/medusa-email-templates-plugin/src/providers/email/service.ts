import type {
  ConfigModule,
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from '@medusajs/framework/types';
import {
  AbstractNotificationProviderService,
  MedusaError,
} from '@medusajs/framework/utils';

import { resolveFromAppContainer } from '../../lib/container';
import {
  getErrorMessage,
  invalidDataError,
  transportFailedError,
} from '../../lib/errors';
import { resolveSelectedTransport } from '../../lib/provider-configuration';
import { redactSecrets } from '../../lib/redact';
import { resolveEmailContent } from '../../lib/resolve-email-content';
import { readCloudEmailConfig } from '../../lib/transports/cloud-config';
import type { RenderedEmail } from '../../lib/transports/types';
import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';

type InjectedDependencies = {
  logger: Logger;
  configModule: ConfigModule;
};

// The notification module passes the stored notification row, which also
// carries the idempotency key.
type NotificationToSend = ProviderSendNotificationDTO & {
  idempotency_key?: string | null;
};

export default class EmailTemplatesProviderService extends AbstractNotificationProviderService {
  static identifier = 'email-templates';

  protected logger_: Logger;
  protected configModule_: ConfigModule;

  constructor({ logger, configModule }: InjectedDependencies) {
    super();
    this.logger_ = logger;
    this.configModule_ = configModule;
  }

  async send(
    notification: NotificationToSend,
  ): Promise<ProviderSendNotificationResultsDTO> {
    if (notification.channel !== 'email') {
      throw invalidDataError(
        `The email-templates provider only supports the "email" channel, received "${notification.channel}".`,
      );
    }

    const service = resolveFromAppContainer<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );
    const content = await resolveEmailContent(notification, service);

    const { transport, context } = await resolveSelectedTransport(service, {
      logger: this.logger_,
      idempotencyKey: notification.idempotency_key,
      cloud: readCloudEmailConfig(this.configModule_),
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
      content,
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

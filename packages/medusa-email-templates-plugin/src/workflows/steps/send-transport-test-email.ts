import type { ConfigModule, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

import { getErrorMessage, transportFailedError } from '../../lib/errors';
import {
  resolveSelectedTransport,
  resolveTransportById,
} from '../../lib/provider-configuration';
import { redactSecrets } from '../../lib/redact';
import { buildProviderTestEmail } from '../../lib/test-email';
import { readCloudEmailConfig } from '../../lib/transports/cloud-config';
import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';

export type SendTransportTestEmailStepInput = {
  to: string;
  /** Defaults to the selected transport. */
  transport_id?: string;
};

export const sendTransportTestEmailStepId = 'send-transport-test-email';

/**
 * Sends the fixed test email straight through a transport, rather than through
 * the Notification module.
 *
 * The module routes every email to the *selected* transport, so going through
 * it would make "test Mailgun" silently send through Resend. A direct send
 * still resolves the credential, checks availability and calls the provider's
 * API, which is everything a test needs to prove — it just isn't recorded as a
 * notification, because it is a diagnostic rather than a real email.
 */
export const sendTransportTestEmailStep = createStep(
  sendTransportTestEmailStepId,
  async (input: SendTransportTestEmailStepInput, { container }) => {
    const service = container.resolve<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );
    const configModule = container.resolve<ConfigModule>(
      ContainerRegistrationKeys.CONFIG_MODULE,
    );
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

    const options = { logger, cloud: readCloudEmailConfig(configModule) };
    const { transport, context } = input.transport_id
      ? await resolveTransportById(service, input.transport_id, options)
      : await resolveSelectedTransport(service, options);

    const content = buildProviderTestEmail(transport.label);

    try {
      const result = await transport.send(
        {
          to: input.to,
          from:
            typeof context.config.from_address === 'string'
              ? context.config.from_address
              : undefined,
          content,
        },
        context,
      );

      return new StepResponse({
        external_id: result.id ?? null,
        transport_id: transport.id,
      });
    } catch (error) {
      const message = redactSecrets(getErrorMessage(error), [
        context.credential?.api_key,
      ]);

      throw transportFailedError(
        `${transport.label} failed to send the test email: ${message}`,
      );
    }
  },
);

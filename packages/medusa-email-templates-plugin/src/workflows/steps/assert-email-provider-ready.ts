import type { ConfigModule } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

import { resolveSelectedTransport } from '../../lib/provider-configuration';
import { readCloudEmailConfig } from '../../lib/transports/cloud-config';
import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';

export const assertEmailProviderReadyStepId = 'assert-email-provider-ready';

/** Fails with a "provider not ready" error when no email can be sent. */
export const assertEmailProviderReadyStep = createStep(
  assertEmailProviderReadyStepId,
  async (_input: Record<string, never>, { container }) => {
    const service = container.resolve<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );
    const configModule = container.resolve<ConfigModule>(
      ContainerRegistrationKeys.CONFIG_MODULE,
    );

    const { transport } = await resolveSelectedTransport(service, {
      cloud: readCloudEmailConfig(configModule),
    });

    return new StepResponse({
      transport_id: transport.id,
      transport_label: transport.label,
    });
  },
);

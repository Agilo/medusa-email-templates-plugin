import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import type { ConfigModule } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { getEmailProviderState } from '../../../../lib/provider-configuration';
import { readCloudEmailConfig } from '../../../../lib/transports/cloud-config';
import { EMAIL_TEMPLATES_MODULE } from '../../../../modules/email-templates';
import type EmailTemplatesModuleService from '../../../../modules/email-templates/service';
import { saveEmailProviderConfigurationWorkflow } from '../../../../workflows/save-email-provider-configuration';
import { sendEmailErrorResponse } from '../error-response';
import type { PostEmailProviderBody } from './validators';

const providerState = async (req: AuthenticatedMedusaRequest) => {
  const service = req.scope.resolve<EmailTemplatesModuleService>(
    EMAIL_TEMPLATES_MODULE,
  );
  const configModule = req.scope.resolve<ConfigModule>(
    ContainerRegistrationKeys.CONFIG_MODULE,
  );

  return getEmailProviderState(service, {
    cloud: readCloudEmailConfig(configModule),
  });
};

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  res.json({ provider: await providerState(req) });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<PostEmailProviderBody>,
  res: MedusaResponse,
) => {
  try {
    await saveEmailProviderConfigurationWorkflow(req.scope).run({
      input: req.validatedBody,
    });
  } catch (error) {
    // Selecting a transport that isn't available in this environment
    // (for example Medusa Cloud locally) answers 409.
    if (!sendEmailErrorResponse(res, error)) {
      throw error;
    }

    return;
  }

  res.json({ provider: await providerState(req) });
};

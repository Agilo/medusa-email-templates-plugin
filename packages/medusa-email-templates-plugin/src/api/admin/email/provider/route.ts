import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { getEmailProviderState } from '../../../../lib/provider-configuration';
import { EMAIL_TEMPLATES_MODULE } from '../../../../modules/email-templates';
import type EmailTemplatesModuleService from '../../../../modules/email-templates/service';
import { saveEmailProviderConfigurationWorkflow } from '../../../../workflows/save-email-provider-configuration';
import type { PostEmailProviderBody } from './validators';

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const service = req.scope.resolve<EmailTemplatesModuleService>(
    EMAIL_TEMPLATES_MODULE,
  );

  res.json({ provider: await getEmailProviderState(service) });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<PostEmailProviderBody>,
  res: MedusaResponse,
) => {
  await saveEmailProviderConfigurationWorkflow(req.scope).run({
    input: req.validatedBody,
  });

  const service = req.scope.resolve<EmailTemplatesModuleService>(
    EMAIL_TEMPLATES_MODULE,
  );

  res.json({ provider: await getEmailProviderState(service) });
};

import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { listEmailTemplates } from '../../../../lib/templates';
import { EMAIL_TEMPLATES_MODULE } from '../../../../modules/email-templates';
import type EmailTemplatesModuleService from '../../../../modules/email-templates/service';

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const service = req.scope.resolve<EmailTemplatesModuleService>(
    EMAIL_TEMPLATES_MODULE,
  );
  const templates = await listEmailTemplates(service, req.scope);

  res.json({ templates, count: templates.length });
};

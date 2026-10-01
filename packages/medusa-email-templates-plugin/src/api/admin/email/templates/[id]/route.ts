import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import { getEmailEventDefinitionByTemplateKey } from '../../../../../lib/events';
import {
  buildEmailTemplateDetail,
  findEmailTemplate,
} from '../../../../../lib/templates';
import { EMAIL_TEMPLATES_MODULE } from '../../../../../modules/email-templates';
import type EmailTemplatesModuleService from '../../../../../modules/email-templates/service';
import { resetEmailTemplateWorkflow } from '../../../../../workflows/reset-email-template';
import { upsertEmailTemplateWorkflow } from '../../../../../workflows/upsert-email-template';
import type { PostEmailTemplateBody } from '../validators';

const requireDefinition = (templateKey: string) => {
  const definition = getEmailEventDefinitionByTemplateKey(templateKey);

  if (!definition) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No managed email template "${templateKey}".`,
    );
  }

  return definition;
};

const respondWithTemplate = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const { id: templateKey } = req.params;
  const definition = requireDefinition(templateKey);
  const service = req.scope.resolve<EmailTemplatesModuleService>(
    EMAIL_TEMPLATES_MODULE,
  );
  const row = await findEmailTemplate(service, templateKey);

  res.json({
    template: buildEmailTemplateDetail(definition, row, req.scope),
  });
};

export const GET = respondWithTemplate;

export const POST = async (
  req: AuthenticatedMedusaRequest<PostEmailTemplateBody>,
  res: MedusaResponse,
) => {
  const { id: templateKey } = req.params;
  requireDefinition(templateKey);

  await upsertEmailTemplateWorkflow(req.scope).run({
    input: { template_key: templateKey, ...req.validatedBody },
  });

  await respondWithTemplate(req, res);
};

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const { id: templateKey } = req.params;
  requireDefinition(templateKey);

  await resetEmailTemplateWorkflow(req.scope).run({
    input: { template_key: templateKey },
  });

  await respondWithTemplate(req, res);
};

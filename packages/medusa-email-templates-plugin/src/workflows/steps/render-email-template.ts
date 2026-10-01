import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

import { invalidDataError } from '../../lib/errors';
import { getEmailEventDefinitionByTemplateKey } from '../../lib/events';
import { renderEmailTemplate } from '../../lib/rendering/render-template';
import {
  buildSampleData,
  findEmailTemplate,
  resolveEmailTemplateSource,
  type EmailTemplateDraft,
} from '../../lib/templates';
import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';

export type RenderEmailTemplateInput = {
  template_key: string;
  data?: Record<string, unknown>;
  draft?: EmailTemplateDraft;
};

export const renderEmailTemplateStepId = 'render-email-template';

export const renderEmailTemplateStep = createStep(
  renderEmailTemplateStepId,
  async (input: RenderEmailTemplateInput, { container }) => {
    const definition = getEmailEventDefinitionByTemplateKey(input.template_key);

    if (!definition) {
      throw invalidDataError(
        `No managed email template "${input.template_key}".`,
      );
    }

    const service = container.resolve<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );
    const row = await findEmailTemplate(service, input.template_key);
    const source = resolveEmailTemplateSource(definition, row, input.draft);
    const data = buildSampleData(definition, input.data);

    return new StepResponse(await renderEmailTemplate(source, data));
  },
);

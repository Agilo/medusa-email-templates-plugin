import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

import { invalidDataError } from '../../lib/errors';
import { getEmailEventDefinitionByTemplateKey } from '../../lib/events';
import { createEmailLiquid } from '../../lib/rendering/liquid';
import { findEmailTemplate } from '../../lib/templates';
import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';

export type UpsertEmailTemplateInput = {
  template_key: string;
  enabled: boolean;
  subject_template: string;
  editor_content?: Record<string, unknown> | null;
  html_template?: string | null;
  text_template?: string | null;
};

type TemplateSnapshot = {
  id: string;
  enabled: boolean;
  subject_template: string;
  editor_content: Record<string, unknown> | null;
  html_template: string | null;
  text_template: string | null;
};

type Compensation =
  | { created_id: string; previous: null }
  | { created_id: null; previous: TemplateSnapshot }
  | null;

const liquid = createEmailLiquid();

/** Rejects templates that don't parse, so a broken one is never stored. */
const assertParses = (
  template: string | null | undefined,
  field: string,
): void => {
  if (!template) {
    return;
  }

  try {
    liquid.parse(template);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw invalidDataError(`Invalid Liquid in the ${field}: ${message}`);
  }
};

export const upsertEmailTemplateStepId = 'upsert-email-template-record';

export const upsertEmailTemplateStep = createStep(
  upsertEmailTemplateStepId,
  async (input: UpsertEmailTemplateInput, { container }) => {
    const definition = getEmailEventDefinitionByTemplateKey(input.template_key);

    if (!definition) {
      throw invalidDataError(
        `No managed email template "${input.template_key}".`,
      );
    }

    assertParses(input.subject_template, 'subject');
    assertParses(input.html_template, 'HTML body');
    assertParses(input.text_template, 'text body');

    const service = container.resolve<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );
    const existing = await findEmailTemplate(service, input.template_key);

    const data = {
      event: definition.event,
      template_key: input.template_key,
      enabled: input.enabled,
      subject_template: input.subject_template,
      editor_content: input.editor_content ?? null,
      html_template: input.html_template ?? null,
      text_template: input.text_template ?? null,
    };

    if (existing) {
      const updated = await service.updateEmailTemplates({
        id: existing.id,
        ...data,
      });

      return new StepResponse(updated, {
        created_id: null,
        previous: {
          id: existing.id,
          enabled: existing.enabled,
          subject_template: existing.subject_template,
          editor_content: existing.editor_content,
          html_template: existing.html_template,
          text_template: existing.text_template,
        },
      } as Compensation);
    }

    const created = await service.createEmailTemplates(data);

    return new StepResponse(created, {
      created_id: created.id,
      previous: null,
    } as Compensation);
  },
  async (compensation: Compensation | undefined, { container }) => {
    if (!compensation) {
      return;
    }

    const service = container.resolve<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );

    if (compensation.created_id) {
      await service.deleteEmailTemplates(compensation.created_id);
      return;
    }

    if (compensation.previous) {
      await service.updateEmailTemplates(compensation.previous);
    }
  },
);

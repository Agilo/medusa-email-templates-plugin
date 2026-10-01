import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

import { invalidDataError } from '../../lib/errors';
import { getEmailEventDefinitionByTemplateKey } from '../../lib/events';
import { findEmailTemplate } from '../../lib/templates';
import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';

export type ResetEmailTemplateStepInput = {
  template_key: string;
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
  | { restored: string; previous: null }
  | { restored: null; previous: TemplateSnapshot }
  | null;

export const resetEmailTemplateStepId = 'reset-email-template-record';

/**
 * Puts an event back on its built-in template.
 *
 * `enabled` lives on the same row, so an enabled template's row is reverted
 * to the default content (deleting it would switch the email off). A
 * disabled template's row is removed.
 */
export const resetEmailTemplateStep = createStep(
  resetEmailTemplateStepId,
  async (input: ResetEmailTemplateStepInput, { container }) => {
    const definition = getEmailEventDefinitionByTemplateKey(input.template_key);

    if (!definition) {
      throw invalidDataError(
        `No managed email template "${input.template_key}".`,
      );
    }

    const service = container.resolve<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );
    const existing = await findEmailTemplate(service, input.template_key);

    if (!existing) {
      return new StepResponse({ reset: false }, null);
    }

    const previous: TemplateSnapshot = {
      id: existing.id,
      enabled: existing.enabled,
      subject_template: existing.subject_template,
      editor_content: existing.editor_content,
      html_template: existing.html_template,
      text_template: existing.text_template,
    };

    if (!existing.enabled) {
      // Soft-deleted so the compensation can restore it (`restore` only finds
      // soft-deleted rows). The unique index ignores deleted rows, so saving
      // again still works.
      await service.softDeleteEmailTemplates(existing.id);

      return new StepResponse({ reset: true }, {
        restored: existing.id,
        previous: null,
      } as Compensation);
    }

    await service.updateEmailTemplates({
      id: existing.id,
      subject_template: definition.defaultTemplate.subject,
      editor_content: null,
      html_template: null,
      text_template: null,
    });

    return new StepResponse({ reset: true }, {
      restored: null,
      previous,
    } as Compensation);
  },
  async (compensation: Compensation | undefined, { container }) => {
    if (!compensation) {
      return;
    }

    const service = container.resolve<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );

    if (compensation.restored) {
      await service.restoreEmailTemplates(compensation.restored);
      return;
    }

    if (compensation.previous) {
      await service.updateEmailTemplates(compensation.previous);
    }
  },
);

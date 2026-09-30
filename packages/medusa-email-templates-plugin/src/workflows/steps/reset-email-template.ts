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
 * A template that is sending keeps sending: `enabled` lives on the same row as
 * the content, so dropping the row would silently switch the email off. The
 * row is reverted to the default content instead, and only removed when the
 * template is disabled and therefore has nothing worth keeping.
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

    // Never customised, so it is already on the default.
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
      /*
       * Soft, so the compensation below can bring it back: `restore` only
       * finds soft-deleted rows, and a hard delete left a rolled-back reset
       * with nothing to restore — the admin's customised template gone for
       * good. The unique index on `template_key` ignores deleted rows, so
       * saving the template again still creates a fresh one.
       */
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

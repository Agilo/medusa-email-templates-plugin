import type EmailTemplatesModuleService from '../modules/email-templates/service';
import type { EmailEventDefinition } from './events/types';
import type { EmailTemplateSource } from './rendering/render-template';

export type EmailTemplateRecord = {
  id: string;
  event: string;
  template_key: string;
  enabled: boolean;
  subject_template: string;
  editor_content: Record<string, unknown> | null;
  html_template: string | null;
  text_template: string | null;
  updated_at?: Date | string;
};

export const findEmailTemplate = async (
  service: EmailTemplatesModuleService,
  templateKey: string,
): Promise<EmailTemplateRecord | null> => {
  const [row] = (await service.listEmailTemplates({
    template_key: templateKey,
  })) as unknown as EmailTemplateRecord[];

  return row ?? null;
};

/**
 * Returns the template to render, or null when it is disabled or not saved
 * yet. A template with no stored HTML falls back to the definition's default.
 */
export const findEnabledEmailTemplate = async (
  service: EmailTemplatesModuleService,
  definition: EmailEventDefinition<never>,
): Promise<EmailTemplateSource | null> => {
  const row = await findEmailTemplate(service, definition.templateKey);

  if (!row?.enabled) {
    return null;
  }

  return {
    template_key: row.template_key,
    subject_template: row.subject_template,
    html_template: row.html_template ?? definition.defaultTemplate.html,
    text_template: row.text_template,
  };
};

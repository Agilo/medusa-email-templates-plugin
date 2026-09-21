import type { MedusaContainer } from '@medusajs/framework/types';

import type EmailTemplatesModuleService from '../modules/email-templates/service';
import { listEmailEventDefinitions } from './events';
import type {
  EmailEventDefinition,
  EmailTemplateVariable,
} from './events/types';
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

export type EmailTemplateListItem = {
  id: string | null;
  template_key: string;
  event: string;
  label: string;
  description?: string;
  enabled: boolean;
  subject_template: string;
  /** True once the template has been saved, rather than only defined in code. */
  is_customized: boolean;
  updated_at: Date | string | null;
  warnings: string[];
};

export type EmailTemplateDetail = EmailTemplateListItem & {
  editor_content: Record<string, unknown> | null;
  html_template: string | null;
  text_template: string | null;
  variables: EmailTemplateVariable[];
  default_template: {
    subject: string;
    html: string;
    text?: string;
  };
};

export type EmailTemplateDraft = {
  subject_template?: string;
  html_template?: string | null;
  text_template?: string | null;
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

export const listEmailTemplateRecords = async (
  service: EmailTemplatesModuleService,
): Promise<Map<string, EmailTemplateRecord>> => {
  const rows = (await service.listEmailTemplates(
    {},
  )) as unknown as EmailTemplateRecord[];

  return new Map(rows.map((row) => [row.template_key, row]));
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

/**
 * Whether anyone has actually changed this template.
 *
 * Not the same as "a row exists": enabling a template stores a row whose
 * content still matches the built-in default, and calling that customised
 * would be misleading.
 */
const isCustomized = (
  definition: EmailEventDefinition<never>,
  row: EmailTemplateRecord | undefined,
): boolean => {
  if (!row) {
    return false;
  }

  return (
    row.subject_template !== definition.defaultTemplate.subject ||
    row.html_template !== null ||
    row.text_template !== null ||
    row.editor_content !== null
  );
};

const toListItem = (
  definition: EmailEventDefinition<never>,
  row: EmailTemplateRecord | undefined,
  container: MedusaContainer,
): EmailTemplateListItem => ({
  id: row?.id ?? null,
  template_key: definition.templateKey,
  event: definition.event,
  label: definition.label,
  description: definition.description,
  // A template that was never saved counts as disabled (PLAN.md D4).
  enabled: Boolean(row?.enabled),
  subject_template: row?.subject_template ?? definition.defaultTemplate.subject,
  is_customized: isCustomized(definition, row),
  updated_at: row?.updated_at ?? null,
  warnings: definition.getWarnings?.(container) ?? [],
});

/** Every registered template, whether or not it has been saved. */
export const listEmailTemplates = async (
  service: EmailTemplatesModuleService,
  container: MedusaContainer,
): Promise<EmailTemplateListItem[]> => {
  const rows = await listEmailTemplateRecords(service);

  return listEmailEventDefinitions().map((definition) =>
    toListItem(definition, rows.get(definition.templateKey), container),
  );
};

export const buildEmailTemplateDetail = (
  definition: EmailEventDefinition<never>,
  row: EmailTemplateRecord | null,
  container: MedusaContainer,
): EmailTemplateDetail => ({
  ...toListItem(definition, row ?? undefined, container),
  editor_content: row?.editor_content ?? null,
  html_template: row?.html_template ?? null,
  text_template: row?.text_template ?? null,
  variables: definition.variables,
  default_template: definition.defaultTemplate,
});

/**
 * Sample data for previews and test sends, from each variable's example.
 * `order.items` becomes a nested object, so `{{ order.items }}` works.
 */
export const buildSampleData = (
  definition: EmailEventDefinition<never>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => {
  const data: Record<string, unknown> = {};

  definition.variables.forEach((variable) => {
    const segments = variable.key.split('.');
    let target = data;

    segments.slice(0, -1).forEach((segment) => {
      if (typeof target[segment] !== 'object' || target[segment] === null) {
        target[segment] = {};
      }

      target = target[segment] as Record<string, unknown>;
    });

    target[segments[segments.length - 1]] = variable.example;
  });

  return { ...data, ...overrides };
};

/**
 * The template to render for a preview or test: the draft when the editor
 * sends unsaved edits, otherwise the saved row, otherwise the default.
 */
export const resolveEmailTemplateSource = (
  definition: EmailEventDefinition<never>,
  row: EmailTemplateRecord | null,
  draft?: EmailTemplateDraft,
): EmailTemplateSource => ({
  template_key: definition.templateKey,
  subject_template:
    draft?.subject_template ??
    row?.subject_template ??
    definition.defaultTemplate.subject,
  html_template:
    draft?.html_template ??
    row?.html_template ??
    definition.defaultTemplate.html,
  text_template:
    draft?.text_template ??
    row?.text_template ??
    definition.defaultTemplate.text ??
    null,
});

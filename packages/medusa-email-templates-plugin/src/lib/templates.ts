import type { MedusaContainer } from '@medusajs/framework/types';

import type EmailTemplatesModuleService from '../modules/email-templates/service';
import { listEmailEventDefinitions } from './events';
import type {
  EmailEventDefinition,
  EmailTemplateSnippet,
  EmailTemplateVariable,
} from './events/types';
import { createEmailLiquid } from './rendering/liquid';
import type { EmailTemplateSource } from './rendering/render-template';

const subjectLiquid = createEmailLiquid();

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
  is_customized: boolean;
  updated_at: Date | string | null;
  warnings: string[];
};

export type EmailTemplateDetail = EmailTemplateListItem & {
  editor_content: Record<string, unknown> | null;
  html_template: string | null;
  text_template: string | null;
  variables: EmailTemplateVariable[];
  snippets: EmailTemplateSnippet[];
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
 * The plain-text body for sends and previews alike.
 *
 * An explicit text body wins. The default text is used only with the default
 * HTML it was written for; with customised HTML, return null so the text is
 * derived from the real HTML.
 */
const resolveTextTemplate = (
  definition: EmailEventDefinition<never>,
  { html, text }: { html: string | null; text: string | null },
): string | null => {
  if (text !== null) {
    return text;
  }

  return html === null ? (definition.defaultTemplate.text ?? null) : null;
};

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
    text_template: resolveTextTemplate(definition, {
      html: row.html_template,
      text: row.text_template,
    }),
  };
};

/**
 * Whether the template's content differs from the default. A row alone
 * doesn't count: enabling a template stores one with default content.
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

/**
 * Variables a subject uses that its event doesn't declare.
 *
 * The editor only writes valid pills, but an API-saved subject is raw Liquid,
 * and without `strictVariables` a typo renders empty
 * (`Your {{ store.nme }} order` → `Your  order`).
 *
 * Reported, not rejected: the declared list is what the editor offers, not
 * everything the context holds (e.g. `order.shipping_address.city` works).
 *
 * `globalFullVariablesSync` skips loop aliases and `assign` locals, so
 * `{{ item.title }}` inside a loop isn't reported.
 */
const unknownSubjectVariables = (
  definition: EmailEventDefinition<never>,
  subject: string,
): string[] => {
  const declared = new Set(
    definition.variables.map((variable) => variable.key),
  );

  try {
    return subjectLiquid
      .globalFullVariablesSync(subject)
      .filter((key) => !declared.has(key));
  } catch {
    // Invalid Liquid is refused on save; stay quiet so the list still renders.
    return [];
  }
};

const subjectWarnings = (
  definition: EmailEventDefinition<never>,
  subject: string,
): string[] => {
  const unknown = unknownSubjectVariables(definition, subject);

  if (unknown.length === 0) {
    return [];
  }

  // Prose, not a code: the admin shows unknown warnings verbatim.
  return [
    `The subject uses ${unknown.length === 1 ? 'a variable' : 'variables'} this event does not provide: ${unknown.join(', ')}. ${unknown.length === 1 ? 'It renders' : 'They render'} as empty text.`,
  ];
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
  enabled: Boolean(row?.enabled),
  subject_template: row?.subject_template ?? definition.defaultTemplate.subject,
  is_customized: isCustomized(definition, row),
  updated_at: row?.updated_at ?? null,
  warnings: [
    ...(definition.getWarnings?.(container) ?? []),
    ...subjectWarnings(
      definition,
      row?.subject_template ?? definition.defaultTemplate.subject,
    ),
  ],
});

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
  snippets: definition.snippets ?? [],
  default_template: definition.defaultTemplate,
});

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
 * The template for a preview or test: the draft, else the saved row, else the
 * default. A draft's `text_template: null` is honoured (derive from HTML).
 */
export const resolveEmailTemplateSource = (
  definition: EmailEventDefinition<never>,
  row: EmailTemplateRecord | null,
  draft?: EmailTemplateDraft,
): EmailTemplateSource => {
  const html = draft?.html_template ?? row?.html_template ?? null;
  const text =
    draft?.text_template !== undefined
      ? draft.text_template
      : (row?.text_template ?? null);

  return {
    template_key: definition.templateKey,
    subject_template:
      draft?.subject_template ??
      row?.subject_template ??
      definition.defaultTemplate.subject,
    html_template: html ?? definition.defaultTemplate.html,
    text_template: resolveTextTemplate(definition, { html, text }),
  };
};

import { convert } from 'html-to-text';

import { getErrorMessage, invalidDataError } from '../errors';
import { createEmailLiquid } from './liquid';
import { sanitizeTemplateContext } from './sanitize-context';

export type EmailTemplateSource = {
  template_key: string;
  subject_template: string;
  html_template?: string | null;
  text_template?: string | null;
};

export type RenderedEmailContent = {
  subject: string;
  html: string;
  text: string;
};

const plainLiquid = createEmailLiquid();
const htmlLiquid = createEmailLiquid({ escapeOutput: true });

// Tables carry the item rows, so they become one text line per row.
const TEXT_OPTIONS = {
  wordwrap: 80,
  selectors: [
    { selector: 'table', format: 'dataTable' },
    { selector: 'img', format: 'skip' },
  ],
};

const render = async (
  liquid: ReturnType<typeof createEmailLiquid>,
  template: string,
  context: Record<string, unknown>,
  templateKey: string,
  field: string,
): Promise<string> => {
  try {
    return await liquid.parseAndRender(template, context);
  } catch (error) {
    // Never include data values: the message may reach the admin UI.
    throw invalidDataError(
      `Failed to render the ${field} of email template "${templateKey}": ${getErrorMessage(error)}`,
    );
  }
};

/**
 * Renders a managed template. HTML output is escaped; the subject and text
 * are not. The text body falls back to the rendered HTML.
 */
export const renderEmailTemplate = async (
  template: EmailTemplateSource,
  data: Record<string, unknown> | null | undefined,
): Promise<RenderedEmailContent> => {
  const context = sanitizeTemplateContext(data);

  const subject = (
    await render(
      plainLiquid,
      template.subject_template,
      context,
      template.template_key,
      'subject',
    )
  )
    .replace(/\s+/g, ' ')
    .trim();

  if (!subject) {
    throw invalidDataError(
      `The subject of email template "${template.template_key}" rendered empty.`,
    );
  }

  const html = template.html_template
    ? await render(
        htmlLiquid,
        template.html_template,
        context,
        template.template_key,
        'HTML body',
      )
    : '';

  const text = template.text_template
    ? await render(
        plainLiquid,
        template.text_template,
        context,
        template.template_key,
        'text body',
      )
    : convert(html, TEXT_OPTIONS);

  if (!html && !text.trim()) {
    throw invalidDataError(
      `Email template "${template.template_key}" has no body.`,
    );
  }

  return { subject, html, text };
};

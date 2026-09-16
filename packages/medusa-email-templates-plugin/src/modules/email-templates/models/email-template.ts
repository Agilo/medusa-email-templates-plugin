import { model } from '@medusajs/framework/utils';

/**
 * One editable template per registered event. A row exists only after the
 * template is saved; until then the template counts as disabled (PLAN.md D4).
 */
const EmailTemplate = model
  .define('email_template', {
    id: model.id({ prefix: 'etpl' }).primaryKey(),
    event: model.text(),
    template_key: model.text(),
    enabled: model.boolean().default(false),
    subject_template: model.text(),
    // React Email Editor (TipTap) document, used to reopen the template.
    editor_content: model.json().nullable(),
    html_template: model.text().nullable(),
    // Optional override; when empty the text body is derived from the
    // rendered HTML at send time.
    text_template: model.text().nullable(),
  })
  .indexes([
    {
      on: ['template_key'],
      unique: true,
    },
    {
      on: ['event'],
    },
  ]);

export default EmailTemplate;

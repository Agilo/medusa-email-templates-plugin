import { model } from '@medusajs/framework/utils';

const EmailTemplate = model
  .define('email_template', {
    id: model.id({ prefix: 'etpl' }).primaryKey(),
    event: model.text(),
    template_key: model.text(),
    enabled: model.boolean().default(false),
    subject_template: model.text(),
    editor_content: model.json().nullable(),
    html_template: model.text().nullable(),
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

import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  getEmailEventDefinitionByTemplateKey,
  listEmailEventDefinitions,
} from 'medusa-email-templates-plugin/lib/events/index';

export default async function enableEmailTemplate({
  container,
  args,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const templateKey = args[0];

  if (!templateKey) {
    logger.error(
      `Pass a template key. Available: ${listEmailEventDefinitions()
        .map((definition) => definition.templateKey)
        .join(', ')}`,
    );
    return;
  }

  const definition = getEmailEventDefinitionByTemplateKey(templateKey);

  if (!definition) {
    logger.error(`Unknown email template "${templateKey}".`);
    return;
  }

  const service = container.resolve('emailTemplates') as {
    listEmailTemplates: (filters: {
      template_key: string;
    }) => Promise<{ id: string }[]>;
    createEmailTemplates: (data: Record<string, unknown>) => Promise<unknown>;
    updateEmailTemplates: (data: Record<string, unknown>) => Promise<unknown>;
  };

  const [existing] = await service.listEmailTemplates({
    template_key: templateKey,
  });

  if (existing) {
    await service.updateEmailTemplates({ id: existing.id, enabled: true });
    logger.info(`Enabled the existing "${templateKey}" email template.`);
    return;
  }

  await service.createEmailTemplates({
    event: definition.event,
    template_key: definition.templateKey,
    enabled: true,
    subject_template: definition.defaultTemplate.subject,
    html_template: null,
    text_template: null,
    editor_content: null,
  });

  logger.info(`Created and enabled the "${templateKey}" email template.`);
}

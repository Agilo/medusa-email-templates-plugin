import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  getEmailEventDefinitionByTemplateKey,
  listEmailEventDefinitions,
} from 'medusa-email-templates-plugin/lib/events/index';

/**
 * Creates and enables a managed email template, for the example app — handy
 * after resetting the database. Settings → Email does the same in the admin.
 *
 * The bodies are left null, which means "the event's default": a send and the
 * editor both fall back to it. Copying the default HTML in instead froze it —
 * the template kept sending that version after the default had moved on.
 *
 * Usage: yarn --cwd apps/dev-app email:template:enable order-placed
 */
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
    // Required by the model, so it is stored; it is not what drifted.
    subject_template: definition.defaultTemplate.subject,
    html_template: null,
    text_template: null,
    editor_content: null,
  });

  logger.info(`Created and enabled the "${templateKey}" email template.`);
}

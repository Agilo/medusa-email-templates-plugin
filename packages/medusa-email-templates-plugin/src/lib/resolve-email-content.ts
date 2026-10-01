import type { ProviderSendNotificationDTO } from '@medusajs/framework/types';

import type EmailTemplatesModuleService from '../modules/email-templates/service';
import { hasSubject, isRenderedContent } from './content';
import { invalidDataError } from './errors';
import { getEmailEventDefinitionByTemplateKey } from './events';
import {
  renderEmailTemplate,
  type RenderedEmailContent,
} from './rendering/render-template';
import { findEnabledEmailTemplate } from './templates';

export type ResolvedContent = {
  subject: string;
  html?: string;
  text?: string;
};

export const resolveEmailContent = async (
  notification: Pick<
    ProviderSendNotificationDTO,
    'content' | 'template' | 'data'
  >,
  service: EmailTemplatesModuleService,
): Promise<ResolvedContent | RenderedEmailContent> => {
  const { content } = notification;

  if (isRenderedContent(content)) {
    if (!hasSubject(content)) {
      throw invalidDataError('content.subject is required to send an email.');
    }

    return {
      subject: content.subject as string,
      html: content.html,
      text: content.text,
    };
  }

  if (!notification.template) {
    throw invalidDataError(
      'The notification has no rendered content and no template.',
    );
  }

  const definition = getEmailEventDefinitionByTemplateKey(
    notification.template,
  );

  if (!definition) {
    throw invalidDataError(
      `No managed email template "${notification.template}". Provide rendered content.html or content.text.`,
    );
  }

  const template = await findEnabledEmailTemplate(service, definition);

  if (!template) {
    throw invalidDataError(
      `The email template "${notification.template}" is disabled.`,
    );
  }

  return renderEmailTemplate(template, notification.data);
};

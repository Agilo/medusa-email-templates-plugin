import previewEmail from 'preview-email';
import { z } from '@medusajs/framework/zod';

import {
  invalidDataError,
  providerNotReadyError,
  transportFailedError,
} from '../errors';
import type { EmailTransport, RenderedEmail } from './types';

export const LOCAL_PREVIEW_TRANSPORT_ID = 'local-preview';

const localPreviewConfigSchema = z.strictObject({});

const addressList = (value: unknown): string[] | undefined => {
  const values = Array.isArray(value) ? value : [value];
  const addresses = values.filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  );

  return addresses.length ? addresses : undefined;
};

const headers = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );

  return entries.length ? Object.fromEntries(entries) : undefined;
};

export const buildLocalPreviewMessage = (email: RenderedEmail) => {
  const providerData = email.provider_data ?? {};

  return {
    from: email.from ?? 'Medusa Preview <preview@example.com>',
    to: email.to,
    cc: addressList(providerData.cc),
    bcc: addressList(providerData.bcc),
    replyTo: addressList(providerData.reply_to),
    headers: headers(providerData.headers),
    subject: email.content.subject,
    html: email.content.html,
    text: email.content.text,
    attachments: email.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content, 'base64'),
      contentType: attachment.content_type ?? undefined,
      ...(attachment.disposition
        ? { contentDisposition: attachment.disposition }
        : {}),
      ...(attachment.disposition === 'inline' && attachment.id
        ? { cid: attachment.id }
        : {}),
    })),
  };
};

export const localPreviewTransport: EmailTransport = {
  id: LOCAL_PREVIEW_TRANSPORT_ID,
  label: 'Local Preview',
  credentialSources: ['managed'],
  configSchema: localPreviewConfigSchema,

  async isAvailable() {
    return process.env.NODE_ENV === 'development';
  },

  async validateConfiguration(config) {
    const result = localPreviewConfigSchema.safeParse(config ?? {});

    if (!result.success) {
      throw invalidDataError('Local Preview does not accept configuration.');
    }

    return result.data;
  },

  async send(email: RenderedEmail, context) {
    if (!(await this.isAvailable(context))) {
      throw providerNotReadyError(
        'Local Preview is only available when NODE_ENV is "development".',
      );
    }

    try {
      const url = await previewEmail(buildLocalPreviewMessage(email), {
        open: false,
        openSimulator: false,
      });

      context.logger?.info(`Local email preview: ${url}`);

      return { id: url };
    } catch (error) {
      throw transportFailedError(
        `Could not create local email preview: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
};

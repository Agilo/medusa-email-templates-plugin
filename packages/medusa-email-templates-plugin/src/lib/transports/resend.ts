import { Resend, type CreateEmailOptions } from 'resend';
import { z } from 'zod';

import {
  formatIssues,
  invalidDataError,
  providerNotReadyError,
  transportFailedError,
} from '../errors';
import { isEmailAddress } from './address';
import type { EmailTransport, RenderedEmail } from './types';

export const RESEND_TRANSPORT_ID = 'resend';

const emailAddressSchema = z.string().trim().refine(isEmailAddress, {
  message:
    'Expected an email address such as "orders@example.com" or "Shop <orders@example.com>"',
});

export const resendConfigSchema = z.object({
  from_address: emailAddressSchema,
  reply_to: emailAddressSchema.optional(),
});

export type ResendConfig = z.infer<typeof resendConfigSchema>;

const parseResendConfig = (config: unknown): ResendConfig => {
  const result = resendConfigSchema.safeParse(config ?? {});

  if (!result.success) {
    throw invalidDataError(
      `Invalid Resend configuration: ${formatIssues(result.error.issues)}`,
    );
  }

  return result.data;
};

const toAddressList = (value: unknown): string[] | undefined => {
  const values = Array.isArray(value) ? value : [value];
  const addresses = values.filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  );

  return addresses.length ? addresses : undefined;
};

const toHeaders = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );

  return entries.length ? Object.fromEntries(entries) : undefined;
};

const toTags = (value: unknown): { name: string; value: string }[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (tag): tag is { name: string; value: string } =>
      !!tag &&
      typeof tag === 'object' &&
      typeof tag.name === 'string' &&
      typeof tag.value === 'string',
  );
};

/**
 * Maps a rendered email to the Resend payload. `cc`, `bcc`, `reply_to`,
 * `headers` and `tags` come from `provider_data`.
 */
export const buildResendPayload = (
  email: RenderedEmail,
  config: ResendConfig,
): CreateEmailOptions => {
  const providerData = email.provider_data ?? {};
  const tags = toTags(providerData.tags);

  return {
    from: email.from ?? config.from_address,
    to: email.to,
    subject: email.content.subject,
    html: email.content.html,
    text: email.content.text,
    cc: toAddressList(providerData.cc),
    bcc: toAddressList(providerData.bcc),
    replyTo: toAddressList(providerData.reply_to) ?? config.reply_to,
    headers: toHeaders(providerData.headers),
    tags: tags.length ? tags : undefined,
    attachments: email.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.content_type,
      ...(attachment.disposition === 'inline' && attachment.id
        ? { contentId: attachment.id }
        : {}),
    })),
  } as CreateEmailOptions;
};

export const resendTransport: EmailTransport = {
  id: RESEND_TRANSPORT_ID,
  label: 'Resend',
  credentialSources: ['environment', 'encrypted_database'],
  configSchema: resendConfigSchema,

  async isAvailable(context) {
    return Boolean(context.credential?.api_key);
  },

  async validateConfiguration(config) {
    return parseResendConfig(config);
  },

  async send(email, context) {
    const apiKey = context.credential?.api_key;

    if (!apiKey) {
      throw providerNotReadyError('The Resend API key is not configured.');
    }

    const config = parseResendConfig(context.config);
    const client = new Resend(apiKey);

    const { data, error } = await client.emails.send(
      buildResendPayload(email, config),
      context.idempotencyKey
        ? { idempotencyKey: context.idempotencyKey }
        : undefined,
    );

    if (error) {
      throw transportFailedError(`Resend rejected the email: ${error.message}`);
    }

    return { id: data?.id };
  },
};

import { z } from 'zod';

import {
  formatIssues,
  invalidDataError,
  providerNotReadyError,
  transportFailedError,
} from '../errors';
import { emailAddressSchema } from './address';
import type { EmailTransport, RenderedEmail } from './types';

export const MAILGUN_TRANSPORT_ID = 'mailgun';

const REGION_BASE_URLS = {
  us: 'https://api.mailgun.net',
  eu: 'https://api.eu.mailgun.net',
} as const;

export const mailgunConfigSchema = z.object({
  domain: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
      'Expected a sending domain such as "mg.example.com"',
    ),
  region: z.enum(['us', 'eu']),
  from_address: emailAddressSchema,
  reply_to: emailAddressSchema.optional(),
});

export type MailgunConfig = z.infer<typeof mailgunConfigSchema>;

const parseMailgunConfig = (config: unknown): MailgunConfig => {
  const result = mailgunConfigSchema.safeParse(config ?? {});

  if (!result.success) {
    throw invalidDataError(
      `Invalid Mailgun configuration: ${formatIssues(result.error.issues)}`,
    );
  }

  return result.data;
};

// Overridden only by integration tests, which point at a local capture server.
const baseUrl = (region: MailgunConfig['region']): string =>
  process.env.MEDUSA_EMAIL_MAILGUN_BASE_URL ?? REGION_BASE_URLS[region];

const appendAddresses = (
  form: FormData,
  field: string,
  value: unknown,
): void => {
  const values = Array.isArray(value) ? value : [value];

  values
    .filter((item): item is string => typeof item === 'string' && !!item)
    .forEach((address) => form.append(field, address));
};

const appendProviderData = (
  form: FormData,
  email: RenderedEmail,
  config: MailgunConfig,
): void => {
  const providerData = email.provider_data ?? {};

  appendAddresses(form, 'cc', providerData.cc);
  appendAddresses(form, 'bcc', providerData.bcc);

  const replyTo = providerData.reply_to ?? config.reply_to;
  if (typeof replyTo === 'string') {
    form.append('h:Reply-To', replyTo);
  }

  if (
    providerData.headers &&
    typeof providerData.headers === 'object' &&
    !Array.isArray(providerData.headers)
  ) {
    Object.entries(providerData.headers).forEach(([name, headerValue]) => {
      if (typeof headerValue === 'string') {
        form.append(`h:${name}`, headerValue);
      }
    });
  }

  if (Array.isArray(providerData.tags)) {
    providerData.tags
      .map((tag) =>
        typeof tag === 'string'
          ? tag
          : typeof tag === 'object' && tag && typeof tag.value === 'string'
            ? tag.value
            : null,
      )
      .filter((tag): tag is string => Boolean(tag))
      .forEach((tag) => form.append('o:tag', tag));
  }
};

export const buildMailgunForm = (
  email: RenderedEmail,
  config: MailgunConfig,
): FormData => {
  const form = new FormData();

  form.append('from', email.from ?? config.from_address);
  form.append('to', email.to);
  form.append('subject', email.content.subject);

  if (email.content.html) {
    form.append('html', email.content.html);
  }

  if (email.content.text) {
    form.append('text', email.content.text);
  }

  appendProviderData(form, email, config);

  email.attachments?.forEach((attachment) => {
    form.append(
      'attachment',
      new Blob([Buffer.from(attachment.content, 'base64')], {
        type: attachment.content_type ?? 'application/octet-stream',
      }),
      attachment.filename,
    );
  });

  return form;
};

export const mailgunTransport: EmailTransport = {
  id: MAILGUN_TRANSPORT_ID,
  label: 'Mailgun',
  credentialSources: ['environment', 'encrypted_database'],
  configSchema: mailgunConfigSchema,

  async isAvailable(context) {
    return Boolean(context.credential?.api_key);
  },

  async validateConfiguration(config) {
    return parseMailgunConfig(config);
  },

  async send(email, context) {
    const apiKey = context.credential?.api_key;

    if (!apiKey) {
      throw providerNotReadyError('The Mailgun API key is not configured.');
    }

    const config = parseMailgunConfig(context.config);
    const url = `${baseUrl(config.region)}/v3/${encodeURIComponent(config.domain)}/messages`;

    // A Domain Sending Key may only POST to /messages, so nothing else is called.
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      },
      body: buildMailgunForm(email, config),
    });

    const body = (await response.json().catch(() => null)) as {
      id?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      throw transportFailedError(
        `Mailgun rejected the email: ${response.status} ${body?.message ?? response.statusText}`,
      );
    }

    return { id: body?.id };
  },
};

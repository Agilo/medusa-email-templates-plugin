import { z } from 'zod';

import {
  formatIssues,
  invalidDataError,
  providerNotReadyError,
  transportFailedError,
} from '../errors';
import { emailAddressSchema } from './address';
import { isCloudEmailConfigured } from './cloud-config';
import type { EmailTransport, RenderedEmail } from './types';

export const MEDUSA_CLOUD_TRANSPORT_ID = 'medusa-cloud';

export const CLOUD_UNAVAILABLE_REASON =
  'Medusa Emails is only available when the application runs on Medusa Cloud with the MEDUSA_CLOUD_* settings injected. It is not available in local development.';

export const medusaCloudConfigSchema = z.object({
  // Optional: a custom sender needs a verified domain on a paid plan; by
  // default Cloud uses its own address.
  from_address: emailAddressSchema.optional(),
});

export type MedusaCloudConfig = z.infer<typeof medusaCloudConfigSchema>;

const parseCloudConfig = (config: unknown): MedusaCloudConfig => {
  const result = medusaCloudConfigSchema.safeParse(config ?? {});

  if (!result.success) {
    throw invalidDataError(
      `Invalid Medusa Cloud configuration: ${formatIssues(result.error.issues)}`,
    );
  }

  return result.data;
};

/**
 * Sends through Medusa's internal Cloud email endpoint, reproducing the
 * request of Medusa's own provider (verified by
 * integration-tests/module/cloud-transport.spec.ts). Cloud manages the
 * credentials; the plugin stores none.
 */
export const medusaCloudTransport: EmailTransport = {
  id: MEDUSA_CLOUD_TRANSPORT_ID,
  label: 'Medusa Cloud',
  credentialSources: ['managed'],
  configSchema: medusaCloudConfigSchema,

  async isAvailable(context) {
    return isCloudEmailConfigured(context.cloud);
  },

  async validateConfiguration(config) {
    return parseCloudConfig(config);
  },

  async send(email: RenderedEmail, context) {
    const cloud = context.cloud;

    if (!isCloudEmailConfigured(cloud)) {
      throw providerNotReadyError(CLOUD_UNAVAILABLE_REASON);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Medusa's provider passes the API key through as-is.
      Authorization: `Basic ${cloud!.apiKey}`,
    };

    if (cloud!.sandboxHandle) {
      headers['x-medusa-sandbox-handle'] = cloud!.sandboxHandle;
    }

    if (cloud!.environmentHandle) {
      headers['x-medusa-environment-handle'] = cloud!.environmentHandle;
    }

    let response: Response;

    // Only the request: failing here means Cloud was never reached.
    try {
      response = await fetch(`${cloud!.emailsEndpoint}/send`, {
        method: 'POST',
        headers,
        // Key order matches Medusa's provider for the contract test.
        body: JSON.stringify({
          to: email.to,
          from: email.from,
          attachments: email.attachments,
          template: email.template,
          data: email.data,
          provider_data: email.provider_data,
          content: email.content,
        }),
      });
    } catch (error) {
      throw transportFailedError(
        `Failed to send email through Medusa Cloud: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Allowed to fail: a gateway error page is HTML, and a parse error would
    // hide the HTTP status. Same fallback as the Mailgun transport.
    const body = (await response.json().catch(() => null)) as {
      id?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      // Medusa core's wording, minus the message when there is none.
      throw transportFailedError(
        `Failed to send email: ${response.status} - ${response.statusText}${body?.message ? `: ${body.message}` : ''}`,
      );
    }

    return { id: body?.id };
  },
};

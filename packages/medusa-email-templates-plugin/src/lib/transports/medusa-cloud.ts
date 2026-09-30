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
  // Optional: a custom sender needs a verified domain on a paid plan, so by
  // default nothing is sent and Cloud uses its own address (PLAN.md D12).
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
 * request Medusa's own provider makes (see PLAN.md §1.2 and the contract test
 * in integration-tests/module/cloud-transport.spec.ts). Credentials are
 * managed by Cloud, so nothing is stored by the plugin.
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

    // Only the request itself: a failure here means Cloud was never reached.
    try {
      response = await fetch(`${cloud!.emailsEndpoint}/send`, {
        method: 'POST',
        headers,
        // Key order matches Medusa's provider, so the contract test can
        // compare the raw body.
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

    /*
     * Parsed apart from the request, and allowed to fail. A gateway in front
     * of Cloud answers an outage with an HTML error page; parsing that inside
     * the try above threw "Unexpected token <" and hid the status that says
     * what actually happened. The same fallback the Mailgun transport uses.
     */
    const body = (await response.json().catch(() => null)) as {
      id?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      // Medusa core's own wording, with the message dropped when there is
      // none rather than printed as "undefined".
      throw transportFailedError(
        `Failed to send email: ${response.status} - ${response.statusText}${body?.message ? `: ${body.message}` : ''}`,
      );
    }

    return { id: body?.id };
  },
};

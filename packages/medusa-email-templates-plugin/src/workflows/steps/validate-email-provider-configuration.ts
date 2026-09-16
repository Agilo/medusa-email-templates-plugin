import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

import {
  ENCRYPTION_KEY_ENV,
  readEncryptionKey,
} from '../../lib/crypto/encryption-key';
import { invalidDataError } from '../../lib/errors';
import { getEmailTransport } from '../../lib/transports/registry';

export type EmailProviderCredentialInput =
  | { source: 'environment'; env_var_name: string }
  | { source: 'encrypted_database'; api_key?: string };

export type SaveEmailProviderConfigurationInput = {
  transport_id: string;
  config?: Record<string, unknown>;
  credential?: EmailProviderCredentialInput;
};

export type NormalizedEmailProviderCredential = EmailProviderCredentialInput;

export type ValidatedEmailProviderConfiguration = {
  transport_id: string;
  config: Record<string, unknown>;
  credential: NormalizedEmailProviderCredential | null;
};

export const validateEmailProviderConfigurationStepId =
  'validate-email-provider-configuration';

export const validateEmailProviderConfigurationStep = createStep(
  validateEmailProviderConfigurationStepId,
  async (input: SaveEmailProviderConfigurationInput) => {
    const transport = getEmailTransport(input.transport_id);

    if (!transport) {
      throw invalidDataError(
        `Unknown email transport "${input.transport_id}".`,
      );
    }

    const config = await transport.validateConfiguration(input.config ?? {});
    const needsCredential = !transport.credentialSources.includes('managed');
    let credential: NormalizedEmailProviderCredential | null = null;

    if (input.credential) {
      if (!transport.credentialSources.includes(input.credential.source)) {
        throw invalidDataError(
          `${transport.label} does not support the "${input.credential.source}" credential source.`,
        );
      }

      // Storing an API key needs the encryption key up front (PLAN.md §5).
      if (input.credential.source === 'encrypted_database') {
        if (input.credential.api_key && !readEncryptionKey()) {
          throw invalidDataError(
            `${ENCRYPTION_KEY_ENV} is not configured, so API keys cannot be stored. Set it, or use an environment variable credential instead.`,
          );
        }
      }

      credential = input.credential;
    } else if (needsCredential) {
      throw invalidDataError(`${transport.label} requires a credential.`);
    }

    return new StepResponse<ValidatedEmailProviderConfiguration>({
      transport_id: transport.id,
      config,
      credential,
    });
  },
);

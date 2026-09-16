import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

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

export type NormalizedEmailProviderCredential = {
  source: 'environment';
  env_var_name: string;
};

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

      // Stored API keys arrive in Phase 3 (PLAN.md §5).
      if (input.credential.source !== 'environment') {
        throw invalidDataError(
          'Stored API keys are not supported yet. Use an environment variable.',
        );
      }

      credential = {
        source: 'environment',
        env_var_name: input.credential.env_var_name,
      };
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

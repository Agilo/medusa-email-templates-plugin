import type { ConfigModule } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

import {
  ENCRYPTION_KEY_ENV,
  readEncryptionKey,
} from '../../lib/crypto/encryption-key';
import { invalidDataError, providerNotReadyError } from '../../lib/errors';
import { listEmailProviderConfigurations } from '../../lib/provider-configuration';
import { readCloudEmailConfig } from '../../lib/transports/cloud-config';
import { getEmailTransport } from '../../lib/transports/registry';
import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';

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
  async (input: SaveEmailProviderConfigurationInput, { container }) => {
    const transport = getEmailTransport(input.transport_id);

    if (!transport) {
      throw invalidDataError(
        `Unknown email transport "${input.transport_id}".`,
      );
    }

    const config = await transport.validateConfiguration(input.config ?? {});
    const isManaged = transport.credentialSources.includes('managed');
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
    } else if (!isManaged) {
      // Omitting the credential keeps whatever is already stored, so a
      // transport configured earlier can be re-selected without resending its
      // secret. `credential` stays null, which makes the upsert step leave the
      // existing row untouched.
      const service = container.resolve<EmailTemplatesModuleService>(
        EMAIL_TEMPLATES_MODULE,
      );
      const [stored] = await listEmailProviderConfigurations(service, {
        transport_id: transport.id,
      });

      if (!stored?.credential) {
        throw invalidDataError(`${transport.label} requires a credential.`);
      }
    }

    // A managed transport carries no credential, so it can only be selected
    // when the environment provides it (Medusa Cloud).
    if (isManaged) {
      const configModule = container.resolve<ConfigModule>(
        ContainerRegistrationKeys.CONFIG_MODULE,
      );
      const available = await transport.isAvailable({
        config,
        credential: null,
        cloud: readCloudEmailConfig(configModule),
      });

      if (!available) {
        throw providerNotReadyError(
          `${transport.label} is not available in this environment.`,
        );
      }
    }

    return new StepResponse<ValidatedEmailProviderConfiguration>({
      transport_id: transport.id,
      config,
      credential,
    });
  },
);

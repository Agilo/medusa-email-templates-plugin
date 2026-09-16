import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';
import type { NormalizedEmailProviderCredential } from './validate-email-provider-configuration';

export type UpsertEmailProviderCredentialInput = {
  configuration_id: string;
  transport_id: string;
  credential: NormalizedEmailProviderCredential | null;
};

type CredentialSnapshot = {
  id: string;
  source: 'managed' | 'environment' | 'encrypted_database' | 'oauth';
  env_var_name: string | null;
  ciphertext: string | null;
  key_fingerprint: string | null;
};

type Compensation =
  | { created_id: string; previous: null }
  | { created_id: null; previous: CredentialSnapshot }
  | null;

export const upsertEmailProviderCredentialStepId =
  'upsert-email-provider-credential';

export const upsertEmailProviderCredentialStep = createStep(
  upsertEmailProviderCredentialStepId,
  async (input: UpsertEmailProviderCredentialInput, { container }) => {
    if (!input.credential) {
      return new StepResponse(null, null as Compensation);
    }

    const service = container.resolve<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );
    const [existing] = await service.listEmailProviderCredentials({
      configuration_id: input.configuration_id,
    });

    const data = {
      source: input.credential.source,
      env_var_name: input.credential.env_var_name,
      ciphertext: null,
      key_fingerprint: null,
    };

    if (existing) {
      await service.updateEmailProviderCredentials({
        id: existing.id,
        ...data,
      });

      return new StepResponse({ id: existing.id }, {
        created_id: null,
        previous: {
          id: existing.id,
          source: existing.source,
          env_var_name: existing.env_var_name,
          ciphertext: existing.ciphertext,
          key_fingerprint: existing.key_fingerprint,
        },
      } as Compensation);
    }

    const created = await service.createEmailProviderCredentials({
      ...data,
      transport_id: input.transport_id,
      configuration_id: input.configuration_id,
    });

    return new StepResponse({ id: created.id }, {
      created_id: created.id,
      previous: null,
    } as Compensation);
  },
  async (compensation: Compensation | undefined, { container }) => {
    if (!compensation) {
      return;
    }

    const service = container.resolve<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );

    if (compensation.created_id) {
      await service.deleteEmailProviderCredentials(compensation.created_id);
      return;
    }

    if (compensation.previous) {
      await service.updateEmailProviderCredentials(compensation.previous);
    }
  },
);

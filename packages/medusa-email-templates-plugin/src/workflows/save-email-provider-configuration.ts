import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';

import { selectEmailProviderConfigurationStep } from './steps/select-email-provider-configuration';
import { upsertEmailProviderCredentialStep } from './steps/upsert-email-provider-credential';
import {
  validateEmailProviderConfigurationStep,
  type SaveEmailProviderConfigurationInput,
} from './steps/validate-email-provider-configuration';

export const saveEmailProviderConfigurationWorkflowId =
  'save-email-provider-configuration';

/**
 * Validates and saves a transport's configuration and credential, and selects
 * it as the active email transport.
 */
export const saveEmailProviderConfigurationWorkflow = createWorkflow(
  saveEmailProviderConfigurationWorkflowId,
  function (input: SaveEmailProviderConfigurationInput) {
    const validated = validateEmailProviderConfigurationStep(input);

    const selectInput = transform({ validated }, ({ validated }) => ({
      transport_id: validated.transport_id,
      config: validated.config,
    }));
    const configuration = selectEmailProviderConfigurationStep(selectInput);

    const credentialInput = transform(
      { validated, configuration },
      ({ validated, configuration }) => ({
        configuration_id: configuration.id,
        transport_id: validated.transport_id,
        credential: validated.credential,
      }),
    );
    upsertEmailProviderCredentialStep(credentialInput);

    const result = transform({ configuration }, ({ configuration }) => ({
      id: configuration.id,
      transport_id: configuration.transport_id,
    }));

    return new WorkflowResponse(result);
  },
);

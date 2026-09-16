import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';

import {
  buildProviderTestEmail,
  PROVIDER_TEST_TEMPLATE,
  PROVIDER_TEST_TRIGGER,
} from '../lib/test-email';
import { assertEmailProviderReadyStep } from './steps/assert-email-provider-ready';
import { sendTestEmailStep } from './steps/send-test-email';

export type SendProviderTestEmailInput = {
  to: string;
};

export const sendProviderTestEmailWorkflowId = 'send-email-provider-test-email';

/** Sends a fixed test email through the saved, selected transport. */
export const sendProviderTestEmailWorkflow = createWorkflow(
  sendProviderTestEmailWorkflowId,
  function (input: SendProviderTestEmailInput) {
    const provider = assertEmailProviderReadyStep({});

    const email = transform({ input, provider }, ({ input, provider }) => ({
      to: input.to,
      template: PROVIDER_TEST_TEMPLATE,
      trigger_type: PROVIDER_TEST_TRIGGER,
      content: buildProviderTestEmail(provider.transport_label),
    }));
    const sent = sendTestEmailStep(email);

    const result = transform({ sent, provider }, ({ sent, provider }) => ({
      notification_id: sent.notification_id,
      external_id: sent.external_id,
      transport_id: provider.transport_id,
    }));

    return new WorkflowResponse(result);
  },
);

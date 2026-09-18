import {
  createWorkflow,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';

import {
  sendTransportTestEmailStep,
  type SendTransportTestEmailStepInput,
} from './steps/send-transport-test-email';

export type SendProviderTestEmailInput = SendTransportTestEmailStepInput;

export const sendProviderTestEmailWorkflowId = 'send-email-provider-test-email';

/**
 * Sends the fixed test email through a transport, defaulting to the selected
 * one. Naming another lets an admin verify a configured transport before
 * switching to it.
 */
export const sendProviderTestEmailWorkflow = createWorkflow(
  sendProviderTestEmailWorkflowId,
  function (input: SendProviderTestEmailInput) {
    const result = sendTransportTestEmailStep(input);

    return new WorkflowResponse(result);
  },
);

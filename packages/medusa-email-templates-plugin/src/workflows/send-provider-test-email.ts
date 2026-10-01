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

export const sendProviderTestEmailWorkflow = createWorkflow(
  sendProviderTestEmailWorkflowId,
  function (input: SendProviderTestEmailInput) {
    const result = sendTransportTestEmailStep(input);

    return new WorkflowResponse(result);
  },
);

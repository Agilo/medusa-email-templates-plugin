import {
  createWorkflow,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';

import {
  resetEmailTemplateStep,
  type ResetEmailTemplateStepInput,
} from './steps/reset-email-template';

export type ResetEmailTemplateInput = ResetEmailTemplateStepInput;

export const resetEmailTemplateWorkflowId = 'reset-email-template';

/**
 * Puts an event back on its built-in template, without changing whether it
 * sends.
 */
export const resetEmailTemplateWorkflow = createWorkflow(
  resetEmailTemplateWorkflowId,
  function (input: ResetEmailTemplateInput) {
    const result = resetEmailTemplateStep(input);

    return new WorkflowResponse(result);
  },
);

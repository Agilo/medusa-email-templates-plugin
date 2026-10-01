import {
  createWorkflow,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';

import {
  upsertEmailTemplateStep,
  type UpsertEmailTemplateInput,
} from './steps/upsert-email-template';

export const upsertEmailTemplateWorkflowId = 'upsert-email-template';

export const upsertEmailTemplateWorkflow = createWorkflow(
  upsertEmailTemplateWorkflowId,
  function (input: UpsertEmailTemplateInput) {
    const template = upsertEmailTemplateStep(input);

    return new WorkflowResponse(template);
  },
);

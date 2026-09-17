import {
  createWorkflow,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';

import {
  renderEmailTemplateStep,
  type RenderEmailTemplateInput,
} from './steps/render-email-template';

export const previewEmailTemplateWorkflowId = 'preview-email-template';

/** Renders a template without sending anything. */
export const previewEmailTemplateWorkflow = createWorkflow(
  previewEmailTemplateWorkflowId,
  function (input: RenderEmailTemplateInput) {
    const preview = renderEmailTemplateStep(input);

    return new WorkflowResponse(preview);
  },
);

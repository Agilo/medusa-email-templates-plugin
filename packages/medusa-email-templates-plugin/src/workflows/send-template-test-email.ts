import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';

import { assertEmailProviderReadyStep } from './steps/assert-email-provider-ready';
import {
  renderEmailTemplateStep,
  type RenderEmailTemplateInput,
} from './steps/render-email-template';
import { sendTestEmailStep } from './steps/send-test-email';

export type SendTemplateTestEmailInput = RenderEmailTemplateInput & {
  to: string;
};

export const sendTemplateTestEmailWorkflowId = 'send-email-template-test-email';

export const sendTemplateTestEmailWorkflow = createWorkflow(
  sendTemplateTestEmailWorkflowId,
  function (input: SendTemplateTestEmailInput) {
    const provider = assertEmailProviderReadyStep({});
    const rendered = renderEmailTemplateStep(input);

    const email = transform({ input, rendered }, ({ input, rendered }) => ({
      to: input.to,
      template: input.template_key,
      trigger_type: `email-templates.test.${input.template_key}`,
      content: {
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      },
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

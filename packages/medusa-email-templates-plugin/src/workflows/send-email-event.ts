import {
  createWorkflow,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';

import {
  resolveEmailEventStep,
  type ResolveEmailEventInput,
} from './steps/resolve-email-event';
import { sendEmailEventNotificationStep } from './steps/send-email-event-notification';

export const sendEmailEventWorkflowId = 'send-email-event';

/**
 * Sends the managed email for a Medusa event. Skips silently when no
 * definition matches, the template is disabled, or there is no recipient.
 */
export const sendEmailEventWorkflow = createWorkflow(
  sendEmailEventWorkflowId,
  function (input: ResolveEmailEventInput) {
    const resolved = resolveEmailEventStep(input);
    const result = sendEmailEventNotificationStep(resolved);

    return new WorkflowResponse(result);
  },
);

/**
 * Public API for host applications.
 *
 * Register custom email events and transports from a subscriber file, which
 * Medusa loads at startup:
 *
 * ```ts
 * // src/subscribers/email-review-approved.ts
 * import { defineEmailEvent } from 'medusa-email-templates-plugin/registry';
 *
 * const reviewApproved = defineEmailEvent({ ... });
 *
 * export default reviewApproved.handler;
 * export const config = reviewApproved.subscriberConfig;
 * ```
 */
export {
  defineEmailEvent,
  getEmailEventDefinitionByTemplateKey,
  getEmailEventDefinitionForPayload,
  listEmailEventDefinitions,
  registerEmailEvent,
} from './lib/events';
export type {
  EmailEventDefaultTemplate,
  EmailEventDefinition,
  EmailTemplateVariable,
} from './lib/events';
// For a default template that repeats over a `list` variable, in the shape
// the editor reads back as a Repeat block.
export { repeat } from './lib/events/built-in/default-templates/repeat';
export { registerEmailTransport } from './lib/transports/registry';
export type {
  CloudEmailConfig,
  CredentialSource,
  EmailTransport,
  EmailTransportContext,
  EmailTransportResult,
  RenderedEmail,
} from './lib/transports/types';
export { sendEmailEventWorkflow } from './workflows/send-email-event';

/**
 * Public API for host applications.
 *
 * Register custom email events and transports from a subscriber file, which
 * Medusa loads at startup:
 *
 * ```ts
 * // src/subscribers/email-review-approved.ts
 * import {
 *   defineEmailEvent,
 *   sendEmailEventWorkflow,
 * } from 'medusa-email-templates-plugin/registry';
 *
 * defineEmailEvent({ event: 'review.approved', templateKey: 'review-approved', ... });
 *
 * export default async function handler({ event, container }) {
 *   await sendEmailEventWorkflow(container).run({
 *     input: { event: event.name, data: event.data },
 *   });
 * }
 *
 * export const config = { event: 'review.approved' };
 * ```
 *
 * `defineEmailEvent` only registers the definition and returns it; the
 * subscriber itself is the host's, as above. The README has a complete
 * example.
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
  EmailTemplateSnippet,
  EmailTemplateVariable,
} from './lib/events';
// For side-by-side cells in a default template or snippet, which the editor
// opens as a Columns layout it can reshape.
export { columns } from './lib/events/built-in/default-templates/design';
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

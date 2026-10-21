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
 * } from '@agilo/medusa-email-templates-plugin/registry';
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
 * `defineEmailEvent` only registers the definition; the subscriber is the
 * host's own, as above. See the README for a complete example.
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
// Side-by-side cells for default templates and snippets; opens as an editable
// Columns layout.
export { columns } from './lib/events/built-in/default-templates/design';
// Repeats default-template HTML over a `list` variable; opens as a Repeat
// block.
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

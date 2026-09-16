// Importing this module registers the built-in email events. Entry points
// (provider, subscribers, API routes) import from here, never from
// ./registry directly, so the built-ins are always present.
import './built-in/order-placed';

export { defineEmailEvent } from './define-email-event';
export {
  getEmailEventDefinitionByTemplateKey,
  getEmailEventDefinitionForPayload,
  listEmailEventDefinitions,
  registerEmailEvent,
} from './registry';
export type {
  EmailEventDefaultTemplate,
  EmailEventDefinition,
  EmailTemplateVariable,
} from './types';

// Importing this module registers the built-in email events. Entry points
// (provider, subscribers, API routes) import from here, never from
// ./registry directly, so the built-ins are always present.
import './built-in/order-placed';
import './built-in/invite';
import './built-in/password-reset';
import './built-in/email-verification';

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
  EmailTemplateSnippet,
  EmailTemplateVariable,
} from './types';
export {
  DEFAULT_STOREFRONT_RESET_PATH,
  StorefrontUrlNotConfiguredError,
} from './urls';

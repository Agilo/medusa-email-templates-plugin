import type { MedusaContainer } from '@medusajs/framework/types';

import { defineEmailEvent } from '../define-email-event';
import type { EmailTemplateVariable } from '../types';
import {
  buildQuery,
  getAdminUrl,
  getStorefrontResetPasswordPath,
  getStorefrontUrl,
} from '../urls';
import {
  passwordResetCustomerDefaultTemplate,
  passwordResetUserDefaultTemplate,
} from './default-templates/account';
import { retrieveStoreName } from './store';

/**
 * Medusa emits one `auth.password_reset` event for every actor, so the two
 * definitions below are told apart by `actor_type`.
 */
export type PasswordResetEventData = {
  entity_id: string;
  actor_type: string;
  token: string;
  metadata?: Record<string, unknown>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// `entity_id` is whatever identifies the actor; for the emailpass provider
// that is the email address.
const recipientFromEntityId = async (
  data: PasswordResetEventData,
): Promise<string | null> =>
  EMAIL_PATTERN.test(data.entity_id) ? data.entity_id : null;

const variables = (resetLabel: string): EmailTemplateVariable[] => [
  {
    key: 'email',
    label: 'Email',
    example: 'jane@example.com',
    group: 'Account',
  },
  {
    key: 'reset_url',
    label: 'Reset link',
    description: resetLabel,
    example:
      'https://example.com/reset-password?token=abc&email=jane%40example.com',
    type: 'url',
    group: 'Account',
  },
  {
    key: 'store.name',
    label: 'Store name',
    example: 'Medusa Store',
    group: 'Store',
  },
];

export const passwordResetUserEmailEvent =
  defineEmailEvent<PasswordResetEventData>({
    event: 'auth.password_reset',
    templateKey: 'password-reset-user',
    label: 'Password reset (admin user)',
    description: 'Sent when an admin user requests a password reset.',
    defaultTemplate: passwordResetUserDefaultTemplate,
    matches: (data) => data.actor_type === 'user',
    getRecipient: recipientFromEntityId,

    async getContext(data, container: MedusaContainer) {
      const query = buildQuery({ token: data.token, email: data.entity_id });

      return {
        email: data.entity_id,
        actor_type: data.actor_type,
        reset_url: `${getAdminUrl(container)}/reset-password?${query}`,
        store: { name: await retrieveStoreName(container) },
      };
    },

    variables: variables('Link to Medusa Admin that sets a new password.'),
  });

export const passwordResetCustomerEmailEvent =
  defineEmailEvent<PasswordResetEventData>({
    event: 'auth.password_reset',
    templateKey: 'password-reset-customer',
    label: 'Password reset (customer)',
    description:
      'Sent when a customer requests a password reset. Needs storefront_url in the plugin options.',
    defaultTemplate: passwordResetCustomerDefaultTemplate,
    matches: (data) => data.actor_type === 'customer',
    getRecipient: recipientFromEntityId,

    async getContext(data, container: MedusaContainer) {
      // Throws when storefront_url is missing, which the workflow reports as
      // a skipped send rather than emailing a broken link.
      const storefrontUrl = getStorefrontUrl(container);
      const path = getStorefrontResetPasswordPath(container);
      const query = buildQuery({ token: data.token, email: data.entity_id });

      return {
        email: data.entity_id,
        actor_type: data.actor_type,
        reset_url: `${storefrontUrl}${path}?${query}`,
        store: { name: await retrieveStoreName(container) },
      };
    },

    variables: variables('Link to your storefront that sets a new password.'),

    getWarnings: (container) => {
      try {
        getStorefrontUrl(container);
        return [];
      } catch {
        return ['storefront_url_not_configured'];
      }
    },
  });

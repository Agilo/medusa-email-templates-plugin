import { defineEmailEvent } from '../define-email-event';
import { emailVerificationDefaultTemplate } from './default-templates/account';
import { retrieveStoreName } from './store';

/**
 * Payload of `auth.verification_requested`, as emitted since Medusa 2.17.
 */
export type EmailVerificationEventData = {
  entity_id: string;
  entity_type: string;
  code_provider?: string;
  auth_identity_id?: string;
  code: string;
  expires_at?: string | Date;
  metadata?: Record<string, unknown>;
};

export const emailVerificationEmailEvent =
  defineEmailEvent<EmailVerificationEventData>({
    event: 'auth.verification_requested',
    templateKey: 'email-verification',
    label: 'Email verification',
    description: 'Sends the verification code for an email address.',
    defaultTemplate: emailVerificationDefaultTemplate,
    // Other entity types (a phone number, for example) are not emails.
    matches: (data) => data.entity_type === 'email',

    async getRecipient(data) {
      return data.entity_id || null;
    },

    async getContext(data, container) {
      return {
        email: data.entity_id,
        code: data.code,
        expires_at: data.expires_at ?? null,
        store: { name: await retrieveStoreName(container) },
      };
    },

    variables: [
      {
        key: 'email',
        label: 'Email',
        example: 'jane@example.com',
        group: 'Account',
      },
      {
        key: 'code',
        label: 'Verification code',
        example: '482913',
        group: 'Account',
      },
      {
        key: 'expires_at',
        label: 'Expires at',
        example: '2026-10-01T10:00:00.000Z',
        type: 'date',
        group: 'Account',
      },
      {
        key: 'store.name',
        label: 'Store name',
        example: 'Medusa Store',
        group: 'Store',
      },
    ],
  });

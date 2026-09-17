import type { MedusaContainer } from '@medusajs/framework/types';
import { describe, expect, it, vi } from 'vitest';

import { emailVerificationEmailEvent } from '../built-in/email-verification';
import {
  inviteCreatedEmailEvent,
  inviteResentEmailEvent,
} from '../built-in/invite';
import {
  passwordResetCustomerEmailEvent,
  passwordResetUserEmailEvent,
} from '../built-in/password-reset';
import { StorefrontUrlNotConfiguredError } from '../urls';

const invite = {
  id: 'invite_1',
  email: 'teammate@example.com',
  token: 'invite-token',
  accepted: false,
  expires_at: '2026-10-01T10:00:00.000Z',
};

type Options = {
  admin_url?: string;
  storefront_url?: string;
  storefront_reset_password_path?: string;
};

const containerWith = ({
  invites = [invite as Record<string, unknown>],
  options = {} as Options,
  backendUrl = 'http://localhost:9000',
}: {
  invites?: Record<string, unknown>[];
  options?: Options;
  backendUrl?: string;
} = {}) => {
  const graph = vi.fn(async ({ entity }: { entity: string }) =>
    entity === 'store' ? { data: [{ name: 'Test Store' }] } : { data: invites },
  );

  return {
    resolve: (key: string) => {
      if (key === 'query') {
        return { graph };
      }

      if (key === 'configModule') {
        return { admin: { backendUrl, path: '/app' } };
      }

      return { getOptions: () => options };
    },
  } as unknown as MedusaContainer;
};

describe('invite emails', () => {
  it.each([
    ['invite-created', inviteCreatedEmailEvent, 'invite.created'],
    ['invite-resent', inviteResentEmailEvent, 'invite.resent'],
  ])('%s listens to its own event', (templateKey, definition, event) => {
    expect(definition.templateKey).toBe(templateKey);
    expect(definition.event).toBe(event);
  });

  it('builds the admin accept link', async () => {
    const context = (await inviteCreatedEmailEvent.getContext(
      { id: 'invite_1' },
      containerWith(),
    )) as { invite_url: string; invite: { email: string } };

    expect(context.invite_url).toBe(
      'http://localhost:9000/app/invite?token=invite-token',
    );
    expect(context.invite.email).toBe('teammate@example.com');
  });

  it('uses the configured admin url when given', async () => {
    const context = (await inviteCreatedEmailEvent.getContext(
      { id: 'invite_1' },
      containerWith({
        options: { admin_url: 'https://admin.example.com/app/' },
      }),
    )) as { invite_url: string };

    expect(context.invite_url).toBe(
      'https://admin.example.com/app/invite?token=invite-token',
    );
  });

  it.each([
    ['the invite was already accepted', [{ ...invite, accepted: true }]],
    ['the invite no longer exists', []],
  ])('skips when %s', async (_name, invites) => {
    await expect(
      inviteCreatedEmailEvent.getRecipient(
        { id: 'invite_1' },
        containerWith({ invites }),
      ),
    ).resolves.toBeNull();
  });
});

describe('password reset emails', () => {
  const userData = {
    entity_id: 'admin@example.com',
    actor_type: 'user',
    token: 'reset-token',
  };
  const customerData = { ...userData, actor_type: 'customer' };

  it('routes each actor type to its own template', () => {
    expect(passwordResetUserEmailEvent.matches?.(userData)).toBe(true);
    expect(passwordResetUserEmailEvent.matches?.(customerData)).toBe(false);
    expect(passwordResetCustomerEmailEvent.matches?.(customerData)).toBe(true);
    expect(passwordResetCustomerEmailEvent.matches?.(userData)).toBe(false);
  });

  it('builds the admin reset link for users', async () => {
    const context = (await passwordResetUserEmailEvent.getContext(
      userData,
      containerWith(),
    )) as { reset_url: string };

    expect(context.reset_url).toBe(
      'http://localhost:9000/app/reset-password?token=reset-token&email=admin%40example.com',
    );
  });

  it('builds the storefront reset link for customers', async () => {
    const context = (await passwordResetCustomerEmailEvent.getContext(
      customerData,
      containerWith({
        options: { storefront_url: 'https://shop.example.com' },
      }),
    )) as { reset_url: string };

    expect(context.reset_url).toBe(
      'https://shop.example.com/reset-password?token=reset-token&email=admin%40example.com',
    );
  });

  it('honours a custom storefront path', async () => {
    const context = (await passwordResetCustomerEmailEvent.getContext(
      customerData,
      containerWith({
        options: {
          storefront_url: 'https://shop.example.com',
          storefront_reset_password_path: 'account/new-password',
        },
      }),
    )) as { reset_url: string };

    expect(context.reset_url).toContain(
      'https://shop.example.com/account/new-password?',
    );
  });

  it('reports a missing storefront url instead of guessing', async () => {
    await expect(
      passwordResetCustomerEmailEvent.getContext(customerData, containerWith()),
    ).rejects.toBeInstanceOf(StorefrontUrlNotConfiguredError);
  });

  it('skips identifiers that are not email addresses', async () => {
    await expect(
      passwordResetUserEmailEvent.getRecipient(
        { ...userData, entity_id: 'user_01ABC' },
        containerWith(),
      ),
    ).resolves.toBeNull();
  });
});

describe('email verification', () => {
  const data = {
    entity_id: 'jane@example.com',
    entity_type: 'email',
    code: '482913',
    expires_at: '2026-10-01T10:00:00.000Z',
  };

  it('only handles email verifications', () => {
    expect(emailVerificationEmailEvent.matches?.(data)).toBe(true);
    expect(
      emailVerificationEmailEvent.matches?.({ ...data, entity_type: 'phone' }),
    ).toBe(false);
  });

  it('passes the code through to the template', async () => {
    const context = await emailVerificationEmailEvent.getContext(
      data,
      containerWith(),
    );

    expect(context).toMatchObject({
      email: 'jane@example.com',
      code: '482913',
      store: { name: 'Test Store' },
    });
  });
});

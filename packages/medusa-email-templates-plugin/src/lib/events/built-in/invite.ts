import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { defineEmailEvent } from '../define-email-event';
import type { EmailTemplateVariable } from '../types';
import { buildQuery, getAdminUrl } from '../urls';
import {
  inviteCreatedDefaultTemplate,
  inviteResentDefaultTemplate,
} from './default-templates/account';
import { retrieveStoreName } from './store';

export type InviteEventData = { id: string };

type InviteRecord = {
  id: string;
  email?: string | null;
  token?: string | null;
  accepted?: boolean;
  expires_at?: string | Date | null;
};

const retrieveInvite = async (
  id: string,
  container: MedusaContainer,
): Promise<InviteRecord | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: 'invite',
    fields: ['id', 'email', 'token', 'accepted', 'expires_at'],
    filters: { id },
  });

  return (data[0] as InviteRecord | undefined) ?? null;
};

const inviteVariables: EmailTemplateVariable[] = [
  {
    key: 'invite.email',
    label: 'Invited email',
    example: 'teammate@example.com',
    group: 'Invite',
  },
  {
    key: 'invite.expires_at',
    label: 'Expires at',
    example: '2026-10-01T10:00:00.000Z',
    type: 'date',
    group: 'Invite',
  },
  {
    key: 'invite_url',
    label: 'Accept link',
    description: 'Link to Medusa Admin that accepts the invitation.',
    example: 'https://admin.example.com/app/invite?token=abc',
    group: 'Invite',
  },
  {
    key: 'store.name',
    label: 'Store name',
    example: 'Medusa Store',
    group: 'Store',
  },
];

const buildInviteContext = async (
  data: InviteEventData,
  container: MedusaContainer,
): Promise<Record<string, unknown>> => {
  const invite = await retrieveInvite(data.id, container);

  if (!invite) {
    throw new Error(`Invite "${data.id}" was not found.`);
  }

  const query = buildQuery({ token: invite.token ?? undefined });

  return {
    invite: {
      email: invite.email,
      expires_at: invite.expires_at,
    },
    invite_url: `${getAdminUrl(container)}/invite?${query}`,
    store: { name: await retrieveStoreName(container) },
  };
};

/** Invites that have already been accepted are not emailed again. */
const inviteRecipient = async (
  data: InviteEventData,
  container: MedusaContainer,
): Promise<string | null> => {
  const invite = await retrieveInvite(data.id, container);

  if (!invite || invite.accepted) {
    return null;
  }

  return invite.email ?? null;
};

export const inviteCreatedEmailEvent = defineEmailEvent<InviteEventData>({
  event: 'invite.created',
  templateKey: 'invite-created',
  label: 'Admin invite',
  description: 'Sent when a user is invited to the Medusa Admin.',
  defaultTemplate: inviteCreatedDefaultTemplate,
  getResource: (data) => ({ resource_id: data.id, resource_type: 'invite' }),
  getRecipient: inviteRecipient,
  getContext: buildInviteContext,
  variables: inviteVariables,
});

export const inviteResentEmailEvent = defineEmailEvent<InviteEventData>({
  event: 'invite.resent',
  templateKey: 'invite-resent',
  label: 'Admin invite resent',
  description: 'Sent when an invitation is renewed and sent again.',
  defaultTemplate: inviteResentDefaultTemplate,
  getResource: (data) => ({ resource_id: data.id, resource_type: 'invite' }),
  getRecipient: inviteRecipient,
  getContext: buildInviteContext,
  variables: inviteVariables,
});

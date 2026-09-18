import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../lib/sdk';
import type {
  EmailProviderState,
  ProviderTestResult,
  SaveEmailProviderPayload,
} from '../lib/types';

export const emailProviderQueryKey = ['email', 'provider'] as const;

/**
 * The saved transports and which one sends. Loads on mount — never gate this
 * on drawer or modal state, or the page renders empty after a refresh.
 */
export const useEmailProvider = () =>
  useQuery({
    queryKey: emailProviderQueryKey,
    queryFn: () =>
      sdk.client.fetch<{ provider: EmailProviderState }>(
        '/admin/email/provider',
      ),
    select: (data) => data.provider,
  });

/**
 * Saves one transport's configuration and credential. Passing the transport
 * that is already selected updates it in place; passing another one also
 * makes it active, which is why the drawer's button reads "Save & activate".
 */
export const useSaveEmailProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveEmailProviderPayload) =>
      sdk.client.fetch<{ provider: EmailProviderState }>(
        '/admin/email/provider',
        { method: 'POST', body: payload },
      ),
    onSuccess: (data) => {
      // The route returns the new state, so seed the cache and refetch.
      queryClient.setQueryData(emailProviderQueryKey, data);
      queryClient.invalidateQueries({ queryKey: emailProviderQueryKey });
    },
  });
};

/**
 * Sends a fixed test email through a transport, defaulting to the selected
 * one. Pass `transport_id` to verify a configured transport before switching
 * to it.
 *
 * Rejects with `email_provider_not_ready` (409) when that transport cannot
 * send, or `email_transport_failed` (502) when the provider refuses it.
 */
export const useSendProviderTestEmail = () =>
  useMutation({
    mutationFn: (variables: { to: string; transport_id?: string }) =>
      sdk.client.fetch<{ result: ProviderTestResult }>(
        '/admin/email/provider/send-test',
        { method: 'POST', body: variables },
      ),
  });

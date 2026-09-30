import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../lib/sdk';
import type {
  EmailProviderState,
  ProviderTestResult,
  SaveEmailProviderPayload,
} from '../lib/types';

export const emailProviderQueryKey = ['email', 'provider'] as const;

/**
 * The saved transports and which one sends. Loads on mount; don't gate it on
 * drawer state, or the page renders empty after a refresh.
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
 * Saves a transport's configuration and credential. Saving a different
 * transport also makes it active (hence "Save & activate").
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
 * Sends a fixed test email through a transport (default: the selected one;
 * pass `transport_id` to test before switching).
 *
 * Rejects with `email_provider_not_ready` (409) if it can't send, or
 * `email_transport_failed` (502) if the provider refuses.
 */
export const useSendProviderTestEmail = () =>
  useMutation({
    mutationFn: (variables: { to: string; transport_id?: string }) =>
      sdk.client.fetch<{ result: ProviderTestResult }>(
        '/admin/email/provider/send-test',
        { method: 'POST', body: variables },
      ),
  });

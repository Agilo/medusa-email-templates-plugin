import { TooltipProvider } from '@medusajs/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Builds a fresh QueryClient + provider wrapper for testing hooks/components
 * that use react-query. Retries are disabled so error cases resolve promptly.
 *
 * TooltipProvider mirrors the dashboard's own root: Medusa UI components such
 * as DataTable render tooltips internally and throw without it.
 */
export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    ),
  };
}

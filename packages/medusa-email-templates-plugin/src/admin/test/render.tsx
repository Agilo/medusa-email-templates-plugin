import { TooltipProvider } from '@medusajs/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * A fresh QueryClient + provider wrapper for react-query tests, with retries
 * off so errors resolve promptly. Includes TooltipProvider, as the dashboard
 * root does, since components like DataTable throw without it.
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

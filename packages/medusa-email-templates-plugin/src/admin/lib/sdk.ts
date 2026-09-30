import Medusa from '@medusajs/js-sdk';

/**
 * Shared SDK for all admin requests. Use it instead of `fetch`: it attaches
 * the session cookie and auth headers.
 */
export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_BACKEND_URL || '/',
  debug: import.meta.env.DEV,
  auth: {
    type: 'session',
  },
});

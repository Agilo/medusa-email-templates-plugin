import Medusa from '@medusajs/js-sdk';

/**
 * Shared SDK instance for every admin request.
 *
 * Always call through this rather than `fetch`: admin routes need the session
 * cookie and auth headers, which the SDK attaches for us.
 */
export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_BACKEND_URL || '/',
  debug: import.meta.env.DEV,
  auth: {
    type: 'session',
  },
});

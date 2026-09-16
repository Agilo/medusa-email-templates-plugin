import { MedusaError } from '@medusajs/framework/utils';

/**
 * Error codes the admin email routes translate into HTTP statuses that
 * Medusa's error handler can't express: 409 with the real message (Medusa
 * replaces CONFLICT messages) and 502 for transport failures.
 */
export const EmailErrorCodes = {
  PROVIDER_NOT_READY: 'email_provider_not_ready',
  TRANSPORT_FAILED: 'email_transport_failed',
} as const;

export const invalidDataError = (message: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, message);

export const providerNotReadyError = (message: string) =>
  new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    message,
    EmailErrorCodes.PROVIDER_NOT_READY,
  );

export const transportFailedError = (message: string) =>
  new MedusaError(
    MedusaError.Types.UNEXPECTED_STATE,
    message,
    EmailErrorCodes.TRANSPORT_FAILED,
  );

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return String(error);
};

export const formatIssues = (
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): string =>
  issues
    .map((issue) => {
      const path = issue.path.map(String).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');

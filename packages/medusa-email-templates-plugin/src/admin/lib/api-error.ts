/**
 * The email routes answer 409 when no transport can send and 502 when one
 * fails, both carrying a `code`. Components use these to show the right
 * message instead of a generic failure.
 */
export const EMAIL_ERROR_CODES = {
  providerNotReady: 'email_provider_not_ready',
  transportFailed: 'email_transport_failed',
} as const;

type ErrorBody = {
  code?: unknown;
  message?: unknown;
};

const readBody = (error: unknown): ErrorBody => {
  if (!error || typeof error !== 'object') {
    return {};
  }

  // The SDK exposes the parsed response body, shape depending on version.
  const candidate = error as {
    response?: { data?: ErrorBody };
    body?: ErrorBody;
  } & ErrorBody;

  return candidate.response?.data ?? candidate.body ?? candidate;
};

export const getApiErrorCode = (error: unknown): string | undefined => {
  const { code } = readBody(error);

  return typeof code === 'string' ? code : undefined;
};

export const getApiErrorMessage = (
  error: unknown,
  fallback = 'Something went wrong.',
): string => {
  const { message } = readBody(error);

  if (typeof message === 'string' && message.length) {
    return message;
  }

  return error instanceof Error && error.message ? error.message : fallback;
};

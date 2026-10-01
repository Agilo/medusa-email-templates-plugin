import type { MedusaResponse } from '@medusajs/framework/http';

import { EmailErrorCodes, getErrorMessage } from '../../../lib/errors';

export const sendEmailErrorResponse = (
  res: MedusaResponse,
  error: unknown,
): boolean => {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? error.code
      : undefined;

  if (code === EmailErrorCodes.PROVIDER_NOT_READY) {
    res
      .status(409)
      .json({ type: 'not_allowed', code, message: getErrorMessage(error) });
    return true;
  }

  if (code === EmailErrorCodes.TRANSPORT_FAILED) {
    res.status(502).json({
      type: 'unexpected_state',
      code,
      message: getErrorMessage(error),
    });
    return true;
  }

  return false;
};

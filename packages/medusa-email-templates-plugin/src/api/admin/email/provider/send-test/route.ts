import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { sendProviderTestEmailWorkflow } from '../../../../../workflows/send-provider-test-email';
import { sendEmailErrorResponse } from '../../error-response';
import type { PostEmailProviderTestBody } from '../validators';

export const POST = async (
  req: AuthenticatedMedusaRequest<PostEmailProviderTestBody>,
  res: MedusaResponse,
) => {
  try {
    const { result } = await sendProviderTestEmailWorkflow(req.scope).run({
      input: {
        to: req.validatedBody.to,
        transport_id: req.validatedBody.transport_id,
      },
    });

    res.json({ result });
  } catch (error) {
    if (!sendEmailErrorResponse(res, error)) {
      throw error;
    }
  }
};

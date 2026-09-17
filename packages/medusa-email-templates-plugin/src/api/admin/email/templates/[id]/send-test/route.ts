import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { sendTemplateTestEmailWorkflow } from '../../../../../../workflows/send-template-test-email';
import { sendEmailErrorResponse } from '../../../error-response';
import type { PostEmailTemplateTestBody } from '../../validators';

export const POST = async (
  req: AuthenticatedMedusaRequest<PostEmailTemplateTestBody>,
  res: MedusaResponse,
) => {
  try {
    const { result } = await sendTemplateTestEmailWorkflow(req.scope).run({
      input: {
        template_key: req.params.id,
        to: req.validatedBody.to,
        data: req.validatedBody.data,
        draft: req.validatedBody.draft,
      },
    });

    res.json({ result });
  } catch (error) {
    if (!sendEmailErrorResponse(res, error)) {
      throw error;
    }
  }
};

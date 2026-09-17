import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { previewEmailTemplateWorkflow } from '../../../../../../workflows/preview-email-template';
import type { PostEmailTemplatePreviewBody } from '../../validators';

export const POST = async (
  req: AuthenticatedMedusaRequest<PostEmailTemplatePreviewBody>,
  res: MedusaResponse,
) => {
  const { result } = await previewEmailTemplateWorkflow(req.scope).run({
    input: {
      template_key: req.params.id,
      data: req.validatedBody?.data,
      draft: req.validatedBody?.draft,
    },
  });

  res.json({ preview: result });
};

import {
  validateAndTransformBody,
  type MiddlewareRoute,
} from '@medusajs/framework/http';

import {
  PostEmailProviderSchema,
  PostEmailProviderTestSchema,
} from './provider/validators';
import {
  PostEmailTemplatePreviewSchema,
  PostEmailTemplateSchema,
  PostEmailTemplateTestSchema,
} from './templates/validators';

export const adminEmailMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/email/provider',
    methods: ['POST'],
    middlewares: [validateAndTransformBody(PostEmailProviderSchema)],
  },
  {
    matcher: '/admin/email/provider/send-test',
    methods: ['POST'],
    middlewares: [validateAndTransformBody(PostEmailProviderTestSchema)],
  },
  {
    matcher: '/admin/email/templates/:id',
    methods: ['POST'],
    middlewares: [validateAndTransformBody(PostEmailTemplateSchema)],
  },
  {
    matcher: '/admin/email/templates/:id/preview',
    methods: ['POST'],
    middlewares: [validateAndTransformBody(PostEmailTemplatePreviewSchema)],
  },
  {
    matcher: '/admin/email/templates/:id/send-test',
    methods: ['POST'],
    middlewares: [validateAndTransformBody(PostEmailTemplateTestSchema)],
  },
];

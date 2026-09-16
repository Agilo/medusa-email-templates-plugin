import {
  validateAndTransformBody,
  type MiddlewareRoute,
} from '@medusajs/framework/http';

import {
  PostEmailProviderSchema,
  PostEmailProviderTestSchema,
} from './provider/validators';

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
];

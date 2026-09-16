import { defineMiddlewares } from '@medusajs/framework/http';

import { adminEmailMiddlewares } from './admin/email/middlewares';

export default defineMiddlewares({
  routes: [...adminEmailMiddlewares],
});

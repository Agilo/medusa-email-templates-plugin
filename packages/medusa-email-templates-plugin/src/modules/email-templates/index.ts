import { Module } from '@medusajs/framework/utils';

import EmailTemplatesModuleService from './service';

export const EMAIL_TEMPLATES_MODULE = 'emailTemplates';

export default Module(EMAIL_TEMPLATES_MODULE, {
  service: EmailTemplatesModuleService,
});

import { ModuleProvider, Modules } from '@medusajs/framework/utils';

import EmailTemplatesProviderService from './service';

export default ModuleProvider(Modules.NOTIFICATION, {
  services: [EmailTemplatesProviderService],
});

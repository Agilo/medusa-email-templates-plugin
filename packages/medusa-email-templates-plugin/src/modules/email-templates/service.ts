import { MedusaService } from '@medusajs/framework/utils';

import EmailProviderConfiguration from './models/email-provider-configuration';
import EmailProviderCredential from './models/email-provider-credential';
import EmailTemplate from './models/email-template';

export default class EmailTemplatesModuleService extends MedusaService({
  EmailProviderConfiguration,
  EmailProviderCredential,
  EmailTemplate,
}) {}

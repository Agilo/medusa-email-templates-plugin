import { MedusaService } from '@medusajs/framework/utils';

import EmailProviderConfiguration from './models/email-provider-configuration';
import EmailProviderCredential from './models/email-provider-credential';
import EmailTemplate from './models/email-template';

/**
 * Options passed to the plugin in `medusa-config.ts`. Medusa forwards a
 * plugin's options to every module it contains.
 */
export type EmailTemplatesModuleOptions = {
  /** Base URL of the Medusa application, for admin links. */
  admin_url?: string;
  /** Base URL of the storefront, for customer links. */
  storefront_url?: string;
  /** Storefront path that handles password resets. */
  storefront_reset_password_path?: string;
  /** Storefront path that shows an order, with the order id appended. */
  storefront_order_path?: string;
};

export default class EmailTemplatesModuleService extends MedusaService({
  EmailProviderConfiguration,
  EmailProviderCredential,
  EmailTemplate,
}) {
  protected options_: EmailTemplatesModuleOptions;

  constructor(
    container: Record<string, unknown>,
    options?: EmailTemplatesModuleOptions,
  ) {
    super(...arguments);
    this.options_ = options ?? {};
  }

  getOptions(): EmailTemplatesModuleOptions {
    return this.options_;
  }
}

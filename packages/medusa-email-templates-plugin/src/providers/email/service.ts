import type {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from '@medusajs/framework/types';
import { AbstractNotificationProviderService } from '@medusajs/framework/utils';

import { resolveFromAppContainer } from '../../lib/container';
import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';

export default class EmailTemplatesProviderService extends AbstractNotificationProviderService {
  static identifier = 'email-templates';

  async send(
    notification: ProviderSendNotificationDTO,
  ): Promise<ProviderSendNotificationResultsDTO> {
    // Phase 0 spike: proves the plugin module is reachable from the provider
    // at send time (PLAN.md risk R1). Phase 1 replaces this with the real
    // pass-through send flow.
    const service = resolveFromAppContainer<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );

    return { id: `spike:${service.ping()}:${notification.to}` };
  }
}

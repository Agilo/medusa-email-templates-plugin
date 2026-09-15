import { container } from '@medusajs/framework';
import { MedusaError } from '@medusajs/framework/utils';

/**
 * Resolves a registration from the global Medusa application container.
 *
 * Notification Module providers are built with the notification module's
 * isolated container, which cannot resolve this plugin's own module. Every
 * loaded module service is also registered in the global container, so the
 * provider resolves plugin services from there lazily, at send time.
 * See PLAN.md §1.1 and risk R1.
 */
export const resolveFromAppContainer = <T>(key: string): T => {
  const resolved = container.hasRegistration(key)
    ? container.resolve<T | undefined>(key, { allowUnregistered: true })
    : undefined;

  if (!resolved) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `"${key}" is not registered in the Medusa container. Make sure medusa-email-templates-plugin is added to "plugins" in medusa-config.ts.`,
    );
  }

  return resolved;
};

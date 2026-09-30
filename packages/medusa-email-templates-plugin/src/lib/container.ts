import { container } from '@medusajs/framework';
import { MedusaError } from '@medusajs/framework/utils';

/**
 * Resolves a registration from the global Medusa container.
 *
 * Notification providers get the notification module's isolated container,
 * which can't see this plugin's module. Module services are also registered
 * globally, so the provider resolves them from there at send time.
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

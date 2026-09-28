import type { ConfigModule, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';
import type { EmailTemplatesModuleOptions } from '../../modules/email-templates/service';

export const DEFAULT_STOREFRONT_RESET_PATH = '/reset-password';

/**
 * Storefronts disagree about this one — the Next.js starter has moved it more
 * than once — so the default is the plainest thing that could be right and the
 * option exists to correct it.
 */
export const DEFAULT_STOREFRONT_ORDER_PATH = '/orders';

/** Missing storefront configuration, reported instead of a broken link. */
export class StorefrontUrlNotConfiguredError extends Error {
  constructor() {
    super(
      'No storefront_url is configured for medusa-email-templates-plugin, so customer links cannot be built.',
    );
    this.name = 'StorefrontUrlNotConfiguredError';
  }
}

const readOptions = (
  container: MedusaContainer,
): EmailTemplatesModuleOptions => {
  const service = container.resolve<EmailTemplatesModuleService>(
    EMAIL_TEMPLATES_MODULE,
  );

  return service.getOptions?.() ?? {};
};

const trimTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value.slice(0, -1) : value;

const withLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value : `/${value}`;

/**
 * Base URL of the Medusa admin. Falls back to the application's configured
 * backend URL plus the admin path, which is where the dashboard is served.
 */
export const getAdminUrl = (container: MedusaContainer): string => {
  const { admin_url: adminUrl } = readOptions(container);

  if (adminUrl) {
    return trimTrailingSlash(adminUrl);
  }

  const configModule = container.resolve<ConfigModule>(
    ContainerRegistrationKeys.CONFIG_MODULE,
  );
  const backendUrl = configModule?.admin?.backendUrl ?? 'http://localhost:9000';
  const adminPath = configModule?.admin?.path ?? '/app';

  return `${trimTrailingSlash(backendUrl)}${adminPath}`;
};

export const getStorefrontUrl = (container: MedusaContainer): string => {
  const { storefront_url: storefrontUrl } = readOptions(container);

  if (!storefrontUrl) {
    throw new StorefrontUrlNotConfiguredError();
  }

  return trimTrailingSlash(storefrontUrl);
};

export const getStorefrontResetPasswordPath = (
  container: MedusaContainer,
): string =>
  withLeadingSlash(
    readOptions(container).storefront_reset_password_path ??
      DEFAULT_STOREFRONT_RESET_PATH,
  );

export const getStorefrontOrderPath = (container: MedusaContainer): string =>
  withLeadingSlash(
    readOptions(container).storefront_order_path ??
      DEFAULT_STOREFRONT_ORDER_PATH,
  );

/**
 * A link to an order on the storefront, or null when there is no storefront to
 * link to.
 *
 * Null rather than a throw, which is what sets this apart from the password
 * reset. That email *is* its link, so `getStorefrontUrl` throwing there skips
 * the send rather than delivering something useless. An order confirmation is
 * a complete email without one — it has been sending for as long as this plugin
 * has existed, with no storefront configured — so a missing URL must not stop
 * it. The variable simply goes unresolved, and `getWarnings` says why.
 */
export const getOrderUrl = (
  container: MedusaContainer,
  orderId: string,
): string | null => {
  try {
    return `${getStorefrontUrl(container)}${getStorefrontOrderPath(container)}/${orderId}`;
  } catch (error) {
    if (error instanceof StorefrontUrlNotConfiguredError) {
      return null;
    }

    throw error;
  }
};

export const buildQuery = (
  params: Record<string, string | undefined>,
): string => {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });

  return search.toString();
};

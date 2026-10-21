import type { ConfigModule, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';
import type { EmailTemplatesModuleOptions } from '../../modules/email-templates/service';

export const DEFAULT_STOREFRONT_RESET_PATH = '/reset-password';

/**
 * Storefronts differ here (the Next.js starter has moved it), so this is a
 * plain default that the option can override.
 */
export const DEFAULT_STOREFRONT_ORDER_PATH = '/orders';

export class StorefrontUrlNotConfiguredError extends Error {
  constructor() {
    super(
      'No storefront_url is configured for @agilo/medusa-email-templates-plugin, so customer links cannot be built.',
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
 * A link to an order on the storefront, or null without a storefront.
 *
 * Null, not a throw: unlike a password reset (which is useless without its
 * link, so it skips), an order confirmation is complete without it. The
 * variable goes unresolved and `getWarnings` explains why.
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

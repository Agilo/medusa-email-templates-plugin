import type { ConfigModule, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';
import type { EmailTemplatesModuleOptions } from '../../modules/email-templates/service';

export const DEFAULT_STOREFRONT_RESET_PATH = '/reset-password';

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

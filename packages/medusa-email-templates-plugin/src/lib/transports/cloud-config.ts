import type { ConfigModule } from '@medusajs/framework/types';

import type { CloudEmailConfig } from './types';

type CloudProjectConfig = {
  apiKey?: string;
  emailsEndpoint?: string;
  environmentHandle?: string;
  sandboxHandle?: string;
};

/**
 * Medusa injects Cloud settings into `projectConfig.cloud` from the
 * MEDUSA_CLOUD_* environment variables (see `defineConfig`). Reading them here
 * is how the Cloud transport works without storing any credential.
 */
export const readCloudEmailConfig = (
  configModule: ConfigModule | undefined | null,
): CloudEmailConfig | null => {
  const cloud = (
    configModule?.projectConfig as { cloud?: CloudProjectConfig } | undefined
  )?.cloud;

  if (!cloud) {
    return null;
  }

  return {
    apiKey: cloud.apiKey,
    emailsEndpoint: cloud.emailsEndpoint,
    environmentHandle: cloud.environmentHandle,
    sandboxHandle: cloud.sandboxHandle,
  };
};

/**
 * Mirrors the rule Medusa's own loader uses before registering its Cloud email
 * provider (`notification/dist/loaders/providers.js`).
 */
export const isCloudEmailConfigured = (
  cloud: CloudEmailConfig | null | undefined,
): boolean =>
  Boolean(
    cloud?.apiKey &&
    cloud?.emailsEndpoint &&
    (cloud.environmentHandle || cloud.sandboxHandle),
  );

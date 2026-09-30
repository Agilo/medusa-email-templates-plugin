import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

type TestSuite = Parameters<typeof medusaIntegrationTestRunner>[0]['testSuite'];

/**
 * Wraps `medusaIntegrationTestRunner` with this plugin's shared test setup.
 *
 * The runner forces SSL for any database URL without "localhost", but the
 * `postgres_test` container doesn't speak SSL, so `beforeServerStart` strips
 * it (after the runner's override, before the connection opens).
 *
 * The runner's `env` option applies after `medusa-config.ts` loads, so
 * variables it reads at load time (e.g. MEDUSA_CLOUD_*) must be set at module
 * scope in the spec.
 */
export function pluginIntegrationSuite(testSuite: TestSuite) {
  medusaIntegrationTestRunner({
    hooks: {
      beforeServerStart: async () => {
        const { configManager } = await import('@medusajs/framework/config');
        configManager.config.projectConfig.databaseDriverOptions = {};
      },
    },
    testSuite,
  });
}

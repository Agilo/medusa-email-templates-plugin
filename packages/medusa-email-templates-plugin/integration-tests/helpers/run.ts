import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

type TestSuite = Parameters<typeof medusaIntegrationTestRunner>[0]['testSuite'];

/**
 * Wraps `medusaIntegrationTestRunner` with the setup this plugin's integration
 * tests need, so specs don't repeat it.
 *
 * The test runner forces `ssl: { rejectUnauthorized: false }` for any database
 * whose URL does not literally contain "localhost" (see test-utils
 * `medusa-test-runner-utils/config.js`). Our test database is reached over the
 * `postgres_test` docker hostname and does not speak SSL, so we strip the forced
 * SSL in `beforeServerStart` — which runs after the runner's config override but
 * before the app opens its connection.
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

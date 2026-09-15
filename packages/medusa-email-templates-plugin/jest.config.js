const { loadEnv } = require('@medusajs/framework/utils');

loadEnv('test', process.cwd());

// In the devcontainer the docker-compose service environment sets DB_HOST=postgres
// (the dev database) and DB_PORT=5432. Integration tests must use the isolated
// postgres_test service. We override here — in jest.config.js — because this file
// runs in the main Jest process whose environment is inherited by workers and by
// @medusajs/test-utils/dist/database.js, which captures pgGodCredentials as
// module-level constants the first time the file is required. If we only set
// these vars in setupFiles (which run inside the worker, after module imports are
// resolved), pgGodCredentials would still see the old DB_HOST value.
if (process.env.DEVCONTAINER === 'true') {
  process.env.DB_HOST = 'postgres_test';
  process.env.DB_PORT = '5432';
  process.env.DB_USERNAME = 'postgres';
  process.env.DB_PASSWORD = 'postgres';
  process.env.REDIS_URL = 'redis://redis_test:6379';
}

module.exports = {
  transform: {
    '^.+\\.[jt]sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            decorators: true,
            syntax: 'typescript',
            tsx: true,
          },
          target: 'es2022',
        },
      },
    ],
  },
  testEnvironment: 'node',
  // HTTP integration tests start a full Medusa app (migrations + Redis + HTTP server).
  // That easily exceeds 60 s on a cold database; 300 s is the standard Medusa value.
  testTimeout: process.env.TEST_TYPE === 'integration:http' ? 300000 : 60000,
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  modulePathIgnorePatterns: ['dist/', '.medusa/', '.yalc/'],
  setupFiles: ['<rootDir>/integration-tests/setup-env.js'],
  setupFilesAfterEnv: ['<rootDir>/integration-tests/setup.js'],
  testMatch:
    process.env.TEST_TYPE === 'integration:http'
      ? ['<rootDir>/integration-tests/http/*.spec.[jt]s']
      : process.env.TEST_TYPE === 'integration:module'
        ? ['<rootDir>/integration-tests/module/*.spec.[jt]s']
        : ['<rootDir>/integration-tests/**/*.spec.[jt]s'],
};

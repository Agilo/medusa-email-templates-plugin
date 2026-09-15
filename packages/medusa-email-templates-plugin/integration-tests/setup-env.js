// setupFiles — runs before the test framework is installed, inside each worker.
// The test database/Redis credentials are resolved in jest.config.js (which runs
// in the main process before @medusajs/test-utils captures them), so this file is
// intentionally a no-op placeholder that keeps the referenced module resolvable.

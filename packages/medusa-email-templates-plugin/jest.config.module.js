// Thin wrapper that pins TEST_TYPE for module integration tests.
// Used by the VS Code Jest extension and launch configurations.
process.env.TEST_TYPE = 'integration:module';
module.exports = require('./jest.config.js');

// Thin wrapper that pins TEST_TYPE for HTTP integration tests.
// Used by the VS Code Jest extension and launch configurations.
process.env.TEST_TYPE = 'integration:http';
module.exports = require('./jest.config.js');

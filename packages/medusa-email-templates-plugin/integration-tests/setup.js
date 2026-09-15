// setupFilesAfterEnv — clear MikroORM metadata between test files so re-importing
// models across specs doesn't throw "metadata already registered" (per Medusa docs).
const { MetadataStorage } = require('@medusajs/framework/mikro-orm/core');

MetadataStorage.clear();

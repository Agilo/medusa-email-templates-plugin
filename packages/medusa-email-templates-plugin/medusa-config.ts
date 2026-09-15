import type { InputConfigWithArrayModules } from '@medusajs/types';
import { defineConfig } from '@medusajs/framework/utils';

export default defineConfig({
  modules: [],
  admin: {
    backendUrl: process.env.BACKEND_URL ?? 'http://localhost:9000',
    storefrontUrl: process.env.STOREFRONT_URL ?? 'http://localhost:8000',
    vite(config) {
      return {
        ...config,
        server: {
          ...config.server,
          hmr: false,
        },
      };
    },
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      adminCors: process.env.ADMIN_CORS ?? 'http://localhost:7001',
      authCors: process.env.AUTH_CORS ?? 'http://localhost:7001',
      cookieSecret: process.env.COOKIE_SECRET ?? 'test-cookie-secret',
      jwtSecret: process.env.JWT_SECRET ?? 'test-jwt-secret',
      storeCors: process.env.STORE_CORS ?? 'http://localhost:8000',
    },
  },
} satisfies InputConfigWithArrayModules);

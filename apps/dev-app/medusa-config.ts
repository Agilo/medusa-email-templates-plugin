import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InputConfigWithArrayModules } from '@medusajs/types';
import { loadEnv, defineConfig } from '@medusajs/framework/utils';

loadEnv(process.env.NODE_ENV || 'development', process.cwd());

const pluginAdminEntryPath = resolve(
  process.cwd(),
  'node_modules/medusa-email-templates-plugin/.medusa/server/src/admin/index.mjs',
);

const getPluginAdminVersion = () => {
  if (!existsSync(pluginAdminEntryPath)) {
    return 'missing';
  }

  return createHash('sha1')
    .update(readFileSync(pluginAdminEntryPath))
    .digest('hex')
    .slice(0, 12);
};

const tunnelHost = process.env.TUNNEL_HOST || '';

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
  },
  admin: {
    backendUrl: process.env.BACKEND_URL || 'http://localhost:9000',
    storefrontUrl: process.env.STOREFRONT_URL || 'http://localhost:8000',
    vite: (config) => {
      return {
        ...config,
        server: {
          ...config.server,
          ...(tunnelHost
            ? {
                allowedHosts: [
                  ...(Array.isArray(config.server?.allowedHosts)
                    ? config.server.allowedHosts
                    : []),
                  tunnelHost,
                ],
                hmr: false,
              }
            : {
                hmr: false,
              }),
        },
        optimizeDeps: {
          ...config.optimizeDeps,
          // The plugin admin entry is excluded below so plugin rebuilds reload
          // without a stale cache. Dependencies it imports are then not
          // pre-bundled automatically, and CommonJS packages in their graph
          // (e.g. deepmerge via @react-email/render → html-to-text) fail to
          // load in the browser. Pre-bundle the plugin's admin dependencies
          // explicitly.
          include: [
            ...(config.optimizeDeps?.include ?? []),
            '@react-email/editor',
            '@react-email/editor/core',
            '@react-email/editor/extensions',
            '@react-email/editor/plugins',
            '@react-email/editor/ui',
            '@tiptap/react',
          ],
          exclude: [
            ...(config.optimizeDeps?.exclude ?? []),
            'medusa-email-templates-plugin/admin',
          ],
        },
        plugins: [
          ...(config.plugins ?? []),
          {
            name: 'medusa-email-templates-plugin-admin-version',
            enforce: 'pre',
            resolveId(id) {
              if (id !== 'medusa-email-templates-plugin/admin') {
                return null;
              }

              return `${pluginAdminEntryPath}?plugin-admin-version=${getPluginAdminVersion()}`;
            },
          },
        ],
      };
    },
  },
  modules: [
    {
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/notification-local',
            id: 'local',
            options: {
              name: 'Local Notification Provider',
              channels: ['feed'],
            },
          },
          {
            resolve: 'medusa-email-templates-plugin/providers/email',
            id: 'email-templates',
            options: {
              channels: ['email'],
            },
          },
        ],
      },
    },
  ],
  plugins: [
    {
      resolve: 'medusa-email-templates-plugin',
      options: {},
    },
  ],
} satisfies InputConfigWithArrayModules);

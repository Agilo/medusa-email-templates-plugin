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
          /*
           * HMR is off behind a tunnel (the websocket is unreachable) but must
           * stay on locally.
           *
           * With the plugin excluded from `optimizeDeps` (below), its imports
           * are discovered at request time, which re-runs the optimizer and
           * changes the `?v=` hash. Vite then pushes a full reload over the
           * websocket. Without it the page mixes generations, loads two
           * Reacts, and the editor crashes ("Cannot read properties of null
           * (reading 'useMemo')"). `include` can't fully prevent this:
           * transitive imports still arrive late.
           */
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
            : {}),
        },
        optimizeDeps: {
          ...config.optimizeDeps,
          // The plugin is excluded below so rebuilds reload without a stale
          // cache, so its dependencies must be pre-bundled explicitly (CommonJS
          // ones like deepmerge otherwise fail in the browser).
          //
          // List every bare specifier the built admin chunks import. A missing
          // one is discovered at request time, re-runs the optimizer and
          // changes the `?v=` hash mid-load (e.g. a 504 "Outdated Optimize
          // Dep"). See the HMR note above for what catches stragglers.
          include: [
            ...(config.optimizeDeps?.include ?? []),
            '@react-email/editor',
            '@react-email/editor/core',
            '@react-email/editor/extensions',
            '@react-email/editor/plugins',
            '@react-email/editor/ui',
            '@react-email/editor/utils',
            '@tiptap/react',
            '@tiptap/pm/state',
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

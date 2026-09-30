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
           * HMR stays off behind a tunnel, where the client cannot reach the
           * websocket, but is left on locally — and it is load-bearing there.
           *
           * The plugin admin entry is excluded from `optimizeDeps` below, so
           * Vite's initial dependency scan never crawls it and everything it
           * imports is discovered at request time instead. Each discovery
           * re-runs the optimizer and moves `browserHash`, which is the `?v=`
           * Vite stamps onto every optimized import. Vite's answer to that is
           * to push a full page reload so the whole graph comes from one
           * generation; with no websocket there is nothing to push it down,
           * and the page ends up holding several generations at once. Two
           * copies of React then run side by side, the second one's dispatcher
           * is null, and mounting the lazily loaded editor dies with "Cannot
           * read properties of null (reading 'useMemo')".
           *
           * Listing the plugin's imports under `include` is not a substitute:
           * it removes the discoveries you can name, while transitive ones
           * (`@medusajs/admin-shared`, say) still arrive late.
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
          // The plugin admin entry is excluded below so plugin rebuilds reload
          // without a stale cache. Dependencies it imports are then not
          // pre-bundled automatically, and CommonJS packages in their graph
          // (e.g. deepmerge via @react-email/render → html-to-text) fail to
          // load in the browser. Pre-bundle the plugin's admin dependencies
          // explicitly.
          //
          // Every bare specifier the built admin chunks import belongs here,
          // not only the ones that fail outright. Being excluded, those chunks
          // are served raw, and Vite rewrites their imports to
          // `/.vite/deps/…?v=<browserHash>` using whichever hash is current
          // when it transforms the file. A specifier missing from this list is
          // discovered at request time instead, which re-runs the optimizer
          // and moves that hash, leaving the page mixing two generations of
          // the same dependency. Listing them here keeps the first pass
          // complete; the HMR note above covers what catches the ones that
          // still slip through.
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

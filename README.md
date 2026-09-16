<p align="center">
  <a href="https://www.medusajs.com">
    <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
  </a>
</p>
<h1 align="center">
  Medusa Email Templates Plugin
</h1>

<p align="center">
  Manage email templates for your Medusa store from Medusa Admin.
</p>

## Overview

The Medusa Email Templates Plugin adds email template management to the Medusa Admin dashboard.

This repository is a Yarn workspace monorepo: the plugin lives in `packages/medusa-email-templates-plugin`, and an example Medusa app used for manual validation lives in `apps/dev-app`. It is not a full Medusa application and does not include a storefront.

✅ Targets Medusa v2, currently aligned with `@medusajs/medusa` `2.21.0`

## Features

> Work in progress — features will be documented here as they land.

## Getting Started

The dev container is the primary development environment for this repository.

### Requirements

- VS Code with the Dev Containers extension
- Docker

### Quick Start

1. Open the repository in VS Code and run **Dev Containers: Reopen in Container**.
2. Wait for the post-create step to finish.
3. From the repository root, bootstrap the example app and install the plugin locally:

   ```bash
   yarn project:bootstrap
   ```

4. Use two terminals:

   Terminal 1 — rebuild and republish the plugin on change:

   ```bash
   yarn plugin:dev
   ```

   Terminal 2 — run the example backend and Admin app, restarting on plugin changes:

   ```bash
   yarn project:dev
   ```

   After a plugin admin change, wait for the restart to finish, then refresh the browser tab once.

5. Open the Admin dashboard:

   ```text
   http://localhost:9000/app
   ```

### Adding the plugin to your own Medusa app

Register the plugin **and** its notification provider in the consuming application's `medusa-config.ts`. Plugin modules are registered automatically, but module providers are not:

```typescript
import { defineConfig } from '@medusajs/framework/utils';

module.exports = defineConfig({
  // ...projectConfig
  modules: [
    {
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          // Overriding the notification module replaces Medusa's default
          // providers, so re-add the local feed provider.
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
});
```

Then run `npx medusa db:migrate` to create the plugin's tables.

- The Notification Module allows **one provider per channel**. Remove any other `email` provider (for example SendGrid), or Medusa fails at startup with `Multiple providers are configured for the same channel: email`.
- Because the plugin owns the `email` channel, Medusa Cloud's automatic email provider is not registered.
- Notifications created with rendered `content` (`subject` plus `html` or `text`) are sent unchanged through the selected transport.

#### Configure a transport

Choose the transport through the admin API (the Settings → Email page follows in a later release):

```bash
# Resend, with the API key read from an environment variable at send time
curl -X POST http://localhost:9000/admin/email/provider \
  -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" \
  -d '{"transport_id":"resend","config":{"from_address":"Shop <orders@example.com>"},"credential":{"source":"environment","env_var_name":"RESEND_API_KEY"}}'

# Send a test email through the selected transport
curl -X POST http://localhost:9000/admin/email/provider/send-test \
  -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" \
  -d '{"to":"you@example.com"}'
```

Mailgun works the same way, with a domain and region:

```bash
curl -X POST http://localhost:9000/admin/email/provider \
  -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" \
  -d '{"transport_id":"mailgun","config":{"domain":"mg.example.com","region":"eu","from_address":"Shop <orders@mg.example.com>"},"credential":{"source":"environment","env_var_name":"MAILGUN_API_KEY"}}'
```

Use a Resend API key with **sending access**, ideally restricted to your sending domain, and a Mailgun **Domain Sending Key** rather than your account key. The plugin only ever calls the send endpoint.

#### Credentials

Two credential sources are supported:

- **`environment`** — only the variable's **name** is stored, and the key is read from the environment when an email is sent.
- **`encrypted_database`** — the key is encrypted with AES-256-GCM and stored in the database. This needs an encryption key:

  ```bash
  # 32 random bytes, as base64 (44 characters) or hex (64 characters)
  MEDUSA_EMAIL_ENCRYPTION_KEY=$(openssl rand -base64 32)
  ```

  Pass the key as `credential.api_key`; omit it when saving again to keep the stored one. Without `MEDUSA_EMAIL_ENCRYPTION_KEY`, storing a key returns 400 and `encryption_available` is `false`, while environment credentials keep working. If the encryption key is later changed, stored keys report `key_mismatch` and have to be re-entered.

The admin API never returns API keys or ciphertext, only the source, the variable name, and whether the credential is usable.

#### Managed templates

Registered events have one editable template each, written in [Liquid](https://liquidjs.com). Templates are **disabled until an admin enables them**, so the plugin never sends email a host application already sends itself.

- `order-placed` — sent to the customer on `order.placed`, with the order number, line items and totals.

Rendering happens when the email is sent: the subject and text body are rendered as-is, the HTML body is HTML-escaped, and the plain-text body is derived from the rendered HTML when no text template is set. Templates cannot read files or run JavaScript, and they run under parse, render and memory limits.

Until the Settings → Email page ships, enable a template in the example app with:

```bash
yarn --cwd apps/dev-app email:template:enable order-placed
```

## Development Model

This repo follows Medusa's plugin workflow:

- the plugin project lives in `packages/medusa-email-templates-plugin`
- the consuming Medusa app lives in `apps/dev-app`
- the plugin is published locally into the example app through Yalc-backed Medusa CLI commands
- the example app runs the Medusa server and Admin dashboard used for manual testing

For day-to-day local development, `yarn plugin:dev` keeps the example app's local plugin installation updated as plugin sources change, without re-running `yarn install`, `project:plugin:add`, or restarting `project:dev` manually. Manual browser testing happens in the consuming app, not in the plugin package itself.

The dev container also provides Node.js 24, GitHub CLI, `cloudflared`, Yarn 4 via Corepack, and separate development/test Postgres and Redis services. Inside the container the app talks to `postgres:5432` and `redis:6379`; integration tests use the separate `postgres_test` and `redis_test` services.

## Commands

| Command                   | Description                                               |
| ------------------------- | --------------------------------------------------------- |
| `yarn project:bootstrap`  | Bootstrap the example app and install the plugin locally  |
| `yarn project:seed`       | Seed the example app with store, region and product data  |
| `yarn plugin:dev`         | Rebuild and republish the plugin on change                |
| `yarn plugin:dev:medusa`  | Run Medusa's raw plugin watcher directly, for comparison  |
| `yarn project:dev`        | Start the example backend and Admin app                   |
| `yarn project:dev:medusa` | Run Medusa's raw backend watcher directly, for comparison |
| `yarn test:backend`       | Run backend integration tests (module + HTTP)             |
| `yarn typecheck`          | Run TypeScript validation                                 |
| `yarn lint`               | Run ESLint                                                |
| `yarn test:admin`         | Run Admin route and component tests                       |
| `yarn test`               | Run the full validation suite (unit + backend + admin)    |

`yarn test:backend` uses the dedicated `postgres_test` and `redis_test` services inside the dev container.

## Environment

Use [packages/medusa-email-templates-plugin/.env.example](packages/medusa-email-templates-plugin/.env.example) for the plugin's local database/Redis variables. The checked-in template targets host access, reaching the development services on `localhost:5433` and `localhost:6380` and the test services on `localhost:5434` and `localhost:6382`. Inside the dev container you do not need those values: the root `project:*` and `test:backend` scripts inject the container hostnames instead, so the app talks to `postgres:5432` and `redis:6379`, and integration tests talk to `postgres_test:5432` and `redis_test:6379`.

## Testing

For routine validation, run:

```bash
yarn typecheck
yarn test
```

Outside the dev container, start the test services first with `yarn docker:test:up`, then run `yarn test:backend`. To run suites individually:

```bash
# Module/workflow-level tests
yarn test:integration:module

# HTTP-level tests (admin route auth, validation, status codes)
yarn test:integration:http

# Admin UI tests (Vitest + jsdom)
yarn test:admin

# Unit tests (pure logic, no DOM)
yarn test:unit
```

The integration suites boot a full Medusa application against the `postgres_test` service (port `5434` on the host) and `redis_test` (port `6382`), both mapped in `docker-compose.yml`. The first run builds a migrated database template and is slower; subsequent runs are fast.

## Contributing

We welcome contributions and feedback.
To get involved, [open an issue](https://github.com/Agilo/medusa-email-templates-plugin/issues) or [submit a pull request](https://github.com/Agilo/medusa-email-templates-plugin/pulls) on [GitHub →](https://github.com/Agilo/medusa-email-templates-plugin)

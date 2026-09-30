# Medusa Email Templates Plugin

Manage transactional email templates for your Medusa store from Medusa Admin, and send them through Medusa Cloud, Resend or Mailgun.

- **Settings → Email** in Medusa Admin, with a visual editor for each email, preview and test send.
- **Built-in emails** for order confirmation, admin invites, password resets and email verification, each disabled until an admin turns it on.
- **Transports** switchable at runtime, with credentials from an environment variable or stored encrypted.
- **Safe Liquid templates**, and pass-through for notifications that already carry rendered content.
- **Extensible**: register your own email events and transports.

Full documentation — transports, credentials, templates, plugin options and custom events — is in the [repository README](https://github.com/Agilo/medusa-email-templates-plugin#readme).

## Installation

```bash
npm install medusa-email-templates-plugin
```

Register the plugin **and** its notification provider in your application's `medusa-config.ts`. Plugin modules are registered automatically, but module providers are not — without the provider, no email is sent:

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

Then run the migrations:

```bash
npx medusa db:migrate
```

Open **Settings → Email** in Medusa Admin to choose a transport and enable templates.

The Notification Module allows one provider per channel, so remove any other `email` provider (for example SendGrid) first. Because the plugin owns the `email` channel, Medusa Cloud's automatic email provider is not registered; the plugin's Medusa Cloud transport takes its place.

## Compatibility

Medusa `^2.21.0` and Node.js `^20.19.0 || >=22.12.0`.

## License

MIT

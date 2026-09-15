# Medusa Email Templates Plugin

Email templates plugin for Medusa v2.

> Work in progress. See the [repository README](../../README.md) for development setup.

## Installation

Register the plugin in your Medusa application's `medusa-config.ts`:

```typescript
import { defineConfig } from '@medusajs/framework/utils';

module.exports = defineConfig({
  // ...projectConfig
  plugins: [
    {
      resolve: 'medusa-email-templates-plugin',
      options: {},
    },
  ],
});
```

Then run database migrations:

```bash
npx medusa db:migrate
```

## Compatibility

Targets Medusa v2, currently aligned with `@medusajs/medusa` `2.21.0`.

import { model } from '@medusajs/framework/utils';

import EmailProviderCredential from './email-provider-credential';

const EmailProviderConfiguration = model
  .define('email_provider_configuration', {
    id: model.id({ prefix: 'eprov' }).primaryKey(),
    transport_id: model.text(),
    is_selected: model.boolean().default(false),
    config: model.json().nullable(),
    credential: model
      .hasOne(() => EmailProviderCredential, {
        mappedBy: 'configuration',
      })
      .nullable(),
  })
  .indexes([
    {
      on: ['transport_id'],
      unique: true,
    },
    {
      on: ['is_selected'],
      unique: true,
      where: { is_selected: true },
    },
  ]);

export default EmailProviderConfiguration;

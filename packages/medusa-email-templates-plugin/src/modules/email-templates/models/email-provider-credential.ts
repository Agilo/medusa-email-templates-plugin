import { model } from '@medusajs/framework/utils';

import { CREDENTIAL_SOURCES } from '../../../lib/transports/types';
import EmailProviderConfiguration from './email-provider-configuration';

/**
 * Credential for a transport. For `environment` only the variable name is
 * stored, never the secret. `ciphertext` and `key_fingerprint` are reserved
 * for the `encrypted_database` source.
 */
const EmailProviderCredential = model
  .define('email_provider_credential', {
    id: model.id({ prefix: 'ecred' }).primaryKey(),
    transport_id: model.text(),
    source: model.enum([...CREDENTIAL_SOURCES]),
    env_var_name: model.text().nullable(),
    ciphertext: model.text().nullable(),
    key_fingerprint: model.text().nullable(),
    configuration: model.belongsTo(() => EmailProviderConfiguration, {
      mappedBy: 'credential',
    }),
  })
  .indexes([
    {
      on: ['transport_id'],
    },
  ]);

export default EmailProviderCredential;

import { decryptCredential } from '../crypto/credential-cipher';
import { providerNotReadyError } from '../errors';
import type { CredentialSource, ResolvedCredential } from '../transports/types';

export const ENV_VAR_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

export interface StoredCredential {
  id?: string;
  transport_id?: string;
  source: CredentialSource;
  env_var_name?: string | null;
  ciphertext?: string | null;
  key_fingerprint?: string | null;
}

export const resolveCredential = (
  credential: StoredCredential | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedCredential | null => {
  if (!credential || credential.source === 'managed') {
    return null;
  }

  if (credential.source === 'environment') {
    const name = credential.env_var_name;
    const value = name ? env[name] : undefined;

    if (!value) {
      throw providerNotReadyError(
        name
          ? `The environment variable ${name} is not set.`
          : 'No environment variable name is configured for this credential.',
      );
    }

    return { api_key: value };
  }

  if (credential.source === 'encrypted_database') {
    if (!credential.ciphertext) {
      throw providerNotReadyError('No API key is stored for this transport.');
    }

    const secret = decryptCredential(
      credential.ciphertext,
      credential.transport_id ?? '',
      credential.key_fingerprint,
      env,
    );

    if (!secret.api_key) {
      throw providerNotReadyError('The stored credential has no API key.');
    }

    return { api_key: secret.api_key };
  }

  throw providerNotReadyError(
    `The "${credential.source}" credential source is not supported yet.`,
  );
};

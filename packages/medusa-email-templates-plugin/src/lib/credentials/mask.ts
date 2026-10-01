import { readEncryptionKey } from '../crypto/encryption-key';
import type { CredentialSource } from '../transports/types';
import type { StoredCredential } from './resolve-credential';

export type CredentialUnavailableReason =
  | 'env_var_missing'
  | 'encryption_key_missing'
  | 'key_mismatch'
  | 'missing'
  | 'not_supported';

export interface MaskedCredential {
  source: CredentialSource;
  env_var_name?: string;
  configured: boolean;
  reason?: CredentialUnavailableReason;
}

const maskStoredKey = (
  credential: StoredCredential,
  env: NodeJS.ProcessEnv,
): MaskedCredential => {
  const base = { source: 'encrypted_database' as const };

  if (!credential.ciphertext) {
    return { ...base, configured: false, reason: 'missing' };
  }

  const encryptionKey = (() => {
    try {
      return readEncryptionKey(env);
    } catch {
      return null;
    }
  })();

  if (!encryptionKey) {
    return { ...base, configured: false, reason: 'encryption_key_missing' };
  }

  if (
    credential.key_fingerprint &&
    credential.key_fingerprint !== encryptionKey.fingerprint
  ) {
    return { ...base, configured: false, reason: 'key_mismatch' };
  }

  return { ...base, configured: true };
};

export const maskCredential = (
  credential: StoredCredential | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): MaskedCredential | null => {
  if (!credential) {
    return null;
  }

  switch (credential.source) {
    case 'managed':
      return { source: 'managed', configured: true };
    case 'environment': {
      const envVarName = credential.env_var_name ?? undefined;
      const configured = Boolean(envVarName && env[envVarName]);

      return {
        source: 'environment',
        env_var_name: envVarName,
        configured,
        ...(configured ? {} : { reason: 'env_var_missing' as const }),
      };
    }
    case 'encrypted_database':
      return maskStoredKey(credential, env);
    default:
      return {
        source: credential.source,
        configured: false,
        reason: 'not_supported',
      };
  }
};

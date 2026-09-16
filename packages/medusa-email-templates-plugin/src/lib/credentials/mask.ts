import type { CredentialSource } from '../transports/types';
import type { StoredCredential } from './resolve-credential';

export type CredentialUnavailableReason = 'env_var_missing' | 'not_supported';

/** The only credential shape admin APIs may return: never the secret. */
export interface MaskedCredential {
  source: CredentialSource;
  env_var_name?: string;
  configured: boolean;
  reason?: CredentialUnavailableReason;
}

export const maskCredential = (
  credential: StoredCredential | null | undefined,
  env: Record<string, string | undefined> = process.env,
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
    default:
      return {
        source: credential.source,
        configured: false,
        reason: 'not_supported',
      };
  }
};

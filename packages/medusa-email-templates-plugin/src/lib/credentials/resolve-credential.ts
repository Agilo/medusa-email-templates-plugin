import { providerNotReadyError } from '../errors';
import type { CredentialSource, ResolvedCredential } from '../transports/types';

export const ENV_VAR_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

export interface StoredCredential {
  id?: string;
  source: CredentialSource;
  env_var_name?: string | null;
  ciphertext?: string | null;
  key_fingerprint?: string | null;
}

type Env = Record<string, string | undefined>;

/**
 * Resolves a stored credential to its secret at send time. Returns null for
 * managed credentials and when no credential is stored.
 */
export const resolveCredential = (
  credential: StoredCredential | null | undefined,
  env: Env = process.env,
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

  throw providerNotReadyError(
    `The "${credential.source}" credential source is not supported yet.`,
  );
};

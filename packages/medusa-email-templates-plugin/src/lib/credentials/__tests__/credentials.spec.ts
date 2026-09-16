import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { encryptCredential } from '../../crypto/credential-cipher';
import { ENCRYPTION_KEY_ENV } from '../../crypto/encryption-key';
import { EmailErrorCodes } from '../../errors';
import { maskCredential } from '../mask';
import { ENV_VAR_NAME_PATTERN, resolveCredential } from '../resolve-credential';

const STORED_KEY = 're_stored_secret_value';
const encryptionKey = randomBytes(32).toString('base64');
const env = {
  RESEND_API_KEY: 're_env_secret_value',
  [ENCRYPTION_KEY_ENV]: encryptionKey,
};
const encrypted = encryptCredential({ api_key: STORED_KEY }, 'resend', env);

const storedCredential = {
  transport_id: 'resend',
  source: 'encrypted_database' as const,
  ciphertext: encrypted.ciphertext,
  key_fingerprint: encrypted.key_fingerprint,
};

describe('resolveCredential', () => {
  it('reads the secret from the named environment variable', () => {
    expect(
      resolveCredential(
        { source: 'environment', env_var_name: 'RESEND_API_KEY' },
        env,
      ),
    ).toEqual({ api_key: 're_env_secret_value' });
  });

  it('decrypts a stored API key', () => {
    expect(resolveCredential(storedCredential, env)).toEqual({
      api_key: STORED_KEY,
    });
  });

  it('returns null for managed or missing credentials', () => {
    expect(resolveCredential({ source: 'managed' }, env)).toBeNull();
    expect(resolveCredential(null, env)).toBeNull();
    expect(resolveCredential(undefined, env)).toBeNull();
  });

  it.each([
    [
      'the environment variable is unset',
      { source: 'environment' as const, env_var_name: 'MISSING_KEY' },
      'The environment variable MISSING_KEY is not set.',
    ],
    [
      'no API key is stored',
      { source: 'encrypted_database' as const, ciphertext: null },
      'No API key is stored for this transport.',
    ],
  ])('fails when %s', (_name, credential, message) => {
    expect(() => resolveCredential(credential, env)).toThrow(
      expect.objectContaining({
        code: EmailErrorCodes.PROVIDER_NOT_READY,
        message,
      }),
    );
  });

  it('fails when the encryption key is missing or rotated', () => {
    expect(() =>
      resolveCredential(storedCredential, { RESEND_API_KEY: 'x' }),
    ).toThrow('is not configured');

    expect(() =>
      resolveCredential(storedCredential, {
        [ENCRYPTION_KEY_ENV]: randomBytes(32).toString('base64'),
      }),
    ).toThrow('encrypted with a different encryption key');
  });
});

describe('maskCredential', () => {
  it('never exposes the secret', () => {
    const masked = maskCredential(
      { source: 'environment', env_var_name: 'RESEND_API_KEY' },
      env,
    );

    expect(masked).toEqual({
      source: 'environment',
      env_var_name: 'RESEND_API_KEY',
      configured: true,
    });
    expect(JSON.stringify(masked)).not.toContain('re_env_secret_value');
  });

  it('flags a missing environment variable', () => {
    expect(
      maskCredential({ source: 'environment', env_var_name: 'MISSING' }, env),
    ).toEqual({
      source: 'environment',
      env_var_name: 'MISSING',
      configured: false,
      reason: 'env_var_missing',
    });
  });

  it('reports a stored key as configured without revealing it', () => {
    const masked = maskCredential(storedCredential, env);

    expect(masked).toEqual({ source: 'encrypted_database', configured: true });
    expect(JSON.stringify(masked)).not.toContain(STORED_KEY);
    expect(JSON.stringify(masked)).not.toContain(encrypted.ciphertext);
  });

  it.each([
    [
      'the encryption key is missing',
      storedCredential,
      {},
      'encryption_key_missing',
    ],
    [
      'the encryption key was rotated',
      storedCredential,
      { [ENCRYPTION_KEY_ENV]: randomBytes(32).toString('base64') },
      'key_mismatch',
    ],
    [
      'no key is stored yet',
      { source: 'encrypted_database' as const, ciphertext: null },
      env,
      'missing',
    ],
  ])(
    'reports why it is unusable when %s',
    (_name, credential, envs, reason) => {
      expect(maskCredential(credential, envs)).toMatchObject({
        configured: false,
        reason,
      });
    },
  );

  it('returns null without a credential', () => {
    expect(maskCredential(null, env)).toBeNull();
  });
});

describe('ENV_VAR_NAME_PATTERN', () => {
  it.each(['RESEND_API_KEY', '_KEY', 'KEY1'])('accepts %s', (name) => {
    expect(ENV_VAR_NAME_PATTERN.test(name)).toBe(true);
  });

  it.each(['resend_api_key', '1KEY', 'KEY-NAME', ''])('rejects %s', (name) => {
    expect(ENV_VAR_NAME_PATTERN.test(name)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { EmailErrorCodes } from '../../errors';
import { maskCredential } from '../mask';
import { ENV_VAR_NAME_PATTERN, resolveCredential } from '../resolve-credential';

const env = { RESEND_API_KEY: 're_secret_value' };

describe('resolveCredential', () => {
  it('reads the secret from the named environment variable', () => {
    expect(
      resolveCredential(
        { source: 'environment', env_var_name: 'RESEND_API_KEY' },
        env,
      ),
    ).toEqual({ api_key: 're_secret_value' });
  });

  it('returns null for managed or missing credentials', () => {
    expect(resolveCredential({ source: 'managed' }, env)).toBeNull();
    expect(resolveCredential(null, env)).toBeNull();
    expect(resolveCredential(undefined, env)).toBeNull();
  });

  it('fails with a "provider not ready" error when the variable is unset', () => {
    expect(() =>
      resolveCredential(
        { source: 'environment', env_var_name: 'MISSING_KEY' },
        env,
      ),
    ).toThrow(
      expect.objectContaining({
        code: EmailErrorCodes.PROVIDER_NOT_READY,
        message: 'The environment variable MISSING_KEY is not set.',
      }),
    );
  });

  it('rejects sources that are not supported yet', () => {
    expect(() =>
      resolveCredential(
        { source: 'encrypted_database', ciphertext: 'v1.x.y.z' },
        env,
      ),
    ).toThrow('not supported yet');
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
    expect(JSON.stringify(masked)).not.toContain('re_secret_value');
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

  it('omits ciphertext for stored credentials', () => {
    const masked = maskCredential(
      { source: 'encrypted_database', ciphertext: 'v1.secret' },
      env,
    );

    expect(masked).toEqual({
      source: 'encrypted_database',
      configured: false,
      reason: 'not_supported',
    });
  });

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

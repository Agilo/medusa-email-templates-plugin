import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { EmailErrorCodes } from '../../errors';
import { decryptCredential, encryptCredential } from '../credential-cipher';
import {
  ENCRYPTION_KEY_ENV,
  fingerprintKey,
  isEncryptionAvailable,
  readEncryptionKey,
} from '../encryption-key';

const keyBuffer = randomBytes(32);
const env = { [ENCRYPTION_KEY_ENV]: keyBuffer.toString('base64') };
const otherKey = { [ENCRYPTION_KEY_ENV]: randomBytes(32).toString('base64') };
const secret = { api_key: 're_stored_secret_value' };

describe('encryption key', () => {
  it('accepts base64 and hex keys of 32 bytes', () => {
    expect(readEncryptionKey(env)?.key).toEqual(keyBuffer);
    expect(
      readEncryptionKey({ [ENCRYPTION_KEY_ENV]: keyBuffer.toString('hex') })
        ?.fingerprint,
    ).toBe(fingerprintKey(keyBuffer));
  });

  it('returns null when no key is configured', () => {
    expect(readEncryptionKey({})).toBeNull();
    expect(isEncryptionAvailable({})).toBe(false);
  });

  it.each([
    ['too short', randomBytes(16).toString('base64')],
    ['not encoded', 'my-secret-passphrase'],
    ['empty-ish', '   x   '],
  ])('rejects a %s key', (_name, value) => {
    expect(() => readEncryptionKey({ [ENCRYPTION_KEY_ENV]: value })).toThrow(
      'must be 32 random bytes',
    );
    expect(isEncryptionAvailable({ [ENCRYPTION_KEY_ENV]: value })).toBe(false);
  });
});

describe('credential cipher', () => {
  it('round-trips a secret and records the key fingerprint', () => {
    const encrypted = encryptCredential(secret, 'resend', env);

    expect(encrypted.ciphertext.startsWith('v1.')).toBe(true);
    expect(encrypted.ciphertext).not.toContain(secret.api_key);
    expect(encrypted.key_fingerprint).toBe(fingerprintKey(keyBuffer));
    expect(
      decryptCredential(
        encrypted.ciphertext,
        'resend',
        encrypted.key_fingerprint,
        env,
      ),
    ).toEqual(secret);
  });

  it('produces a different ciphertext every time', () => {
    const first = encryptCredential(secret, 'resend', env);
    const second = encryptCredential(secret, 'resend', env);

    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('refuses ciphertext copied to another transport', () => {
    const { ciphertext } = encryptCredential(secret, 'resend', env);

    expect(() => decryptCredential(ciphertext, 'mailgun', null, env)).toThrow(
      'could not be decrypted',
    );
  });

  it.each([
    ['the iv', 1],
    ['the auth tag', 2],
    ['the ciphertext', 3],
  ])('detects tampering with %s', (_part, index) => {
    const { ciphertext } = encryptCredential(secret, 'resend', env);
    const parts = ciphertext.split('.');
    parts[index] = Buffer.from(randomBytes(12)).toString('base64url');

    expect(() =>
      decryptCredential(parts.join('.'), 'resend', null, env),
    ).toThrow('could not be decrypted');
  });

  it('reports a rotated key before trying to decrypt', () => {
    const encrypted = encryptCredential(secret, 'resend', env);

    expect(() =>
      decryptCredential(
        encrypted.ciphertext,
        'resend',
        encrypted.key_fingerprint,
        otherKey,
      ),
    ).toThrow('encrypted with a different encryption key');
  });

  it('rejects malformed ciphertext', () => {
    expect(() =>
      decryptCredential('not-a-ciphertext', 'resend', null, env),
    ).toThrow('malformed');
    expect(() => decryptCredential('v2.a.b.c', 'resend', null, env)).toThrow(
      'malformed',
    );
  });

  it('fails clearly when the key is missing', () => {
    const { ciphertext } = encryptCredential(secret, 'resend', env);

    expect(() => encryptCredential(secret, 'resend', {})).toThrow(
      'is not configured',
    );
    expect(() => decryptCredential(ciphertext, 'resend', null, {})).toThrow(
      expect.objectContaining({ code: EmailErrorCodes.PROVIDER_NOT_READY }),
    );
  });
});

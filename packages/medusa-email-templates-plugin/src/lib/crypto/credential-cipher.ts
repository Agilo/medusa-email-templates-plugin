import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { invalidDataError, providerNotReadyError } from '../errors';
import {
  ENCRYPTION_KEY_ENV,
  readEncryptionKey,
  type EncryptionKey,
} from './encryption-key';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export type EncryptedCredential = {
  /** `v1.<iv>.<authTag>.<ciphertext>`, each part base64url. */
  ciphertext: string;
  key_fingerprint: string;
};

/** Binds ciphertext to its transport, so it cannot be reused for another. */
const additionalData = (transportId: string): Buffer =>
  Buffer.from(`medusa-email-templates:${VERSION}:${transportId}`);

const encode = (value: Buffer): string => value.toString('base64url');

const requireKey = (
  env: NodeJS.ProcessEnv,
  onMissing: () => never,
): EncryptionKey => readEncryptionKey(env) ?? onMissing();

export const encryptCredential = (
  secret: Record<string, string>,
  transportId: string,
  env: NodeJS.ProcessEnv = process.env,
): EncryptedCredential => {
  const { key, fingerprint } = requireKey(env, () => {
    throw invalidDataError(
      `${ENCRYPTION_KEY_ENV} is not configured, so API keys cannot be stored. Set it, or use an environment variable credential instead.`,
    );
  });

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(additionalData(transportId));

  const payload = Buffer.concat([
    cipher.update(JSON.stringify(secret), 'utf8'),
    cipher.final(),
  ]);

  return {
    ciphertext: [
      VERSION,
      encode(iv),
      encode(cipher.getAuthTag()),
      encode(payload),
    ].join('.'),
    key_fingerprint: fingerprint,
  };
};

export const decryptCredential = (
  ciphertext: string,
  transportId: string,
  expectedFingerprint?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> => {
  const { key, fingerprint } = requireKey(env, () => {
    throw providerNotReadyError(
      `${ENCRYPTION_KEY_ENV} is not configured, so the stored API key cannot be read.`,
    );
  });

  if (expectedFingerprint && expectedFingerprint !== fingerprint) {
    throw providerNotReadyError(
      'This API key was encrypted with a different encryption key. Re-enter the API key.',
    );
  }

  const [version, iv, authTag, payload] = ciphertext.split('.');

  if (version !== VERSION || !iv || !authTag || !payload) {
    throw invalidDataError('The stored API key is malformed.');
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'base64url'),
      { authTagLength: AUTH_TAG_BYTES },
    );
    decipher.setAAD(additionalData(transportId));
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload, 'base64url')),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(plaintext) as Record<string, string>;
  } catch {
    // Authentication failure: tampering, a wrong key, or another transport.
    throw providerNotReadyError(
      'The stored API key could not be decrypted. Re-enter the API key.',
    );
  }
};

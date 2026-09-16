import { createHash } from 'node:crypto';

import { invalidDataError } from '../errors';

export const ENCRYPTION_KEY_ENV = 'MEDUSA_EMAIL_ENCRYPTION_KEY';

const KEY_BYTES = 32;
const HEX_KEY = /^[0-9a-f]{64}$/i;
const BASE64_KEY = /^[A-Za-z0-9+/]{43}=$/;

export type EncryptionKey = {
  key: Buffer;
  /** First 16 hex characters of sha256(key), to detect a rotated key. */
  fingerprint: string;
};

export const KEY_FORMAT_MESSAGE = `${ENCRYPTION_KEY_ENV} must be 32 random bytes, as base64 (44 characters) or hex (64 characters). Generate one with: openssl rand -base64 32`;

const parseKey = (raw: string): Buffer | null => {
  const value = raw.trim();

  if (HEX_KEY.test(value)) {
    return Buffer.from(value, 'hex');
  }

  if (BASE64_KEY.test(value)) {
    const key = Buffer.from(value, 'base64');

    return key.length === KEY_BYTES ? key : null;
  }

  return null;
};

export const fingerprintKey = (key: Buffer): string =>
  createHash('sha256').update(key).digest('hex').slice(0, 16);

/** Returns null when no key is configured, and throws when it is malformed. */
export const readEncryptionKey = (
  env: NodeJS.ProcessEnv = process.env,
): EncryptionKey | null => {
  const raw = env[ENCRYPTION_KEY_ENV];

  if (!raw) {
    return null;
  }

  const key = parseKey(raw);

  if (!key) {
    throw invalidDataError(KEY_FORMAT_MESSAGE);
  }

  return { key, fingerprint: fingerprintKey(key) };
};

export const isEncryptionAvailable = (
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  try {
    return readEncryptionKey(env) !== null;
  } catch {
    return false;
  }
};

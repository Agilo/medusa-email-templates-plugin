const MIN_SECRET_LENGTH = 4;

export const redactSecrets = (
  message: string,
  secrets: ReadonlyArray<string | null | undefined>,
): string =>
  secrets.reduce<string>((result, secret) => {
    if (!secret || secret.length < MIN_SECRET_LENGTH) {
      return result;
    }

    return result.split(secret).join('[redacted]');
  }, message);

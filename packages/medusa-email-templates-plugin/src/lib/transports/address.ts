import { z } from 'zod';

const ADDRESS = '[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+';
const PLAIN_ADDRESS_PATTERN = new RegExp(`^${ADDRESS}$`);
const NAMED_ADDRESS_PATTERN = new RegExp(`^[^<>]*<\\s*${ADDRESS}\\s*>$`);

/** Accepts `orders@example.com` and `Shop <orders@example.com>`. */
export const isEmailAddress = (value: string): boolean => {
  const trimmed = value.trim();

  return (
    PLAIN_ADDRESS_PATTERN.test(trimmed) || NAMED_ADDRESS_PATTERN.test(trimmed)
  );
};

export const emailAddressSchema = z.string().trim().refine(isEmailAddress, {
  message:
    'Expected an email address such as "orders@example.com" or "Shop <orders@example.com>"',
});

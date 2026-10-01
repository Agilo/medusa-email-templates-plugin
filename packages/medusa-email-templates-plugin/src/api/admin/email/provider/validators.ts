import { z } from 'zod';

import { ENV_VAR_NAME_PATTERN } from '../../../../lib/credentials/resolve-credential';

export const PostEmailProviderCredentialSchema = z.discriminatedUnion(
  'source',
  [
    z.strictObject({
      source: z.literal('environment'),
      env_var_name: z
        .string()
        .regex(
          ENV_VAR_NAME_PATTERN,
          'Use an environment variable name such as RESEND_API_KEY.',
        ),
    }),
    z.strictObject({
      source: z.literal('encrypted_database'),
      api_key: z.string().min(1).optional(),
    }),
  ],
);

export const PostEmailProviderSchema = z.strictObject({
  transport_id: z.string().min(1),
  config: z.record(z.string(), z.unknown()).optional(),
  credential: PostEmailProviderCredentialSchema.optional(),
});

export type PostEmailProviderBody = z.infer<typeof PostEmailProviderSchema>;

export const PostEmailProviderTestSchema = z.strictObject({
  to: z.email(),
  transport_id: z.string().min(1).optional(),
});

export type PostEmailProviderTestBody = z.infer<
  typeof PostEmailProviderTestSchema
>;

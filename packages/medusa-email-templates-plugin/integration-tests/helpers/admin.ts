import jwt from 'jsonwebtoken';
import { Modules } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

export async function createAdminHeaders(
  container: MedusaContainer,
): Promise<Record<string, string>> {
  const userModule = container.resolve(Modules.USER);
  const authModule = container.resolve(Modules.AUTH);

  const email = `admin-${Math.random().toString(36).slice(2)}@test.local`;
  const user = await userModule.createUsers({ email });
  const authIdentity = await authModule.createAuthIdentities({
    provider_identities: [
      {
        provider: 'emailpass',
        entity_id: email,
        provider_metadata: { password: 'supersecret' },
      },
    ],
    app_metadata: { user_id: user.id },
  });

  const token = jwt.sign(
    {
      actor_id: user.id,
      actor_type: 'user',
      auth_identity_id: authIdentity.id,
    },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1d' },
  );

  return { authorization: `Bearer ${token}` };
}

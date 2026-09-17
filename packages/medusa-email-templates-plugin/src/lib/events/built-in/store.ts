import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

export const DEFAULT_STORE_NAME = 'Medusa Store';

/** Store name used in every built-in template. */
export const retrieveStoreName = async (
  container: MedusaContainer,
): Promise<string> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({ entity: 'store', fields: ['name'] });

  return (data[0]?.name as string | undefined) ?? DEFAULT_STORE_NAME;
};

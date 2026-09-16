/**
 * Reduces template data to plain JSON, dropping functions, class instances
 * and prototypes before it reaches Liquid.
 */
export const sanitizeTemplateContext = (
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> => {
  if (!data) {
    return {};
  }

  const plain: unknown = JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

  return plain && typeof plain === 'object' && !Array.isArray(plain)
    ? (plain as Record<string, unknown>)
    : {};
};

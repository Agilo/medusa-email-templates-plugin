import type { ProviderSendNotificationDTO } from '@medusajs/framework/types';

export type NotificationContent = NonNullable<
  ProviderSendNotificationDTO['content']
>;

const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Content counts as already rendered when it has an HTML or text body. Such
 * content is sent as-is, without a plugin-managed template (spec §5).
 */
export const isRenderedContent = (
  content: NotificationContent | null | undefined,
): content is NotificationContent =>
  hasText(content?.html) || hasText(content?.text);

export const hasSubject = (content: NotificationContent): boolean =>
  hasText(content.subject);

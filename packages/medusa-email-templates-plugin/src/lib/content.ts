import type { ProviderSendNotificationDTO } from '@medusajs/framework/types';

export type NotificationContent = NonNullable<
  ProviderSendNotificationDTO['content']
>;

const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isRenderedContent = (
  content: NotificationContent | null | undefined,
): content is NotificationContent =>
  hasText(content?.html) || hasText(content?.text);

export const hasSubject = (content: NotificationContent): boolean =>
  hasText(content.subject);

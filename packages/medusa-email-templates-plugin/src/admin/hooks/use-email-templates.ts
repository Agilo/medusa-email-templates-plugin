import { useQuery } from '@tanstack/react-query';

import { sdk } from '../lib/sdk';
import type { EmailTemplateListItem } from '../lib/types';

export const emailTemplatesQueryKey = ['email', 'templates'] as const;

type EmailTemplatesResponse = {
  templates: EmailTemplateListItem[];
  count: number;
};

/**
 * Every registered event, whether or not its template has been saved.
 * Templates that were never saved come back with `id: null`,
 * `is_customized: false` and `enabled: false`.
 */
export const useEmailTemplates = () =>
  useQuery({
    queryKey: emailTemplatesQueryKey,
    queryFn: () =>
      sdk.client.fetch<EmailTemplatesResponse>('/admin/email/templates'),
  });

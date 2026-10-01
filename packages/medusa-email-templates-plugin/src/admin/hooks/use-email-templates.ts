import { useQuery } from '@tanstack/react-query';

import { sdk } from '../lib/sdk';
import type { EmailTemplateListItem } from '../lib/types';

export const emailTemplatesQueryKey = ['email', 'templates'] as const;

type EmailTemplatesResponse = {
  templates: EmailTemplateListItem[];
  count: number;
};

export const useEmailTemplates = () =>
  useQuery({
    queryKey: emailTemplatesQueryKey,
    queryFn: () =>
      sdk.client.fetch<EmailTemplatesResponse>('/admin/email/templates'),
  });

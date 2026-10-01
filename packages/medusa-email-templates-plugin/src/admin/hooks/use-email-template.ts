import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../lib/sdk';
import type {
  EmailSendResult,
  EmailTemplateDetail,
  EmailTemplateDraft,
  EmailTemplatePreview,
  SaveEmailTemplatePayload,
} from '../lib/types';
import { emailTemplatesQueryKey } from './use-email-templates';

export const emailTemplateQueryKey = (templateKey: string) =>
  ['email', 'templates', templateKey] as const;

const templatePath = (templateKey: string) =>
  `/admin/email/templates/${encodeURIComponent(templateKey)}`;

export const useEmailTemplate = (templateKey: string) =>
  useQuery({
    queryKey: emailTemplateQueryKey(templateKey),
    queryFn: () =>
      sdk.client.fetch<{ template: EmailTemplateDetail }>(
        templatePath(templateKey),
      ),
    select: (data) => data.template,
    enabled: Boolean(templateKey),
  });

export const useSaveEmailTemplate = (templateKey: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveEmailTemplatePayload) =>
      sdk.client.fetch<{ template: EmailTemplateDetail }>(
        templatePath(templateKey),
        { method: 'POST', body: payload },
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(emailTemplateQueryKey(templateKey), data);
      queryClient.invalidateQueries({
        queryKey: emailTemplateQueryKey(templateKey),
      });
      queryClient.invalidateQueries({ queryKey: emailTemplatesQueryKey });
    },
  });
};

export const useToggleEmailTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { template_key: string; enabled: boolean }) =>
      sdk.client.fetch<{ template: EmailTemplateDetail }>(
        templatePath(variables.template_key),
        { method: 'POST', body: { enabled: variables.enabled } },
      ),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        emailTemplateQueryKey(variables.template_key),
        data,
      );
      queryClient.invalidateQueries({ queryKey: emailTemplatesQueryKey });
    },
  });
};

export const useResetEmailTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { template_key: string }) =>
      sdk.client.fetch<{ template: EmailTemplateDetail }>(
        templatePath(variables.template_key),
        { method: 'DELETE' },
      ),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        emailTemplateQueryKey(variables.template_key),
        data,
      );
      queryClient.invalidateQueries({ queryKey: emailTemplatesQueryKey });
    },
  });
};

type RenderVariables = {
  data?: Record<string, unknown>;
  draft?: EmailTemplateDraft;
};

export const usePreviewEmailTemplate = (templateKey: string) =>
  useMutation({
    mutationFn: (variables: RenderVariables = {}) =>
      sdk.client.fetch<{ preview: EmailTemplatePreview }>(
        `${templatePath(templateKey)}/preview`,
        { method: 'POST', body: variables },
      ),
  });

export const useSendTemplateTestEmail = (templateKey: string) =>
  useMutation({
    mutationFn: (variables: RenderVariables & { to: string }) =>
      sdk.client.fetch<{ result: EmailSendResult }>(
        `${templatePath(templateKey)}/send-test`,
        { method: 'POST', body: variables },
      ),
  });

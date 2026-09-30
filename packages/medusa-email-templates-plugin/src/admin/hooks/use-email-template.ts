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

/** One template with its variables and the built-in default to fall back on. */
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

/**
 * Saves the subject, bodies and enabled flag. Invalid Liquid is rejected with
 * 400 rather than breaking a real send.
 */
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
      // The list shows enabled, is_customized and updated_at.
      queryClient.invalidateQueries({ queryKey: emailTemplatesQueryKey });
    },
  });
};

/**
 * Turns a template on or off from the list. A partial update, so the subject
 * and bodies are untouched.
 */
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

/**
 * Discards the saved template so the event uses its built-in default.
 * Idempotent: resetting an untouched template is a no-op.
 */
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
  /** Overrides for the variables' example values. */
  data?: Record<string, unknown>;
  /** Unsaved editor changes to render instead of what is stored. */
  draft?: EmailTemplateDraft;
};

/** Renders subject, HTML and text with sample data. Sends nothing. */
export const usePreviewEmailTemplate = (templateKey: string) =>
  useMutation({
    mutationFn: (variables: RenderVariables = {}) =>
      sdk.client.fetch<{ preview: EmailTemplatePreview }>(
        `${templatePath(templateKey)}/preview`,
        { method: 'POST', body: variables },
      ),
  });

/**
 * Sends the template, with sample data, to one address. Works while disabled,
 * so it can be checked before enabling.
 */
export const useSendTemplateTestEmail = (templateKey: string) =>
  useMutation({
    mutationFn: (variables: RenderVariables & { to: string }) =>
      sdk.client.fetch<{ result: EmailSendResult }>(
        `${templatePath(templateKey)}/send-test`,
        { method: 'POST', body: variables },
      ),
  });

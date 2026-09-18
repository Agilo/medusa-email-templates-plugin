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
 * Saves the subject, bodies and enabled flag. The server parses the Liquid
 * first, so a syntax error rejects with 400 rather than breaking a real send.
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
 * Turns a template on or off from the list, without opening the editor.
 * Needs the rest of the row, since saving replaces the whole template.
 */
export const useToggleEmailTemplate = (templateKey: string) => {
  const save = useSaveEmailTemplate(templateKey);

  return {
    ...save,
    toggle: (template: EmailTemplateDetail, enabled: boolean) =>
      save.mutateAsync({
        enabled,
        subject_template: template.subject_template,
        editor_content: template.editor_content,
        html_template: template.html_template,
        text_template: template.text_template,
      }),
  };
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
 * Sends this template, rendered with sample data, to one address. Works even
 * while the template is disabled — that is how you check it before enabling.
 */
export const useSendTemplateTestEmail = (templateKey: string) =>
  useMutation({
    mutationFn: (variables: RenderVariables & { to: string }) =>
      sdk.client.fetch<{ result: EmailSendResult }>(
        `${templatePath(templateKey)}/send-test`,
        { method: 'POST', body: variables },
      ),
  });

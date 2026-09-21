import { z } from 'zod';

// Email subject lines are limited to 998 bytes by RFC 5322.
const MAX_SUBJECT = 998;
const MAX_HTML = 512 * 1024;
const MAX_TEXT = 256 * 1024;

/**
 * A partial update: omitted fields keep their stored values, so the templates
 * list can toggle `enabled` alone without clearing the body.
 */
export const PostEmailTemplateSchema = z.strictObject({
  enabled: z.boolean().optional(),
  subject_template: z.string().min(1).max(MAX_SUBJECT).optional(),
  editor_content: z.record(z.string(), z.unknown()).nullable().optional(),
  html_template: z.string().max(MAX_HTML).nullable().optional(),
  text_template: z.string().max(MAX_TEXT).nullable().optional(),
});

export type PostEmailTemplateBody = z.infer<typeof PostEmailTemplateSchema>;

const draftSchema = z.strictObject({
  subject_template: z.string().min(1).max(MAX_SUBJECT).optional(),
  html_template: z.string().max(MAX_HTML).nullable().optional(),
  text_template: z.string().max(MAX_TEXT).nullable().optional(),
});

export const PostEmailTemplatePreviewSchema = z.strictObject({
  data: z.record(z.string(), z.unknown()).optional(),
  draft: draftSchema.optional(),
});

export type PostEmailTemplatePreviewBody = z.infer<
  typeof PostEmailTemplatePreviewSchema
>;

export const PostEmailTemplateTestSchema = z.strictObject({
  to: z.email(),
  data: z.record(z.string(), z.unknown()).optional(),
  draft: draftSchema.optional(),
});

export type PostEmailTemplateTestBody = z.infer<
  typeof PostEmailTemplateTestSchema
>;

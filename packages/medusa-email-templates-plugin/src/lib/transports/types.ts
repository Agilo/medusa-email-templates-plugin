import type {
  Logger,
  ProviderSendNotificationDTO,
} from '@medusajs/framework/types';
import type { z } from '@medusajs/framework/zod';

export const CREDENTIAL_SOURCES = [
  'managed',
  'environment',
  'encrypted_database',
  'oauth',
] as const;

export type CredentialSource = (typeof CREDENTIAL_SOURCES)[number];

export type EmailAttachment = NonNullable<
  ProviderSendNotificationDTO['attachments']
>[number];

export interface RenderedEmail {
  to: string;
  from?: string;
  attachments?: EmailAttachment[] | null;
  template?: string | null;
  data?: Record<string, unknown> | null;
  provider_data?: Record<string, unknown> | null;
  content: { subject: string; html?: string; text?: string };
}

export interface ResolvedCredential {
  api_key: string;
}

export interface CloudEmailConfig {
  apiKey?: string;
  emailsEndpoint?: string;
  environmentHandle?: string;
  sandboxHandle?: string;
}

export interface EmailTransportContext {
  config: Record<string, unknown>;
  credential: ResolvedCredential | null;
  cloud: CloudEmailConfig | null;
  idempotencyKey?: string | null;
  logger?: Logger;
}

export interface EmailTransportResult {
  id?: string;
}

export interface EmailTransport {
  id: string;
  label: string;
  credentialSources: CredentialSource[];
  configSchema: z.ZodType;
  isAvailable(context: EmailTransportContext): Promise<boolean>;
  validateConfiguration(config: unknown): Promise<Record<string, unknown>>;
  send(
    email: RenderedEmail,
    context: EmailTransportContext,
  ): Promise<EmailTransportResult>;
}

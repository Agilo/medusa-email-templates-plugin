/**
 * The admin API contract, duplicated from the server types because the admin
 * tsconfig has no Node types. Keep both in step; the HTTP integration tests
 * are the source of truth.
 */

export type CredentialSource =
  'managed' | 'environment' | 'encrypted_database' | 'oauth';

export type CredentialUnavailableReason =
  | 'env_var_missing'
  | 'encryption_key_missing'
  | 'key_mismatch'
  | 'missing'
  | 'not_supported';

export interface MaskedCredential {
  source: CredentialSource;
  env_var_name?: string;
  configured: boolean;
  reason?: CredentialUnavailableReason;
}

export interface EmailProviderTransportState {
  id: string;
  label: string;
  selected: boolean;
  available: boolean;
  unavailable_reason?: string;
  credential_sources: CredentialSource[];
  config: Record<string, unknown>;
  credential: MaskedCredential | null;
}

export interface EmailProviderState {
  selected_transport_id: string | null;
  encryption_available: boolean;
  transports: EmailProviderTransportState[];
}

export type CredentialInput =
  | { source: 'environment'; env_var_name: string }
  | { source: 'encrypted_database'; api_key?: string };

export interface SaveEmailProviderPayload {
  transport_id: string;
  config?: Record<string, unknown>;
  credential?: CredentialInput;
}

export interface EmailSendResult {
  notification_id: string;
  external_id: string | null;
  transport_id: string;
}

export interface ProviderTestResult {
  external_id: string | null;
  transport_id: string;
}

export interface EmailTemplateVariable {
  key: string;
  label: string;
  description?: string;
  example: unknown;
  group?: string;
  type?: 'text' | 'number' | 'money' | 'date' | 'url' | 'list';
  currencyKey?: string;
  fields?: EmailTemplateVariable[];
  itemTemplate?: string;
}

export interface EmailTemplateListItem {
  id: string | null;
  template_key: string;
  event: string;
  label: string;
  description?: string;
  enabled: boolean;
  subject_template: string;
  is_customized: boolean;
  updated_at: string | null;
  warnings: string[];
}

export interface EmailTemplateSnippet {
  key: string;
  label: string;
  description?: string;
  html: string;
}

export interface EmailTemplateDetail extends EmailTemplateListItem {
  editor_content: Record<string, unknown> | null;
  html_template: string | null;
  text_template: string | null;
  variables: EmailTemplateVariable[];
  snippets: EmailTemplateSnippet[];
  default_template: {
    subject: string;
    html: string;
    text?: string;
  };
}

export interface SaveEmailTemplatePayload {
  enabled?: boolean;
  subject_template?: string;
  editor_content?: Record<string, unknown> | null;
  html_template?: string | null;
  text_template?: string | null;
}

export interface EmailTemplateDraft {
  subject_template?: string;
  html_template?: string | null;
  text_template?: string | null;
}

export interface EmailTemplatePreview {
  subject: string;
  html: string;
  text: string;
}

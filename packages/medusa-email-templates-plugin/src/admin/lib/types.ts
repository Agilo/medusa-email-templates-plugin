/**
 * The admin API contract, mirrored for the dashboard bundle.
 *
 * These deliberately duplicate the server-side types instead of importing
 * them: the admin tsconfig has no Node types, and the server modules they
 * live in reference `NodeJS.ProcessEnv`. Keep both sides in step when the
 * API changes — the HTTP integration tests are the source of truth.
 */

export type CredentialSource =
  'managed' | 'environment' | 'encrypted_database' | 'oauth';

export type CredentialUnavailableReason =
  | 'env_var_missing'
  | 'encryption_key_missing'
  | 'key_mismatch'
  | 'missing'
  | 'not_supported';

/** Never contains the secret — only whether one is usable. */
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
  /** Whether MEDUSA_EMAIL_ENCRYPTION_KEY is set, enabling stored API keys. */
  encryption_available: boolean;
  transports: EmailProviderTransportState[];
}

/** Write-only: `api_key` replaces the stored secret, omitting it keeps it. */
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

/**
 * A provider test sends straight through the transport, so it has no
 * notification row — only what the provider's API returned.
 */
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
  /**
   * Omitted means plain text. Decides which formats the editor offers, `url`
   * decides which variables the link picker offers, and `list` is a Repeat
   * block's source rather than a pill.
   */
  type?: 'text' | 'number' | 'money' | 'date' | 'url' | 'list';
  /** For `money` values, the key holding the currency code. */
  currencyKey?: string;
  /** For a `list`, one entry's values, keyed relative to the entry. */
  fields?: EmailTemplateVariable[];
  /** For a `list`, one entry's HTML, used as a new block's content. */
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
  /** True once saved, rather than only defined in code. */
  is_customized: boolean;
  updated_at: string | null;
  /** Configuration problems that stop this template sending. */
  warnings: string[];
}

export interface EmailTemplateDetail extends EmailTemplateListItem {
  editor_content: Record<string, unknown> | null;
  html_template: string | null;
  text_template: string | null;
  variables: EmailTemplateVariable[];
  default_template: {
    subject: string;
    html: string;
    text?: string;
  };
}

/**
 * A partial update: omitted fields keep their stored values, and `null`
 * explicitly clears one. Sending the subject alone leaves the bodies intact.
 */
export interface SaveEmailTemplatePayload {
  enabled?: boolean;
  subject_template?: string;
  editor_content?: Record<string, unknown> | null;
  html_template?: string | null;
  text_template?: string | null;
}

/** Unsaved editor changes, so a preview or test can run before saving. */
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

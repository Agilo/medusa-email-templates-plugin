import type { MedusaContainer } from '@medusajs/framework/types';

export interface EmailTemplateVariable {
  /** Dot-separated key used in templates, for example `order.display_id`. */
  key: string;
  label: string;
  description?: string;
  example: unknown;
  group?: string;
}

export interface EmailEventDefaultTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailEventDefinition<TData = unknown> {
  /** Medusa event name, for example `order.placed`. */
  event: string;
  /** Stable key, also the admin route parameter. */
  templateKey: string;
  label: string;
  description?: string;
  /**
   * Selects between definitions that share an event (for example password
   * resets for admins and customers). Required when an event has more than
   * one definition.
   */
  matches?: (data: TData) => boolean;
  /** Returns null to skip sending, for example when there is no email. */
  getRecipient: (
    data: TData,
    container: MedusaContainer,
  ) => Promise<string | null>;
  getContext: (
    data: TData,
    container: MedusaContainer,
  ) => Promise<Record<string, unknown>>;
  variables: EmailTemplateVariable[];
  defaultTemplate: EmailEventDefaultTemplate;
  getIdempotencyKey?: (data: TData) => string | undefined;
  getResource?: (data: TData) => {
    resource_id?: string;
    resource_type?: string;
  };
}

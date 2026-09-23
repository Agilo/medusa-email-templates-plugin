import type { MedusaContainer } from '@medusajs/framework/types';

export interface EmailTemplateVariable {
  /** Dot-separated key used in templates, for example `order.display_id`. */
  key: string;
  label: string;
  description?: string;
  example: unknown;
  group?: string;
  /**
   * What the value holds, which decides the display formats the editor offers
   * for it. Omitted means plain text. Marking a value `money` or `date` when
   * it is neither renders an empty string, so the editor uses this to stop an
   * impossible choice being made rather than to decorate the picker.
   */
  type?: 'text' | 'number' | 'money' | 'date';
  /**
   * For a `money` value, the key holding its currency code. The editor emits
   * this as a Liquid filter argument, so it must be a bare identifier path —
   * a quoted literal would be corrupted on export.
   */
  currencyKey?: string;
  /**
   * For a collection such as `order.items`, the fields one element exposes.
   * Keys are relative to the loop alias, so `total` becomes `item.total`.
   */
  itemVariables?: EmailTemplateVariable[];
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
  /**
   * Configuration problems that stop this template from sending, surfaced in
   * the admin list. For example a customer link with no storefront URL.
   */
  getWarnings?: (container: MedusaContainer) => string[];
}

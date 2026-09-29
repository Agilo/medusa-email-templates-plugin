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
   *
   * `url` is the same idea applied to link and button hrefs: it is the only
   * thing that distinguishes a value that can *be* a URL from one that merely
   * reads like it, so the editor's link picker offers these and nothing else.
   * A `url` value is still a plain string everywhere else — it can be dropped
   * into body text like any other variable.
   *
   * `list` is an array the editor repeats content over, never a value to
   * print: it is offered as the source of a Repeat block rather than as a
   * pill, and its `fields` become the `item.*` values inside that block.
   */
  type?: 'text' | 'number' | 'money' | 'date' | 'url' | 'list';
  /**
   * For a `money` value, the key holding its currency code. The editor emits
   * this as a Liquid filter argument, so it must be a bare identifier path —
   * a quoted literal would be corrupted on export.
   *
   * On a list field it stays absolute (`order.currency_code`, not
   * `item.currency_code`): Liquid reads the outer scope inside a loop.
   */
  currencyKey?: string;
  /**
   * For a `list`, what one entry holds. Keys are relative to the entry —
   * `title`, which the editor offers as `item.title` inside the block.
   */
  fields?: EmailTemplateVariable[];
  /**
   * For a `list`, the HTML of one entry, written with `{{ item.* }}`
   * expressions. The editor inserts it as the block's starting content, and a
   * default template can reuse the same string so the two cannot drift.
   */
  itemTemplate?: string;
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
   * Configuration problems surfaced in the admin list, as codes the dashboard
   * turns into text. For example a customer link with no storefront URL.
   *
   * Not only problems that stop a send. The password reset cannot go at all
   * without its link, while an order confirmation sends perfectly well and
   * merely loses `order_url` — both are worth telling an admin about, and the
   * rendered text says what is broken rather than what was prevented.
   */
  getWarnings?: (container: MedusaContainer) => string[];
}

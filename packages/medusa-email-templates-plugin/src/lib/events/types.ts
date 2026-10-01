import type { MedusaContainer } from '@medusajs/framework/types';

export interface EmailTemplateVariable {
  key: string;
  label: string;
  description?: string;
  example: unknown;
  group?: string;
  /**
   * What the value holds; omitted means plain text.
   *
   * - `money` / `date`: unlock those display formats. Don't mark other values
   *   this way — a wrong format renders an empty string.
   * - `url`: the only variables the link picker offers for hrefs. Still usable
   *   as ordinary text elsewhere.
   * - `list`: an array to repeat content over. Offered as a Repeat block
   *   source, never as a pill; its `fields` become `item.*` inside the block.
   */
  type?: 'text' | 'number' | 'money' | 'date' | 'url' | 'list';
  /**
   * For `money`, the key holding its currency code. Must be a bare identifier
   * path (it becomes a Liquid filter argument; quotes would be corrupted).
   * On a list field keep it absolute (`order.currency_code`) — loops can read
   * the outer scope.
   */
  currencyKey?: string;
  /**
   * For `list`, the fields of one entry, keyed relative to it (`title` is
   * offered as `item.title` inside the block).
   */
  fields?: EmailTemplateVariable[];
  /**
   * For `list`, one entry's HTML using `{{ item.* }}` expressions: the
   * starting content of a newly inserted block. Reuse it in the default
   * template so the two match.
   */
  itemTemplate?: string;
}

export interface EmailTemplateSnippet {
  key: string;
  label: string;
  description?: string;
  /**
   * HTML to insert; its `{{ … }}` expressions become pills. Use `columns()`
   * for side-by-side cells so they stay reshapeable.
   */
  html: string;
}

export interface EmailEventDefaultTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailEventDefinition<TData = unknown> {
  event: string;
  templateKey: string;
  label: string;
  description?: string;
  /**
   * Picks between definitions sharing an event (e.g. admin vs customer
   * password resets). Required when an event has several definitions.
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
  snippets?: EmailTemplateSnippet[];
  defaultTemplate: EmailEventDefaultTemplate;
  getIdempotencyKey?: (data: TData) => string | undefined;
  getResource?: (data: TData) => {
    resource_id?: string;
    resource_type?: string;
  };
  /**
   * Configuration problems shown in the admin, as codes the dashboard turns
   * into text (e.g. a customer link without a storefront URL).
   *
   * Not only send-blocking ones: a password reset can't send without its link,
   * but an order confirmation still sends and merely loses `order_url`.
   */
  getWarnings?: (container: MedusaContainer) => string[];
}

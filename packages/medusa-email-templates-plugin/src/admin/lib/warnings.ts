/**
 * What each template warning code means, for the list and editor page.
 *
 * One cause can have different effects: a missing storefront URL blocks a
 * customer password reset but only costs the order confirmation its link.
 * `blocksSending` lets the UI say "cannot send" only when it's true.
 */
export type TemplateWarning = {
  text: string;
  blocksSending: boolean;
};

const WARNINGS: Record<string, TemplateWarning> = {
  storefront_url_not_configured: {
    text: 'No storefront URL is configured, so the link in this email cannot be built. It will not send until that is set.',
    blocksSending: true,
  },
  order_link_unavailable: {
    text: 'No storefront URL is configured, so the link to the order cannot be built. The email still sends, without it.',
    blocksSending: false,
  },
};

/**
 * The meaning of a code, or the raw code for an unknown one (e.g. from a host
 * event). Unknown codes aren't assumed to block sending.
 */
export const describeWarning = (code: string): TemplateWarning =>
  WARNINGS[code] ?? { text: code, blocksSending: false };

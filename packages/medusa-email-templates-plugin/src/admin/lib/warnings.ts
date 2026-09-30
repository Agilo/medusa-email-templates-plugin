/**
 * What a template warning means, for the list and the editor page alike.
 *
 * Warnings arrive as codes. A code says what is wrong *and* what follows from
 * it, because the same cause can have different consequences: a missing
 * storefront URL stops a customer's password reset outright, but only costs
 * the order confirmation its link. `blocksSending` is what lets the UI say
 * "cannot send" only when that is true.
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
 * The known meaning of a code, or the code itself for one a host event
 * reports that this admin build does not know. An unknown warning is not
 * assumed to stop sending — the definition's contract allows warnings that
 * don't — so it is shown without that claim.
 */
export const describeWarning = (code: string): TemplateWarning =>
  WARNINGS[code] ?? { text: code, blocksSending: false };

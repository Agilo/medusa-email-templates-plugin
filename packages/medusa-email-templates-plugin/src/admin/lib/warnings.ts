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

export const describeWarning = (code: string): TemplateWarning =>
  WARNINGS[code] ?? { text: code, blocksSending: false };

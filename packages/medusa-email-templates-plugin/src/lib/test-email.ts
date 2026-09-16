export const PROVIDER_TEST_TEMPLATE = 'email-templates-provider-test';
export const PROVIDER_TEST_TRIGGER = 'email-templates.provider-test';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Fixed content for the provider test email. */
export const buildProviderTestEmail = (transportLabel: string) => {
  const label = escapeHtml(transportLabel);

  return {
    subject: 'Test email from Medusa',
    html: `<!doctype html><html><body style="font-family:sans-serif;line-height:1.5"><h1 style="font-size:20px">Your email provider works</h1><p>This test email was sent through <strong>${label}</strong> by the Medusa Email Templates plugin.</p></body></html>`,
    text: `Your email provider works\n\nThis test email was sent through ${transportLabel} by the Medusa Email Templates plugin.`,
  };
};

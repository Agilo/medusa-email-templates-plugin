import type { EmailEventDefaultTemplate } from '../../types';

const layout = (heading: string, body: string): string => `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background-color:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px">
      <tbody>
        <tr>
          <td style="padding:24px">
            <h1 style="margin:0 0 16px;font-size:20px">${heading}</h1>
            ${body}
            <p style="margin:24px 0 0;color:#6b7280;font-size:12px">{{ store.name }}</p>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;

/**
 * A call to action, as both an email button and an editor one.
 *
 * An anchor, never a `<button>`: a button element navigates nowhere, does
 * nothing outside a form, and is dropped outright by Outlook's Word renderer.
 * This markup is what actually sends for a template nobody has customised —
 * `resolveTemplate` falls back to `defaultTemplate.html` — so it has to be
 * plain, inline-styled email HTML.
 *
 * `data-id="react-email-button"` is what makes the editor recognise it.
 * `@react-email/editor`'s Button node parses one selector,
 * `a[data-id="react-email-button"]`, and its `getAttrs` copies every attribute
 * off the element, so the href and the inline styling survive the trip. Drop
 * the attribute and the derived document degrades to a paragraph holding
 * link-marked text: still correct in the inbox, but the button's own inspector
 * and bubble menu never reach it.
 *
 * A `div` rather than a `p` around it, because the Button node is a block node
 * — inside a paragraph ProseMirror lifts it out and leaves the empty paragraph
 * behind. The margin lives there since the anchor is `inline-block` and cannot
 * carry the block spacing itself.
 */
const button = (url: string, label: string): string =>
  `<div style="margin:0 0 24px"><a data-id="react-email-button" href="${url}" style="display:inline-block;padding:10px 18px;background-color:#111827;color:#ffffff;text-decoration:none;border-radius:6px">${label}</a></div>`;

export const inviteCreatedDefaultTemplate: EmailEventDefaultTemplate = {
  subject: "You've been invited to {{ store.name }}",
  html: layout(
    "You've been invited",
    `<p style="margin:0 0 16px">You have been invited to join {{ store.name }} in Medusa Admin.</p>
            ${button('{{ invite_url }}', 'Accept the invitation')}
            <p style="margin:0;color:#6b7280;font-size:12px">This invitation expires on {{ invite.expires_at | date_long }}.</p>`,
  ),
};

export const inviteResentDefaultTemplate: EmailEventDefaultTemplate = {
  subject: 'Your invitation to {{ store.name }}',
  html: layout(
    'Here is your invitation again',
    `<p style="margin:0 0 16px">Your invitation to join {{ store.name }} in Medusa Admin was renewed.</p>
            ${button('{{ invite_url }}', 'Accept the invitation')}
            <p style="margin:0;color:#6b7280;font-size:12px">This invitation expires on {{ invite.expires_at | date_long }}.</p>`,
  ),
};

export const passwordResetUserDefaultTemplate: EmailEventDefaultTemplate = {
  subject: 'Reset your {{ store.name }} admin password',
  html: layout(
    'Reset your password',
    `<p style="margin:0 0 16px">We received a request to reset the password for {{ email }}.</p>
            ${button('{{ reset_url }}', 'Choose a new password')}
            <p style="margin:0;color:#6b7280;font-size:12px">If you did not request this, you can ignore this email.</p>`,
  ),
};

export const passwordResetCustomerDefaultTemplate: EmailEventDefaultTemplate = {
  subject: 'Reset your {{ store.name }} password',
  html: layout(
    'Reset your password',
    `<p style="margin:0 0 16px">We received a request to reset the password for {{ email }}.</p>
            ${button('{{ reset_url }}', 'Choose a new password')}
            <p style="margin:0;color:#6b7280;font-size:12px">If you did not request this, you can ignore this email.</p>`,
  ),
};

export const emailVerificationDefaultTemplate: EmailEventDefaultTemplate = {
  subject: 'Your {{ store.name }} verification code',
  html: layout(
    'Verify your email address',
    `<p style="margin:0 0 16px">Use this code to verify {{ email }}:</p>
            <p style="margin:0 0 24px;font-size:28px;font-weight:600;letter-spacing:4px">{{ code }}</p>
            <p style="margin:0;color:#6b7280;font-size:12px">The code expires on {{ expires_at | date_long }}.</p>`,
  ),
};

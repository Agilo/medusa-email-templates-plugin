import type { EmailEventDefaultTemplate } from '../../types';
import { EMAIL_DESIGN, layout, NO_THEME_SPACING } from './design';

/**
 * A call-to-action button that works in email and in the editor.
 *
 * - An `<a>`, not a `<button>`, which navigates nowhere and which Outlook
 *   drops. This HTML sends as-is for uncustomised templates.
 * - `data-id="react-email-button"` makes the editor parse it as a Button node
 *   (keeping href and styles); without it, it becomes plain link text.
 * - Wrapped in a `div`, not a `p`: the Button is a block node, and a paragraph
 *   would be left empty. The div carries the margin.
 * - Longhand padding, because the theme's longhand button padding overrides a
 *   shorthand on export; longhand keeps the size after a save.
 */
const button = (url: string, label: string): string =>
  `<div style="margin:0 0 24px"><a data-id="react-email-button" href="${url}" style="display:inline-block;padding-top:10px;padding-right:18px;padding-bottom:10px;padding-left:18px;background-color:${EMAIL_DESIGN.textColor};color:${EMAIL_DESIGN.cardBackground};text-decoration:none;border-radius:6px">${label}</a></div>`;

export const inviteCreatedDefaultTemplate: EmailEventDefaultTemplate = {
  subject: "You've been invited to {{ store.name }}",
  html: layout(
    "You've been invited",
    `<p style="margin:0 0 16px;${NO_THEME_SPACING}">You have been invited to join {{ store.name }} in Medusa Admin.</p>
            ${button('{{ invite_url }}', 'Accept the invitation')}
            <p style="margin:0;${NO_THEME_SPACING};color:${EMAIL_DESIGN.mutedColor};font-size:12px">This invitation expires on {{ invite.expires_at | date_long }}.</p>`,
  ),
};

export const inviteResentDefaultTemplate: EmailEventDefaultTemplate = {
  subject: 'Your invitation to {{ store.name }}',
  html: layout(
    'Here is your invitation again',
    `<p style="margin:0 0 16px;${NO_THEME_SPACING}">Your invitation to join {{ store.name }} in Medusa Admin was renewed.</p>
            ${button('{{ invite_url }}', 'Accept the invitation')}
            <p style="margin:0;${NO_THEME_SPACING};color:${EMAIL_DESIGN.mutedColor};font-size:12px">This invitation expires on {{ invite.expires_at | date_long }}.</p>`,
  ),
};

export const passwordResetUserDefaultTemplate: EmailEventDefaultTemplate = {
  subject: 'Reset your {{ store.name }} admin password',
  html: layout(
    'Reset your password',
    `<p style="margin:0 0 16px;${NO_THEME_SPACING}">We received a request to reset the password for {{ email }}.</p>
            ${button('{{ reset_url }}', 'Choose a new password')}
            <p style="margin:0;${NO_THEME_SPACING};color:${EMAIL_DESIGN.mutedColor};font-size:12px">If you did not request this, you can ignore this email.</p>`,
  ),
};

export const passwordResetCustomerDefaultTemplate: EmailEventDefaultTemplate = {
  subject: 'Reset your {{ store.name }} password',
  html: layout(
    'Reset your password',
    `<p style="margin:0 0 16px;${NO_THEME_SPACING}">We received a request to reset the password for {{ email }}.</p>
            ${button('{{ reset_url }}', 'Choose a new password')}
            <p style="margin:0;${NO_THEME_SPACING};color:${EMAIL_DESIGN.mutedColor};font-size:12px">If you did not request this, you can ignore this email.</p>`,
  ),
};

export const emailVerificationDefaultTemplate: EmailEventDefaultTemplate = {
  subject: 'Your {{ store.name }} verification code',
  html: layout(
    'Verify your email address',
    `<p style="margin:0 0 16px;${NO_THEME_SPACING}">Use this code to verify {{ email }}:</p>
            <p style="margin:0 0 24px;${NO_THEME_SPACING};font-size:28px;font-weight:600;letter-spacing:4px">{{ code }}</p>
            <p style="margin:0;${NO_THEME_SPACING};color:${EMAIL_DESIGN.mutedColor};font-size:12px">The code expires on {{ expires_at | date_long }}.</p>`,
  ),
};

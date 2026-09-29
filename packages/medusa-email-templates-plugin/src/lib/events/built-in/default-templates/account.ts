import type { EmailEventDefaultTemplate } from '../../types';
import { EMAIL_DESIGN, layout, NO_THEME_SPACING } from './design';

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
 *
 * The padding is longhand, and has to be. React Email's `Button` runs
 * `parsePadding` over the style it is given and re-emits the four longhand
 * properties *after* spreading that style, and `parsePadding` lets a longhand
 * key override whatever the `padding` shorthand set. The editor's theme
 * supplies button padding in longhand, so it always lands last and a shorthand
 * here never reaches the sent email — `padding: 30px 40px` exports at the
 * theme's size exactly as `10px 18px` does. Written this way the value is
 * carried into the export and shown in the inspector's Spacing section, so a
 * template that is opened and saved keeps the button it had rather than
 * quietly resizing to the theme default.
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

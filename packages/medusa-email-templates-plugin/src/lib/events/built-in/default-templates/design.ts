/**
 * The one description of how a default email looks.
 *
 * Two things render these templates and they used to disagree. The HTML below
 * is what sends for a template nobody has customised; the visual editor draws
 * the same email from `EmailTheming`, and exports it again on save. With the
 * numbers written out in both places, opening a template and saving it
 * silently restyled the email — white instead of grey, square instead of
 * rounded, and every edge of text against the card.
 *
 * So the values live here, `layout` builds the HTML from them, and the editor
 * builds its theme from them. Agreement is then a property of the code rather
 * than of somebody remembering to change two files.
 *
 * Imported by both the server and the admin bundle, so it must stay free of
 * imports: the admin tsconfig has no Node types.
 */
export const EMAIL_DESIGN = {
  /** Behind the card. */
  pageBackground: '#f6f6f6',
  cardBackground: '#ffffff',
  /** Body text, and everything that does not set its own colour. */
  textColor: '#111827',
  /** Quieter text: the footer, and dates beneath a call to action. */
  mutedColor: '#6b7280',
  cardWidth: 600,
  cardRadius: 8,
  cardPadding: 24,
  /** Above and below the card. */
  pageGutter: 24,
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
} as const;

/**
 * The gutter as a margin on the card, not padding on the `<body>`.
 *
 * Not a stylistic choice — body padding cannot be themed. `RESET_BASIC.reset`
 * carries `padding: "0"` and is applied to the body after the theme, so any
 * value set there exports as zero whatever form it takes. A margin on the card
 * survives, and is the closest thing the editor can reproduce.
 *
 * The visible difference from padding is on a narrow screen: the card runs
 * edge to edge instead of keeping a strip of page either side, because it is
 * `width: 100%` and auto margins have nothing to take from.
 */
export const CARD_MARGIN = `${EMAIL_DESIGN.pageGutter}px auto`;

/**
 * Wraps body content in the card.
 *
 * A table rather than a div, because Outlook's Word renderer ignores
 * `max-width` on a block element and the email would run the full width of the
 * window.
 */
export const layout = (
  heading: string,
  body: string,
): string => `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:${EMAIL_DESIGN.pageBackground};font-family:${EMAIL_DESIGN.fontFamily};color:${EMAIL_DESIGN.textColor}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${EMAIL_DESIGN.cardWidth}px;margin:${CARD_MARGIN};background-color:${EMAIL_DESIGN.cardBackground};border-radius:${EMAIL_DESIGN.cardRadius}px">
      <tbody>
        <tr>
          <td style="padding:${EMAIL_DESIGN.cardPadding}px">
            <h1 style="margin:0 0 16px;font-size:20px">${heading}</h1>
            ${body}
            <p style="margin:24px 0 0;color:${EMAIL_DESIGN.mutedColor};font-size:12px">{{ store.name }}</p>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;

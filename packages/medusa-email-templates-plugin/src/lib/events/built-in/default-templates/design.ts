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
  /**
   * Page showing above and below the card.
   *
   * Deliberately smaller than `cardPadding`. There is no matching value to the
   * sides — the card is centred with `auto` margins, so the space there is
   * whatever the viewport has left over, from nothing in a narrow preview to
   * a hundred pixels or more in a desktop client. A tall gutter reads as a gap
   * rather than a frame next to that.
   */
  pageGutter: 8,
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
} as const;

/**
 * The gutter as a margin on the card, and horizontal centring.
 *
 * Padding on the `<body>` would be the obvious way and cannot be used:
 * `RESET_BASIC.reset` carries `padding: "0"` and is applied after the theme,
 * so every form of it exports as zero.
 *
 * The canvas draws this margin above the card but not below, so the card reads
 * as sitting slightly low rather than framed. That is a canvas limitation, not
 * a fault in the email: an iframe or a mail client gives the body a real
 * viewport, the page colour fills it, and both bands appear — which is what
 * the preview shows.
 *
 * Kept in spite of that, because the canvas is an approximation either way. It
 * already cannot show the page colour running past the end of the content, for
 * the same reason. Trading a band of space in every email that actually sends
 * for exactness in the editor is the wrong way round.
 */
export const CARD_MARGIN = `${EMAIL_DESIGN.pageGutter}px auto`;

/**
 * Marks a table as a row of columns the editor may reshape.
 *
 * The editor's Table node is for keeping imported HTML intact: it has no way
 * to add or remove a column. Its Columns layout does — Backspace in an empty
 * column removes it — but parses only from its own `div[data-type]` markup,
 * which is no layout at all in a mail client. A default template is sent
 * as-is until someone edits it, so it has to stay a table; this attribute is
 * what tells `deriveEditorContent` to open that table as Columns.
 */
export const COLUMNS_ATTRIBUTE = 'data-columns';

/** One cell of a `columns` row: its content, and optional inline style. */
export type ColumnCell = { html: string; style?: string };

/**
 * Two to four cells side by side, as a table every mail client lays out the
 * same way, which the editor opens as an editable Columns layout.
 *
 * Alignment belongs on the content (`<p style="text-align:right">`), not the
 * cell: a column carries a style but has no `align` of its own to keep.
 */
export const columns = (cells: ColumnCell[]): string =>
  `<table ${COLUMNS_ATTRIBUTE}="" role="presentation" width="100%" cellpadding="0" cellspacing="0"><tbody><tr>${cells
    .map(
      ({ html, style }) =>
        `<td${style ? ` style="${style}"` : ''}>${html}</td>`,
    )
    .join('')}</tr></tbody></table>`;

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

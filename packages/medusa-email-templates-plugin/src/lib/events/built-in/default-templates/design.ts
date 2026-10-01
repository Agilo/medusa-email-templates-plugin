/**
 * The single source for how a default email looks.
 *
 * `layout` builds the default HTML from these values and the editor builds
 * its theme from them, so opening and saving a template never restyles it.
 *
 * Imported by the server and the admin bundle, so it must have no imports
 * (the admin tsconfig has no Node types).
 */
export const EMAIL_DESIGN = {
  pageBackground: '#f6f6f6',
  cardBackground: '#ffffff',
  textColor: '#111827',
  mutedColor: '#6b7280',
  cardWidth: 600,
  cardRadius: 8,
  cardPadding: 24,
  pageGutter: 8,
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
} as const;

/**
 * The gutter as a card margin, plus horizontal centring. Mail clients keep it
 * only because the card sits in a table cell (see `PAGE_ATTRIBUTE`).
 */
export const CARD_MARGIN = `${EMAIL_DESIGN.pageGutter}px auto`;

/**
 * Marks the table that paints the page colour around the card.
 *
 * Needed for Gmail, which turns `<body>` into an unpadded `<div>`: the card's
 * vertical margins would collapse through it, losing the gutter. Inside a
 * table cell they can't (the editor's export already works this way).
 *
 * `deriveEditorContent` unwraps it before parsing; otherwise the editor would
 * open the whole email as one Table node.
 */
export const PAGE_ATTRIBUTE = 'data-page';

/**
 * Marks a table that the editor should open as a Columns layout.
 *
 * The editor's Table node can't add or remove columns; its Columns layout
 * can, but only parses its own `div` markup, which mail clients don't lay
 * out. So default templates send a table, and `deriveEditorContent` converts
 * tables with this attribute.
 */
export const COLUMNS_ATTRIBUTE = 'data-columns';

export type ColumnCell = { html: string; style?: string };

export const columns = (cells: ColumnCell[]): string =>
  `<table ${COLUMNS_ATTRIBUTE}="" role="presentation" width="100%" cellpadding="0" cellspacing="0"><tbody><tr>${cells
    .map(
      ({ html, style }) =>
        `<td${style ? ` style="${style}"` : ''}>${html}</td>`,
    )
    .join('')}</tr></tbody></table>`;

/**
 * Zeroes the editor theme's spacing on a text block.
 *
 * The theme pads paragraphs 0.5em top and bottom and headings 0.389em top.
 * Once a template is saved from the editor, that stacks on the margins set
 * here and roughly triples the gaps. Longhand, to override the theme's
 * longhands.
 */
export const NO_THEME_SPACING = 'padding-top:0;padding-bottom:0';

/**
 * Wraps body content in the card.
 *
 * The card is a table because Outlook ignores `max-width` on block elements.
 * It sits in a full-width page table (see `PAGE_ATTRIBUTE`), matching the
 * editor's export, so a template sends the same whether or not it was saved.
 */
export const layout = (
  heading: string,
  body: string,
): string => `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:${EMAIL_DESIGN.pageBackground};font-family:${EMAIL_DESIGN.fontFamily};color:${EMAIL_DESIGN.textColor}">
    <table ${PAGE_ATTRIBUTE}="" role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tbody>
        <tr>
          <td style="background-color:${EMAIL_DESIGN.pageBackground}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${EMAIL_DESIGN.cardWidth}px;margin:${CARD_MARGIN};background-color:${EMAIL_DESIGN.cardBackground};border-radius:${EMAIL_DESIGN.cardRadius}px">
              <tbody>
                <tr>
                  <td style="padding:${EMAIL_DESIGN.cardPadding}px">
                    <h1 style="margin:0 0 16px;${NO_THEME_SPACING};font-size:24px">${heading}</h1>
                    ${body}
                    <p style="margin:24px 0 0;${NO_THEME_SPACING};color:${EMAIL_DESIGN.mutedColor};font-size:12px">{{ store.name }}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;

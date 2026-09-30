import { composeReactEmail } from '@react-email/editor/core';
import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming, extendTheme } from '@react-email/editor/plugins';
import {
  BubbleMenu,
  defaultSlashCommands,
  Inspector,
  SlashCommand,
} from '@react-email/editor/ui';
// Already inlines bubble-menu.css, slash-command.css and inspector.css;
// importing those too would duplicate their rules.
import '@react-email/editor/themes/default.css';
import { EditorContent, EditorContext, useEditor } from '@tiptap/react';
import { forwardRef, useImperativeHandle, useMemo, type FC } from 'react';

import {
  CARD_MARGIN,
  EMAIL_DESIGN,
} from '../../../lib/events/built-in/default-templates/design';
import type { EmailTemplateDetail } from '../../lib/types';
import { isLiquidUrl, validateUrl } from '../../lib/liquid-url';
import { deriveEditorContent } from './derive-document';
import { LinkTextInspector } from './link-inspector';
import { RepeatNode } from './repeat-node';
import { repeatSlashCommands } from './repeat-slash-command';
import { snippetSlashCommands } from './snippet-slash-command';
import { claimLinkShortcut } from './search-shortcut';
import { VariableBubbleMenu } from './variable-bubble-menu';
import { VariableInspector } from './variable-inspector';
import { VariableNode } from './variable-node';
import { variableSlashCommand } from './variable-slash-command';

export type EmailTemplateBody = {
  html_template: string;
  editor_content: Record<string, unknown>;
};

export type EmailTemplateEditorHandle = {
  /** Exports the body for saving. Throws if the editor has not mounted yet. */
  getBody: () => Promise<EmailTemplateBody>;
};

type EmailTemplateEditorProps = {
  template: EmailTemplateDetail;
  onDirty: () => void;
};

/**
 * Its declared return type includes `bigint`, valid in React 19 but not 18, so
 * TypeScript rejects it as a JSX component. The runtime value is fine.
 */
const InspectorBreadcrumb = Inspector.Breadcrumb as unknown as FC;

/**
 * Canvas and export theme, built from the same `design.ts` values as the
 * default templates. With plain `basic` (white, square, unpadded), opening and
 * saving a template would silently restyle it.
 */
export const EMAIL_THEME = extendTheme('basic', {
  body: { backgroundColor: EMAIL_DESIGN.pageBackground },
  container: {
    backgroundColor: EMAIL_DESIGN.cardBackground,
    color: EMAIL_DESIGN.textColor,
    width: EMAIL_DESIGN.cardWidth,
    borderRadius: EMAIL_DESIGN.cardRadius,
    margin: CARD_MARGIN,
    /*
     * Both forms are needed. The export reads the longhands (the theme's
     * defaults are longhand zeros). The Inspector reads only `padding`;
     * without it the panel shows the global default of 8 and editing it would
     * write a shorthand over the longhands.
     */
    padding: EMAIL_DESIGN.cardPadding,
    paddingTop: EMAIL_DESIGN.cardPadding,
    paddingRight: EMAIL_DESIGN.cardPadding,
    paddingBottom: EMAIL_DESIGN.cardPadding,
    paddingLeft: EMAIL_DESIGN.cardPadding,
  },
});

/*
 * The Inspector panel, plus patches for gaps in the library's stylesheet.
 *
 * Must be classes: the host never loads a plugin's CSS file, so arbitrary
 * variants are the only way to reach the library's internals.
 *
 *  - Text inputs lack the `background`/`border` reset other controls get, so
 *    their user-agent fill paints over the wrapper's rounded edge. `min-w-0`
 *    stops a hex string refusing to shrink past the right border.
 *  - Wrappers have a fixed `height: 1.6rem` and no `overflow`; clip them, as
 *    the library already does for `[data-re-inspector-toggle-group]`.
 *  - The unit label (`px`) shares the colour swatch's
 *    `width/height: 1rem; aspect-ratio: 1/2`. All three must be released
 *    together, or the ratio makes the span tall and misaligns the text. It
 *    also needs `text-xs`, or it renders larger outside a prop row (e.g. in
 *    Spacing).
 *  - Inputs are capped at `max-width: 3.5rem`. The link URL field opts out by
 *    its own attribute; `w-full` spans the row and `min-w-0` lets a long href
 *    shrink instead of overflowing.
 */
const INSPECTOR_CLASS = [
  'bg-ui-bg-base border-ui-border-base w-64 shrink-0 overflow-y-auto border-l p-4',
  '[&_[data-re-inspector-input]]:bg-transparent [&_[data-re-inspector-input]]:border-0 [&_[data-re-inspector-input]]:min-w-0',
  '[&_[data-re-inspector-color-hex]]:bg-transparent [&_[data-re-inspector-color-hex]]:border-0 [&_[data-re-inspector-color-hex]]:min-w-0',
  '[&_[data-re-inspector-number]]:overflow-hidden [&_[data-re-inspector-color-control]]:overflow-hidden [&_[data-re-inspector-select]]:overflow-hidden',
  '[&_[data-re-inspector-unit]]:text-xs [&_[data-re-inspector-unit]]:w-auto [&_[data-re-inspector-unit]]:h-auto [&_[data-re-inspector-unit]]:aspect-auto',
  '[&_[data-link-url-control]]:w-full [&_[data-link-url-control]]:min-w-0',
  '[&_[data-link-url]]:max-w-none [&_[data-link-url]]:w-full',
].join(' ');

/*
 * The canvas.
 *
 * `mx-auto` centres the card. Its 600px width comes from a rule `EmailTheming`
 * injects at runtime, and nothing in the theme sets a competing margin.
 *
 * `flow-root` keeps the card's bottom margin inside `.ProseMirror`, so the
 * page colour frames it top and bottom. Without it that margin collapses
 * through its unpadded parent (the top one survives only because a hidden
 * `globalContent` div sits above the card). It lives here, not in the theme,
 * because theme body styles are exported into the email.
 *
 * Selectors use attributes (`data-type`, `data-editor-theme-scope`), not
 * classes: the safelist extractor drops bracket variants containing `.`.
 */
const CANVAS_CLASS = [
  'p-6',
  '[&_[data-type=container]]:mx-auto',
  '[&_[data-editor-theme-scope]]:flow-root',
].join(' ');

/**
 * The visual editor. Loaded lazily so `@react-email/editor` (and all of
 * `react-email`) stays out of other admin routes' bundles.
 */
const EmailTemplateEditor = forwardRef<
  EmailTemplateEditorHandle,
  EmailTemplateEditorProps
>(({ template, onDirty }, ref) => {
  // Shared with `deriveEditorContent`: a document generated against a
  // different schema throws on `nodeFromJSON`.
  const extensions = useMemo(
    () => [
      /*
       * Allow Liquid hrefs such as `{{ invite_url }}`, which the stock check
       * rejects for lacking a scheme. Everything else still goes through
       * `ctx.defaultValidate`, so `javascript:` stays blocked.
       */
      StarterKit.configure({
        Link: {
          isAllowedUri: (url, ctx) =>
            isLiquidUrl(url) || ctx.defaultValidate(url),
        },
      }),
      EmailTheming.configure({ theme: EMAIL_THEME }),
      VariableNode.configure({ variables: template.variables }),
      // Reads the lists for its label; pills inside read their fields.
      RepeatNode.configure({ variables: template.variables }),
    ],
    [template.variables],
  );

  /*
   * Without `editor_content`, derive the document from HTML rather than open
   * blank (saving a blank canvas would wipe the email). Use the stored HTML if
   * any, else the default — the same order a real send uses, so the canvas
   * shows what actually goes out.
   *
   * The derived document is not persisted until someone edits, so it cannot
   * go stale.
   */
  const sourceHtml = template.html_template ?? template.default_template.html;

  const content = useMemo(() => {
    if (template.editor_content) {
      return template.editor_content;
    }

    try {
      return deriveEditorContent(sourceHtml, extensions);
    } catch {
      // Defensive and untested: no known input makes the parser throw, but a
      // blank body beats crashing the page on a host's arbitrary HTML.
      return '';
    }
  }, [template.editor_content, sourceHtml, extensions]);

  const editor = useEditor({
    extensions,
    content,
    // Client-only SPA: no hydration to guard against, so create immediately.
    immediatelyRender: true,
    // Cmd/Ctrl-K makes a link instead of opening the dashboard search.
    editorProps: { handleDOMEvents: { keydown: claimLinkShortcut } },
    /*
     * Seeding fires its own updates, so only changes after initialisation
     * count as edits; otherwise the page opens dirty. `EmailTheming` seeds
     * synchronously, before TipTap sets `isInitialized`.
     *
     * Not `isFocused`: Inspector edits happen while focus is in the panel, and
     * they must still mark the page dirty.
     */
    onUpdate: ({ editor: instance, transaction }) => {
      if (
        transaction.docChanged &&
        instance.isEditable &&
        instance.isInitialized
      ) {
        onDirty();
      }
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      getBody: async () => {
        if (!editor) {
          throw new Error('The editor is still loading.');
        }

        const composed = await composeReactEmail({ editor });

        return {
          // Not `html`: its Prettier formatting bloats nested tables for no
          // benefit in a mail client.
          html_template: composed.unformattedHtml,
          editor_content: editor.getJSON() as Record<string, unknown>,
        };
      },
    }),
    [editor],
  );

  const slashCommands = useMemo(
    () => [
      ...defaultSlashCommands,
      variableSlashCommand(template.variables),
      ...repeatSlashCommands(template.variables),
      ...snippetSlashCommands(template.snippets),
    ],
    [template.variables, template.snippets],
  );

  if (!editor) {
    return null;
  }

  return (
    <EditorContext.Provider value={{ editor }}>
      <div className="flex min-h-[32rem]">
        <div className="min-w-0 flex-1">
          {/* The theme's `align: "center"` only affects the export, not the
              canvas — hence `mx-auto` in `CANVAS_CLASS`. */}
          <EditorContent editor={editor} className={CANVAS_CLASS} />
        </div>

        {/* `border-ui-border-base` makes the border follow dark mode instead
            of preflight's fixed #e5e7eb. */}
        <Inspector.Root className={INSPECTOR_CLASS}>
          <InspectorBreadcrumb />
          <Inspector.Document />
          {/* Stands in for `Inspector.Node`: variables get their own panel,
              every other node type keeps the library's default sections. */}
          <VariableInspector variables={template.variables} />
          {/* Stands in for `Inspector.Text`, whose link URL field is
              read-only. */}
          <LinkTextInspector variables={template.variables} />
        </Inspector.Root>
      </div>

      {/* Hidden for variables, which get `VariableBubbleMenu` instead. */}
      <BubbleMenu
        hideWhenActiveNodes={['button', 'variable']}
        hideWhenActiveMarks={['link']}
      />
      <VariableBubbleMenu />
      {/* Stock menus for editing, opening or removing an existing link.
          Picking a variable URL happens in the Inspector (see
          `link-inspector.tsx`). `validateUrl` lets these accept Liquid rather
          than clearing `{{ invite_url }}`. */}
      <BubbleMenu.LinkDefault validateUrl={validateUrl} />
      <BubbleMenu.ButtonDefault validateUrl={validateUrl} />
      <SlashCommand items={slashCommands} />
    </EditorContext.Provider>
  );
});

EmailTemplateEditor.displayName = 'EmailTemplateEditor';

export default EmailTemplateEditor;

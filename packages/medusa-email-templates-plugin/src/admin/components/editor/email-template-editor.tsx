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
      return '';
    }
  }, [template.editor_content, sourceHtml, extensions]);

  const editor = useEditor({
    extensions,
    content,
    immediatelyRender: true,
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
          <EditorContent editor={editor} className={CANVAS_CLASS} />
        </div>

        <Inspector.Root className={INSPECTOR_CLASS}>
          <InspectorBreadcrumb />
          <Inspector.Document />
          <VariableInspector variables={template.variables} />
          <LinkTextInspector variables={template.variables} />
        </Inspector.Root>
      </div>

      <BubbleMenu
        hideWhenActiveNodes={['button', 'variable']}
        hideWhenActiveMarks={['link']}
      />
      <VariableBubbleMenu />
      <BubbleMenu.LinkDefault validateUrl={validateUrl} />
      <BubbleMenu.ButtonDefault validateUrl={validateUrl} />
      <SlashCommand items={slashCommands} />
    </EditorContext.Provider>
  );
});

EmailTemplateEditor.displayName = 'EmailTemplateEditor';

export default EmailTemplateEditor;

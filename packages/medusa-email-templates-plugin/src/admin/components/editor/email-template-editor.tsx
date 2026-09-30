import { composeReactEmail } from '@react-email/editor/core';
import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming, extendTheme } from '@react-email/editor/plugins';
import {
  BubbleMenu,
  defaultSlashCommands,
  Inspector,
  SlashCommand,
} from '@react-email/editor/ui';
// Layer 0 of this stylesheet inlines bubble-menu.css, slash-command.css and
// inspector.css at build time, so importing those subpaths as well would only
// duplicate their rules.
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
 * Declared returning a union that includes `bigint`, which React 19's
 * `ReactNode` admits but React 18's does not, so TypeScript rejects it as a
 * JSX component. Only the declared type is out of step with the React version
 * we build against; the runtime value is an ordinary component.
 */
const InspectorBreadcrumb = Inspector.Breadcrumb as unknown as FC;

/**
 * The canvas and the export, drawn from the same numbers as the default
 * templates.
 *
 * Left alone, `basic` renders a white page with square corners, black text and
 * no padding at all — so opening a template and saving it replaced the design
 * the HTML described with the library's defaults, without touching a thing.
 * `design.ts` holds the values; this hands them to the editor.
 *
 * `body` gets the page colour but no padding, because it cannot have any:
 * `RESET_BASIC.reset` carries `padding: "0"` and is applied after the theme,
 * so every form of it exports as zero. The gutter is a margin on the card
 * instead, which is what `layout` writes too.
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
     * Both forms, and both are needed.
     *
     * The longhands are what the export reads — the theme's own defaults are
     * longhand zeros, and a shorthand alone lands after them only by luck of
     * declaration order. The shorthand is what the *panel* reads:
     * `InspectorDocumentDefaults` looks up `padding` and nothing else, so with
     * longhands alone it finds no value, falls back to the global default of
     * 8, and shows a number the email never had. Worse, editing that field
     * writes a shorthand that would then override the longhands.
     */
    padding: EMAIL_DESIGN.cardPadding,
    paddingTop: EMAIL_DESIGN.cardPadding,
    paddingRight: EMAIL_DESIGN.cardPadding,
    paddingBottom: EMAIL_DESIGN.cardPadding,
    paddingLeft: EMAIL_DESIGN.cardPadding,
  },
});

/*
 * The panel, plus patches for gaps in the library's own stylesheet.
 *
 * These have to be classes. A stylesheet cannot reach the host: the plugin
 * build does emit `index.css`, but nothing imports it — the host writes and
 * loads its own, and `admin-vite-plugin` never reads a plugin's CSS. So
 * arbitrary variants on this element are the only way to reach the library's
 * internals, which is why the list below is longer than it looks like it
 * should be.
 *
 * Each group fixes something the library declares for one element and forgets
 * for another:
 *
 *  - The text inputs get `font-size`, `padding` and `max-width` but never a
 *    `background` or `border` reset, unlike every other control in that file
 *    (toggles, buttons, the breadcrumb). They keep their user-agent fill and
 *    border, which then paints over the wrapper's rounded edge. `min-w-0`
 *    goes with it: a flex item defaults to `min-width: auto`, so a monospace
 *    hex string refuses to shrink and pushes through the right border.
 *
 *  - The wrappers have a fixed `height: 1.6rem` and no `overflow`, so
 *    anything taller escapes them. Clipping mirrors what the library already
 *    does for `[data-re-inspector-toggle-group]`.
 *
 *  - The unit label (`px`) shares one rule with the colour swatch, so it is
 *    handed `width: 1rem; height: 1rem; aspect-ratio: 1/2` — a box built for
 *    a swatch, which two characters cannot fit.
 *
 *    All three have to be released together. With only the width and height
 *    set to auto, the ratio stops being ignored and starts governing: the
 *    span becomes twice as tall as it is wide, and `align-items: center`
 *    centres that tall box while the text sits at the top of it.
 *
 *    The label also has no `font-size` of its own, while the number beside it
 *    is pinned at 0.75rem — so it inherits the ambient size and renders
 *    larger in any section that is not a `[data-re-inspector-prop-row]`.
 *    Spacing is exactly that: `PaddingSection` renders straight into
 *    `PaddingPicker` with no `PropRow`, which is why `px` looked bigger there
 *    than in Typography.
 *
 *    No line-height override: `text-xs` already carries `1rem`, and the
 *    wrapper's own `align-items: center` does the centring.
 *
 *  - `[data-re-inspector-input]` is capped at `max-width: 3.5rem`, which fits
 *    a number and nothing else. The URL field in `link-inspector.tsx` is the
 *    one input here holding a full href, so it opts out by its own attribute
 *    rather than by widening every input in the panel. Its shell is
 *    `inline-flex` and would otherwise size to its content; `w-full` spans
 *    the stacked row instead, and `min-w-0` is what lets it shrink, since a
 *    flex item defaults to `min-width: auto` and a long href would push
 *    straight through the panel's edge.
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
 * The canvas, plus a frame around the email itself.
 *
 * The container is a real 600px block, but nothing in the markup says so:
 * `EmailTheming` injects `<scope> .node-container { width: 600px }` at
 * runtime, keyed off the `data-editor-theme-scope` attribute it sets on the
 * editor. Hence the width never appears on the element.
 *
 * `mx-auto` centres it. Nothing competes: the theme's container group has no
 * margin prop, `RESET_BASIC.container` is `{}`, and `container` is absent from
 * `RESET_NODE_TYPES`, so it is not handed the universal `margin: 0` reset.
 *
 * The dashed frame is ours — the library draws no outline around the email.
 * `border-ui-border-base` is worth knowing about: Medusa already applies
 * `* { border-color: var(--border-base) }`, so this class restates the colour
 * the border would have anyway. It is written out to say so deliberately
 * rather than relying on a global, but it is why the frame looks so faint —
 * `--border-base` is #e4e4e7. `border-ui-border-strong` (#d4d4d8) is the one
 * neutral step up if it should read more clearly.
 */
/*
 * `flow-root` is what makes the page colour frame the card top *and* bottom.
 *
 * The theme paints the body styles onto `.ProseMirror` itself, and the card is
 * its child carrying `margin: 24px auto`. That element is handed the theme's
 * reset — `padding: 0`, no border, height auto — which is exactly the shape in
 * which a child's margins collapse through their parent.
 *
 * Only the bottom one does, though, and the asymmetry is worth writing down
 * because it looks like a bug either way. The editor inserts a hidden 1px
 * `[data-type=globalContent]` div as the first child, so the card's top margin
 * has a sibling above it and stays inside; the card *is* the last child, so
 * its bottom margin escapes and the page colour stops at the card's edge.
 *
 * `flow-root` gives `.ProseMirror` a block formatting context, which keeps
 * both margins in. It sits here rather than in the theme deliberately: the
 * theme's body styles are exported into the sent email, and this is a canvas
 * problem — a mail client gives the body a real viewport and draws both bands
 * without help.
 *
 * Selected by `data-editor-theme-scope`, the attribute the theming plugin puts
 * on the editor. Not `.ProseMirror`: the safelist extractor's bracket-variant
 * pattern admits no `.`, so a class selector is silently truncated and the
 * rule never generated.
 */
const CANVAS_CLASS = [
  'p-6',
  '[&_[data-type=container]]:mx-auto',
  '[&_[data-editor-theme-scope]]:flow-root',
].join(' ');

/**
 * The visual editor.
 *
 * Loaded lazily by the page: this module pulls in `@react-email/editor`, and
 * with it the whole `react-email` package, which should not land in any other
 * admin route's bundle.
 */
const EmailTemplateEditor = forwardRef<
  EmailTemplateEditorHandle,
  EmailTemplateEditorProps
>(({ template, onDirty }, ref) => {
  /*
   * Built once and shared, because the derived document has to be generated
   * against the very schema the editor will load it into. Two separately
   * assembled arrays could drift, and a document generated against one schema
   * throws on `nodeFromJSON` in another.
   */
  const extensions = useMemo(
    () => [
      /*
       * `Link` is reconfigured because a link's href may be Liquid. `setLink`
       * returns false *before* applying the mark when `isAllowedUri` rejects
       * the value, and the stock check demands a known scheme — so
       * `{{ invite_url }}` silently never became a link at all.
       *
       * `ctx.defaultValidate` is the stock check, so everything that is not
       * Liquid keeps its existing rules and `javascript:` stays blocked.
       */
      StarterKit.configure({
        Link: {
          isAllowedUri: (url, ctx) =>
            isLiquidUrl(url) || ctx.defaultValidate(url),
        },
      }),
      EmailTheming.configure({ theme: EMAIL_THEME }),
      // Each pill resolves its own label from this list, so the canvas shows
      // "Total | Money" rather than the generated Liquid.
      VariableNode.configure({ variables: template.variables }),
      // Reads the lists for its label; pills inside read their fields.
      RepeatNode.configure({ variables: template.variables }),
    ],
    [template.variables],
  );

  /*
   * A template with no `editor_content` is derived from its HTML rather than
   * opening blank. Blank was the dangerous state: the canvas looked empty, the
   * first keystroke marked it dirty, and saving then exported that blankness
   * over a designed email.
   *
   * The stored HTML when there is one — saved through the API, say — and the
   * event's default otherwise. The same order a real send resolves them in,
   * so the canvas shows the email that actually goes out. Deriving from the
   * default alone opened the built-in email over a customised one, and the
   * next body save replaced the custom HTML with it.
   *
   * Nothing derived is persisted. `editor_content` stays null until someone
   * actually edits, so a derived document cannot go stale against HTML that
   * changed underneath it.
   */
  const sourceHtml = template.html_template ?? template.default_template.html;

  const content = useMemo(() => {
    if (template.editor_content) {
      return template.editor_content;
    }

    try {
      return deriveEditorContent(sourceHtml, extensions);
    } catch {
      /*
       * Untested, and kept deliberately. Empty strings, bare text, unclosed
       * tags, malformed markup and script tags all parse into a document
       * rather than throwing, so no input has been found that reaches this
       * branch. It guards a third-party parser running over a host
       * application's arbitrary HTML, where a blank body beats a white
       * settings page.
       */
      return '';
    }
  }, [template.editor_content, sourceHtml, extensions]);

  const editor = useEditor({
    extensions,
    content,
    // The admin is a client-only Vite SPA, so there is no hydration to guard
    // against. `false` would defer creation to an effect and cost an extra
    // render for nothing.
    immediatelyRender: true,
    // Cmd/Ctrl-K makes a link here rather than opening the dashboard's search
    // palette. See `search-shortcut.ts` for why both used to happen at once.
    editorProps: { handleDOMEvents: { keydown: claimLinkShortcut } },
    /*
     * Seeding fires update events of its own, so only a document-changing
     * transaction after the editor has settled counts as an edit. Without a
     * gate here the page opens already dirty.
     *
     * `isInitialized`, not `isFocused`. TipTap sets `isInitialized` in the
     * deferred macrotask that also emits `create`, while `EmailTheming` seeds
     * the document synchronously inside `createView` — so the seeding update
     * lands while it is still false, and everything after it counts. (Nothing
     * else slips into that macrotask: `autofocus` defaults to false, so the
     * focus command guarded ahead of `create` never runs.)
     *
     * `isFocused` excluded far more than seeding: it dropped every change made
     * while focus sat outside the canvas, which is precisely what the
     * Inspector is. Editing a colour, the container width or padding moves
     * focus to an input, so the edit reached the document but never marked the
     * page dirty, and Save stayed disabled over real unsaved work.
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
          // Not `html`: that variant is Prettier-formatted for source views,
          // and the indentation inflates nested table layouts several times
          // over for no benefit in a mail client.
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
          {/* The canvas container is a block `div` carrying an inline `width`
              and no margins of its own, so it sits flush left. The library
              ships no rule for it at all, so centring falls to us — and
              `mx-auto` has no inline margin to fight.

              Selected by `data-type`, not the `.node-container` class the same
              div carries: the safelist extractor's bracket-variant pattern
              admits no `.`, so a class selector is silently truncated to a
              fragment and the rule is never generated. The attribute form is
              what the Inspector patches above already use.

              This only brings the canvas in line with what already sends — the
              export renders the container with `align: "center"`, so the email
              itself was never left-aligned. */}
          {/* The container is a real 600px block, but nothing in the markup
              says so: `EmailTheming` injects
              `<scope> .node-container { width: 600px }` at runtime, keyed off
              the `data-editor-theme-scope` attribute it puts on the editor.

              Nothing sets a margin on it — the theme's container group has no
              margin prop, `RESET_BASIC.container` is `{}`, and `container` is
              absent from `RESET_NODE_TYPES` — so auto margins are unopposed.

              The theme's `align: "center"` does not help here: it is not a CSS
              property, so the injected rule drops it. It only reaches the
              export, where it becomes the React Email `Container` align. */}
          <EditorContent editor={editor} className={CANVAS_CLASS} />
        </div>

        {/* A divider now, not a card. `border-l` was wrong only while the
            parent carried `gap-x-4`: the rule landed in the gutter instead of
            between the panes. With the gap gone and the two panes flush, that
            border is the seam. `border-ui-border-base` is not dressing either
            — a width class alone inherits preflight's hardcoded #e5e7eb, which
            is invisible here and stays near-white in dark mode instead of
            following --border-base.

            The arbitrary variants patch a gap in the library's own stylesheet.
            Every other interactive element there — toggles, buttons, the
            breadcrumb — explicitly resets `background` and `border`, but
            `[data-re-inspector-input]` and `[data-re-inspector-color-hex]` do
            not, so the text fields keep their user-agent fill and border. That
            filled box then escapes a wrapper fixed at `height: 1.6rem` with no
            `overflow`, punching holes through its rounded edge. `min-w-0`
            matters too: a flex item defaults to `min-width: auto`, so the
            monospace hex string refuses to shrink below its own content width
            and pushes past the right border. Clipping the wrapper mirrors what
            the library already does for `[data-re-inspector-toggle-group]`.

            These have to be classes: a stylesheet cannot reach the host. The
            plugin build emits `index.css` but nothing imports it, and the
            host's entry loads only its own. */}
        <Inspector.Root className={INSPECTOR_CLASS}>
          <InspectorBreadcrumb />
          <Inspector.Document />
          {/* Stands in for `Inspector.Node`: variables get their own panel,
              every other node type keeps the library's default sections. */}
          <VariableInspector variables={template.variables} />
          {/* Stands in for `Inspector.Text`: the library's own link section
              renders its URL field `readOnly`, so a selected link showed a
              field nobody could type into. */}
          <LinkTextInspector variables={template.variables} />
        </Inspector.Root>
      </div>

      {/* A selected variable gets its own, marks-only menu below, so the text
          menu stands aside for it rather than showing both. */}
      <BubbleMenu
        hideWhenActiveNodes={['button', 'variable']}
        hideWhenActiveMarks={['link']}
      />
      <VariableBubbleMenu />
      {/* The stock menus, for acting on a link that is already there: edit,
          open, unlink. Choosing a *variable* for a URL happens in the
          Inspector instead — see the note at the top of `link-inspector.tsx`
          for why a picker cannot live in these.

          `validateUrl` is what lets Liquid be typed or pasted here too.
          Without it both forms reject `{{ invite_url }}` and clear the href,
          which is what made a link disappear as it was being written. */}
      <BubbleMenu.LinkDefault validateUrl={validateUrl} />
      <BubbleMenu.ButtonDefault validateUrl={validateUrl} />
      <SlashCommand items={slashCommands} />
    </EditorContext.Provider>
  );
});

EmailTemplateEditor.displayName = 'EmailTemplateEditor';

export default EmailTemplateEditor;

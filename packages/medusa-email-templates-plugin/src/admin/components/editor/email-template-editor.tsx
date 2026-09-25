import { composeReactEmail } from '@react-email/editor/core';
import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
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

import type { EmailTemplateDetail } from '../../lib/types';
import { deriveEditorContent } from './derive-document';
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
 */
const INSPECTOR_CLASS = [
  'bg-ui-bg-base border-ui-border-base w-64 shrink-0 overflow-y-auto border-l p-4',
  '[&_[data-re-inspector-input]]:bg-transparent [&_[data-re-inspector-input]]:border-0 [&_[data-re-inspector-input]]:min-w-0',
  '[&_[data-re-inspector-color-hex]]:bg-transparent [&_[data-re-inspector-color-hex]]:border-0 [&_[data-re-inspector-color-hex]]:min-w-0',
  '[&_[data-re-inspector-number]]:overflow-hidden [&_[data-re-inspector-color-control]]:overflow-hidden [&_[data-re-inspector-select]]:overflow-hidden',
  '[&_[data-re-inspector-unit]]:text-xs [&_[data-re-inspector-unit]]:w-auto [&_[data-re-inspector-unit]]:h-auto [&_[data-re-inspector-unit]]:aspect-auto',
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
const CANVAS_CLASS = ['p-6', '[&_[data-type=container]]:mx-auto'].join(' ');

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
      StarterKit,
      EmailTheming,
      // Each pill resolves its own label from this list, so the canvas shows
      // "Total | Money" rather than the generated Liquid.
      VariableNode.configure({ variables: template.variables }),
    ],
    [template.variables],
  );

  /*
   * A template nobody has edited has no `editor_content`, only the HTML its
   * event declared, so the body is derived from that HTML rather than opening
   * blank. Blank was the dangerous state: the canvas looked empty, the first
   * keystroke marked it dirty, and saving then exported that blankness over a
   * designed email.
   *
   * Nothing derived is persisted. `editor_content` stays null until someone
   * actually edits, so a derived document cannot go stale against an HTML
   * default that changed underneath it.
   */
  const content = useMemo(() => {
    if (template.editor_content) {
      return template.editor_content;
    }

    try {
      return deriveEditorContent(template.default_template.html, extensions);
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
  }, [template.editor_content, template.default_template.html, extensions]);

  const editor = useEditor({
    extensions,
    content,
    // The admin is a client-only Vite SPA, so there is no hydration to guard
    // against. `false` would defer creation to an effect and cost an extra
    // render for nothing.
    immediatelyRender: true,
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
    () => [...defaultSlashCommands, variableSlashCommand(template.variables)],
    [template.variables],
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
          <Inspector.Text />
        </Inspector.Root>
      </div>

      {/* Variables are configured in the Inspector, so the text menu stays out
          of the way whenever one is selected. */}
      <BubbleMenu
        hideWhenActiveNodes={['button', 'variable']}
        hideWhenActiveMarks={['link']}
      />
      <BubbleMenu.LinkDefault />
      <BubbleMenu.ButtonDefault />
      <SlashCommand items={slashCommands} />
    </EditorContext.Provider>
  );
});

EmailTemplateEditor.displayName = 'EmailTemplateEditor';

export default EmailTemplateEditor;

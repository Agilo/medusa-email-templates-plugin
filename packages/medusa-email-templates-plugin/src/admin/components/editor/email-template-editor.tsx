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
    // Seeding the initial content fires update events of its own, so only a
    // document-changing transaction from someone actually typing counts as an
    // edit. Without this gate the page opens already dirty.
    onUpdate: ({ editor: instance, transaction }) => {
      if (transaction.docChanged && instance.isEditable && instance.isFocused) {
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
      <div className="flex gap-x-4">
        <div className="bg-ui-bg-base min-w-0 flex-1 overflow-hidden rounded-lg border">
          <EditorContent editor={editor} className="p-4" />
        </div>

        <Inspector.Root className="w-60 shrink-0 overflow-y-auto border-l p-4">
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

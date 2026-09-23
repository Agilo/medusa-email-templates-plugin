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
import { OrderItemsNode } from './order-items-node';
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
  const editor = useEditor({
    extensions: [
      StarterKit,
      EmailTheming,
      // Each pill resolves its own label from this list, so the canvas shows
      // "Order total · Money" rather than the generated Liquid.
      VariableNode.configure({ variables: template.variables }),
      OrderItemsNode,
    ],
    // `editor_content` is the only faithful source, because it is this
    // editor's own document format. Both `html_template` and
    // `default_template.html` are *output* HTML: Liquid control flow sits as
    // bare text between `</tr>` and `<tr>`, which is invalid inside `<tbody>`,
    // so parsing hoists `{% for %}` and `{% endfor %}` out of the table they
    // wrap and merges them into a paragraph above it. The loop then iterates
    // over nothing and the row it guarded renders once, out of scope — an
    // order email that silently loses its line items.
    //
    // A template with no stored document therefore opens empty. Its stored
    // HTML keeps sending untouched, because the body is only ever written
    // back when someone actually edits here.
    content: template.editor_content ?? '',
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

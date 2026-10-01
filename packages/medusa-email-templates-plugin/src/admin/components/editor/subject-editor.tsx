import type { JSONContent } from '@tiptap/core';
import { EditorContent, Extension, Node, useEditor } from '@tiptap/react';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';

import type { EmailTemplateVariable } from '../../lib/types';
import { withVariableNodes } from './derive-document';
import { VariableNode } from './variable-node';

/*
 * A minimal schema: the body's would allow headings and tables. TipTap's own
 * Paragraph/Text aren't available — `@tiptap/react` exports only the base
 * classes, and `@tiptap/core` is a devDependency.
 */
const SubjectDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'paragraph',
});

const SubjectParagraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'p' }];
  },

  renderHTML() {
    return ['p', 0];
  },
});

const SubjectText = Node.create({
  name: 'text',
  group: 'inline',
});

/** Swallows Enter so ProseMirror doesn't look for somewhere else to split. */
const SingleLine = Extension.create({
  name: 'subjectSingleLine',

  addKeyboardShortcuts() {
    return {
      Enter: () => true,
      'Mod-Enter': () => true,
      'Shift-Enter': () => true,
    };
  },
});

const documentFor = (subject: string): JSONContent => {
  const paragraph: JSONContent = { type: 'paragraph' };

  // ProseMirror rejects an empty text node, so leave the paragraph empty.
  if (subject) {
    paragraph.content = [{ type: 'text', text: subject }];
  }

  return withVariableNodes({ type: 'doc', content: [paragraph] });
};

export type SubjectEditorHandle = {
  getText: () => string;
  insertVariable: (attrs: Record<string, unknown>) => void;
};

type SubjectEditorProps = {
  subject: string;
  variables: EmailTemplateVariable[];
  onDirty: () => void;
};

/*
 * Medusa's `Input` styles, copied because `@medusajs/ui` doesn't export them.
 * The border is `shadow-borders-base`. Uses `focus-within:`, since
 * `focus-visible:` never matches a wrapper around a contenteditable.
 */
const FIELD_CLASS = [
  'bg-ui-bg-field hover:bg-ui-bg-field-hover shadow-borders-base',
  'focus-within:shadow-borders-interactive-with-active',
  'txt-compact-small text-ui-fg-base transition-fg',
  'flex h-8 w-full items-center rounded-md px-2 py-1.5',
].join(' ');

const SubjectEditor = forwardRef<SubjectEditorHandle, SubjectEditorProps>(
  ({ subject, variables, onDirty }, ref) => {
    const extensions = useMemo(
      () => [
        SubjectDocument,
        SubjectParagraph,
        SubjectText,
        SingleLine,
        VariableNode.configure({ variables }),
      ],
      [variables],
    );

    /*
     * Whether the field has *ever* been focused. The dropdown blurs the
     * editor before an insert, but the selection survives, so the caret can be
     * restored. An untouched field's selection is at the start and would
     * prepend.
     */
    const touched = useRef(false);

    const editor = useEditor({
      extensions,
      content: documentFor(subject),
      onFocus: () => {
        touched.current = true;
      },
      immediatelyRender: true,
      editorProps: {
        attributes: {
          id: 'subject',
          role: 'textbox',
          'aria-label': 'Subject',
          class: 'min-w-0 flex-1 outline-none',
        },
        // Flatten pasted newlines to spaces; the schema would otherwise drop
        // everything after them.
        handlePaste: (view, event) => {
          const text = event.clipboardData?.getData('text/plain');

          if (!text || !/[\r\n]/.test(text)) {
            return false;
          }

          event.preventDefault();
          view.dispatch(
            view.state.tr.insertText(text.replace(/\s*[\r\n]+\s*/g, ' ')),
          );

          return true;
        },
      },
      // Seeding fires its own updates; only real typing counts as an edit.
      onUpdate: ({ editor: instance, transaction }) => {
        if (
          transaction.docChanged &&
          instance.isEditable &&
          instance.isFocused
        ) {
          onDirty();
        }
      },
    });

    useImperativeHandle(
      ref,
      () => ({
        getText: () => editor?.getText() ?? '',
        insertVariable: (attrs) => {
          if (!editor) {
            return;
          }

          // `focus()` with no position restores the stored selection, so the
          // pill lands at the caret. `'end'` for a never-focused field, whose
          // selection is at the start.
          editor
            .chain()
            .focus(touched.current ? undefined : 'end')
            .setVariable(attrs)
            .run();
        },
      }),
      [editor],
    );

    return (
      <div className={FIELD_CLASS}>
        <EditorContent editor={editor} className="min-w-0 flex-1" />
      </div>
    );
  },
);

SubjectEditor.displayName = 'SubjectEditor';

export default SubjectEditor;

import type { JSONContent } from '@tiptap/core';
import { EditorContent, Extension, Node, useEditor } from '@tiptap/react';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';

import type { EmailTemplateVariable } from '../../lib/types';
import { withVariableNodes } from './derive-document';
import { VariableNode } from './variable-node';

/**
 * The subject line, as an editor rather than a text input.
 *
 * The body has always been structured — variables are pills holding
 * `{ key, format }`, and the Liquid is generated on export, so a keystroke
 * cannot corrupt a filter. The subject was the last place it could: a plain
 * input holding raw Liquid, where `{{ store.nme }}` renders as empty text and
 * ships `Your  order` to a customer with nothing raised anywhere.
 *
 * Storage does not change. `subject_template` still holds the same Liquid
 * string: `getText()` serialises the pills back through `VariableNode`'s
 * `renderText`, and `withVariableNodes` parses them out again on load.
 */

/*
 * A deliberately tiny schema. Reusing the body's would drag in headings,
 * tables and columns — none of which belong on one line — and TipTap's own
 * Paragraph and Text are not reachable: `@tiptap/react` exports the base
 * `Node` and `Extension` classes but not the individual extensions, and
 * `@tiptap/core` is a devDependency, so it must not be imported at runtime.
 */
const SubjectDocument = Node.create({
  name: 'doc',
  topNode: true,
  // Exactly one paragraph, so there is nothing for Enter to split into.
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

/**
 * The schema already forbids a second block, but a bare Enter would still be
 * handled — swallowing it keeps the caret where it is instead of letting
 * ProseMirror hunt for somewhere legal to split.
 */
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

/** Reads a stored subject into a document, turning its Liquid into pills. */
const documentFor = (subject: string): JSONContent => {
  const paragraph: JSONContent = { type: 'paragraph' };

  // An empty paragraph, not one holding an empty text node: ProseMirror
  // rejects the latter outright.
  if (subject) {
    paragraph.content = [{ type: 'text', text: subject }];
  }

  return withVariableNodes({ type: 'doc', content: [paragraph] });
};

export type SubjectEditorHandle = {
  /** The subject as Liquid, with every pill serialised back to its expression. */
  getText: () => string;
  insertVariable: (attrs: Record<string, unknown>) => void;
};

type SubjectEditorProps = {
  /** Only read when the editor mounts; typing is not controlled from outside. */
  subject: string;
  variables: EmailTemplateVariable[];
  onDirty: () => void;
};

/*
 * Medusa's `Input` look, copied rather than imported: `inputBaseStyles` is not
 * re-exported from `@medusajs/ui`, whose barrel exposes only the component.
 *
 * Note there is no border utility — the border *is* `shadow-borders-base`. And
 * the real Input focuses with `focus-visible:`, which never matches a wrapper
 * around a contenteditable, so this uses `focus-within:`.
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
        // Each pill resolves its own label from this list, so the field shows
        // "Total | Money" rather than the generated Liquid.
        VariableNode.configure({ variables }),
      ],
      [variables],
    );

    /*
     * Whether the field has ever held focus — not whether it holds it now.
     *
     * Opening the variable dropdown blurs the editor, so `editor.isFocused` is
     * always false by the time an insertion runs. ProseMirror keeps its
     * selection across a DOM blur, so the caret is still there to return to;
     * what this distinguishes is a field nobody has clicked into, whose
     * selection sits at the document start and would otherwise prepend.
     */
    const touched = useRef(false);

    const editor = useEditor({
      extensions,
      content: documentFor(subject),
      onFocus: () => {
        touched.current = true;
      },
      // Client-only Vite SPA: there is no hydration to guard against.
      immediatelyRender: true,
      editorProps: {
        attributes: {
          // Keeps `<Label htmlFor="subject">` associated, and keeps the field
          // reachable as `getByLabelText('Subject')`.
          id: 'subject',
          role: 'textbox',
          'aria-label': 'Subject',
          class: 'min-w-0 flex-1 outline-none',
        },
        /*
         * A pasted newline would otherwise be dropped silently by the schema,
         * losing whatever followed it. Flattening to a space keeps the text.
         */
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
      // Seeding fires update events of its own, so only a document-changing
      // transaction from someone actually typing counts as an edit.
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

          /*
           * `focus()` with no position restores the stored selection —
           * `resolveFocusPosition` returns null for a falsy position and the
           * command falls back to `editor.state.selection`. That is what puts
           * the pill at the caret even though the dropdown has taken focus
           * away.
           *
           * `'end'` only for a field nobody has clicked into: its selection is
           * at the document start, so restoring it would prepend.
           */
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

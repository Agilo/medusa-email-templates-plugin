import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import { isVariableSelected } from '../variable-bubble-menu';
import { VariableNode } from '../variable-node';

const editors: Editor[] = [];

const createEditor = (pill: JSONContent = {}) => {
  const editor = new Editor({
    extensions: [
      StarterKit.configure(),
      EmailTheming.configure({ theme: 'basic' }),
      VariableNode,
    ],
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Total ' },
            { type: 'variable', attrs: { key: 'order.total' }, ...pill },
            { type: 'text', text: ' today' },
          ],
        },
      ],
    },
  });
  editors.push(editor);

  // Found rather than counted: the theme wraps the document in a container,
  // so the pill's position is not the one the JSON above suggests.
  let position = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'variable') {
      position = pos;
    }
  });

  return { editor, position };
};

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('variable bubble menu', () => {
  it('shows for a pill selected on its own', () => {
    const { editor, position } = createEditor();

    editor.commands.setNodeSelection(position);

    expect(isVariableSelected(editor)).toBe(true);
  });

  it('stays hidden for a text selection that includes a pill', () => {
    const { editor, position } = createEditor();

    // The stock text menu covers this one.
    editor.commands.setTextSelection({ from: position - 3, to: position + 4 });

    expect(isVariableSelected(editor)).toBe(false);
  });

  it('leaves a linked pill to the link menu', () => {
    const { editor, position } = createEditor({
      marks: [{ type: 'link', attrs: { href: 'https://shop.test' } }],
    });

    editor.commands.setNodeSelection(position);

    expect(isVariableSelected(editor)).toBe(false);
  });

  it('applies a mark to the pill and keeps it selected', () => {
    const { editor, position } = createEditor();

    editor.commands.setNodeSelection(position);
    // The chain a bubble menu button runs.
    editor.chain().focus().toggleBold().run();

    expect(
      editor.state.doc.nodeAt(position)?.marks.map((m) => m.type.name),
    ).toEqual(['bold']);
    expect(isVariableSelected(editor)).toBe(true);
  });
});

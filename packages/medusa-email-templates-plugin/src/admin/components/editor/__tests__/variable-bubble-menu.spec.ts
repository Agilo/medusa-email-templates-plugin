import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
import {
  getSelectionAlignment,
  setTextAlignment,
} from '@react-email/editor/utils';
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

  it('aligns the paragraph around the pill and keeps it selected', () => {
    const { editor, position } = createEditor();

    editor.commands.setNodeSelection(position);
    setTextAlignment(editor, 'right');

    expect(editor.state.doc.resolve(position).parent.attrs.alignment).toBe(
      'right',
    );
    expect(getSelectionAlignment(editor)).toBe('right');
    expect(isVariableSelected(editor)).toBe(true);
  });

  it('applies a mark to the pill and keeps it selected', () => {
    const { editor, position } = createEditor();

    editor.commands.setNodeSelection(position);
    editor.chain().focus().toggleBold().run();

    expect(
      editor.state.doc.nodeAt(position)?.marks.map((m) => m.type.name),
    ).toEqual(['bold']);
    expect(isVariableSelected(editor)).toBe(true);
  });
});

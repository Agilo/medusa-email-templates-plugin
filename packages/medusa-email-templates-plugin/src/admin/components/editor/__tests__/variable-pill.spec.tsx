import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
import type { Editor, JSONContent } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { EditorContent, EditorContext, useEditor } from '@tiptap/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { EmailTemplateVariable } from '../../../lib/types';
import { Inspector } from '@react-email/editor/ui';

import { VariableInspector } from '../variable-inspector';
import { UNSET_VARIABLE_LABEL, VariableNode } from '../variable-node';

/**
 * These mount through `EditorContent` on purpose.
 *
 * `ReactNodeViewRenderer` returns a stub node view when
 * `editor.contentComponent` is unset, and only `EditorContent` sets it — so a
 * bare `new Editor()` never instantiates the pill at all. Every other spec in
 * this folder builds a bare editor, which is exactly why three separate pill
 * bugs shipped without a single test failing.
 */

const variables: EmailTemplateVariable[] = [
  {
    key: 'order.total',
    label: 'Total',
    example: 55,
    type: 'money',
    currencyKey: 'order.currency_code',
    group: 'Totals',
  },
];

const docWith = (attrs: Record<string, unknown>): JSONContent => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hi ' },
        { type: 'variable', attrs },
      ],
    },
  ],
});

/** Renders a real editor and hands the instance back for assertions. */
const Harness = ({
  content,
  onReady,
}: {
  content: JSONContent;
  onReady: (editor: Editor) => void;
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure(),
      EmailTheming.configure({ theme: 'basic' }),
      VariableNode.configure({ variables }),
    ],
    content,
    immediatelyRender: true,
  });

  if (editor) {
    onReady(editor);
  }

  return editor ? <EditorContent editor={editor} /> : null;
};

/**
 * Mounts and waits for the pill to actually exist.
 *
 * Node views render through React portals that `createContentComponent`
 * publishes via `queueMicrotask`, so nothing is in the DOM the instant
 * `render()` returns — asserting synchronously finds an empty paragraph.
 */
const mountEditor = async (content: JSONContent) => {
  let editor: Editor | null = null;

  render(
    <Harness
      content={content}
      onReady={(instance) => {
        editor = instance;
      }}
    />,
  );

  await waitFor(() => {
    expect(document.querySelector('[data-variable-node]')).not.toBeNull();
  });

  if (!editor) {
    throw new Error('The editor did not mount.');
  }

  return editor as Editor;
};

const pill = () => document.querySelector('[data-variable-node]') as Element;

describe('variable pill', () => {
  it('renders the variable label rather than the Liquid expression', async () => {
    await mountEditor(docWith({ key: 'order.total', format: 'money' }));

    expect(screen.getByText('Total')).toBeInTheDocument();
    // The whole point of the structured model: no Liquid on the canvas.
    expect(screen.queryByText(/\{\{/)).toBeNull();
  });

  it('names the format when it is not plain text', async () => {
    await mountEditor(docWith({ key: 'order.total', format: 'money' }));

    expect(screen.getByText(/Money/)).toBeInTheDocument();
  });

  it('prompts when no variable has been chosen', async () => {
    // An empty-string key is not nullish, so `??` would render nothing here.
    await mountEditor(docWith({ key: '' }));

    expect(screen.getByText(UNSET_VARIABLE_LABEL)).toBeInTheDocument();
    expect(pill()).toHaveAttribute('data-variable-state', 'empty');
  });

  it('flags a key the event no longer publishes', async () => {
    // Authored against another event, or the event stopped publishing it.
    // Export still emits the key, so the canvas has to show that it is there
    // and that it is broken — rendering it as an ordinary pill would hide a
    // variable that resolves to nothing in the sent email.
    await mountEditor(docWith({ key: 'order.discontinued', format: 'text' }));

    expect(pill()).toHaveAttribute('data-variable-state', 'stale');
    // No label to fall back on, so the raw key is what identifies it.
    expect(screen.getByText('order.discontinued')).toBeInTheDocument();
  });

  it('draws the format separator with styles the admin bundle actually ships', async () => {
    /*
     * This guards a whole class of silent failure. The dashboard ships one
     * prebuilt stylesheet and its Tailwind pass never scans this plugin's
     * admin chunks, so `border-ui-tag-blue-icon` — and every other class
     * Medusa does not itself use — renders nothing at all. The separator is
     * therefore set inline, and asserting on the inline style is the only
     * way a test can tell the difference between a rule that paints and a
     * class that silently does not exist.
     */
    await mountEditor(docWith({ key: 'order.total', format: 'money' }));

    const rule = screen.getByText('Money');

    expect(rule).toHaveStyle({ borderLeftWidth: '1px' });
    expect(rule).toHaveStyle({ borderLeftStyle: 'solid' });
    // A colour, not the default grey that is invisible on the pill's fill.
    expect(rule.getAttribute('style')).toContain('--tag-blue-icon');
  });

  it('names the variable, its format and its state to assistive tech', async () => {
    // The pill is one text run to a screen reader, and the blue/orange
    // distinction carries meaning that colour alone does not convey.
    await mountEditor(docWith({ key: 'order.total', format: 'money' }));

    expect(screen.getByLabelText('Variable: Total, Money')).toBeInTheDocument();
  });

  it('selects the pill when it is clicked', async () => {
    const editor = await mountEditor(
      docWith({ key: 'order.total', format: 'money' }),
    );

    fireEvent.mouseDown(pill());

    const { selection } = editor.state;

    expect(selection).toBeInstanceOf(NodeSelection);
    expect((selection as NodeSelection).node.type.name).toBe('variable');
  });

  it('stays selected when an already-selected pill is clicked again', async () => {
    const editor = await mountEditor(
      docWith({ key: 'order.total', format: 'money' }),
    );

    fireEvent.mouseDown(pill());
    fireEvent.mouseDown(pill());

    // The second click dispatches nothing through ProseMirror's own click
    // handling, which is what kept the bubble menu from reopening.
    const { selection } = editor.state;

    expect(selection).toBeInstanceOf(NodeSelection);
    expect((selection as NodeSelection).node.attrs.key).toBe('order.total');
  });
});

/**
 * The Inspector panel.
 *
 * `Inspector.Node`'s render-prop only receives our node once the editor
 * reports focus and the selection is a NodeSelection on it — so the Variable
 * control appearing proves the whole chain, without any of the positioning
 * the bubble menu needed.
 */
const InspectorHarness = ({ content }: { content: JSONContent }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure(),
      EmailTheming.configure({ theme: 'basic' }),
      VariableNode.configure({ variables }),
    ],
    content,
    immediatelyRender: true,
  });

  if (!editor) {
    return null;
  }

  return (
    <EditorContext.Provider value={{ editor }}>
      <EditorContent editor={editor} />
      <Inspector.Root>
        <VariableInspector variables={variables} />
      </Inspector.Root>
    </EditorContext.Provider>
  );
};

describe('variable inspector', () => {
  const mountWithInspector = async (content: JSONContent) => {
    render(<InspectorHarness content={content} />);

    await waitFor(() => {
      expect(document.querySelector('[data-variable-node]')).not.toBeNull();
    });
  };

  it('shows nothing while no variable is selected', async () => {
    await mountWithInspector(docWith({ key: 'order.total', format: 'money' }));

    expect(screen.queryByLabelText('Variable')).toBeNull();
  });

  it('shows the variable and its format once the pill is selected', async () => {
    await mountWithInspector(docWith({ key: 'order.total', format: 'money' }));

    fireEvent.mouseDown(pill());

    expect(await screen.findByLabelText('Variable')).toHaveValue('order.total');
    expect(screen.getByLabelText('Format')).toHaveValue('money');
  });

  it('offers only the formats the variable supports', async () => {
    await mountWithInspector(docWith({ key: 'order.total', format: 'money' }));

    fireEvent.mouseDown(pill());

    const format = await screen.findByLabelText('Format');
    const offered = Array.from(
      format.querySelectorAll('option'),
      (option) => option.value,
    );

    expect(offered).toEqual(['text', 'money']);
  });

  it('writes a format change back to the node', async () => {
    await mountWithInspector(docWith({ key: 'order.total', format: 'money' }));

    fireEvent.mouseDown(pill());

    const format = await screen.findByLabelText('Format');

    fireEvent.change(format, { target: { value: 'text' } });

    await waitFor(() => {
      expect(
        document.querySelector('[data-variable-node]')?.textContent,
      ).not.toMatch(/Money/);
    });
  });
});

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
 * Mounted through `EditorContent` on purpose: without it,
 * `ReactNodeViewRenderer` returns a stub and the pill is never rendered. Specs
 * using a bare `new Editor()` can't catch pill bugs.
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
  {
    key: 'order.currency_code',
    label: 'Currency',
    example: 'eur',
    group: 'Order',
  },
  {
    key: 'invite.expires_at',
    label: 'Expires at',
    example: '2026-10-01T10:00:00.000Z',
    type: 'date',
    group: 'Invite',
  },
  { key: 'order.notes', label: 'Notes', example: { free: 'form' } },
];

const MONEY = {
  key: 'order.total',
  format: 'money',
  currencySource: 'order.currency_code',
};

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
 * Mounts and waits for the pill: node views render via portals published in a
 * microtask, so they aren't in the DOM when `render()` returns.
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
  it('renders the value a recipient will see, not the Liquid', async () => {
    await mountEditor(docWith(MONEY));

    expect(screen.getByText('€55.00')).toBeInTheDocument();
    expect(screen.queryByText(/\{\{/)).toBeNull();
  });

  it('renders a date in the format that was chosen', async () => {
    await mountEditor(
      docWith({ key: 'invite.expires_at', format: 'date_long' }),
    );

    expect(screen.getByText('October 1, 2026')).toBeInTheDocument();
  });

  it('renders an unformatted value as it stands', async () => {
    await mountEditor(docWith({ key: 'invite.expires_at', format: 'text' }));

    expect(screen.getByText('2026-10-01T10:00:00.000Z')).toBeInTheDocument();
  });

  it('falls back to the name when the example cannot be shown', async () => {
    await mountEditor(docWith({ key: 'order.notes', format: 'text' }));

    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('names the variable in a tooltip', async () => {
    await mountEditor(docWith(MONEY));

    fireEvent.focus(pill().firstElementChild as Element);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(/^Total$/);
  });

  it('warns in the tooltip when the event no longer publishes the key', async () => {
    await mountEditor(docWith({ key: 'order.discontinued', format: 'text' }));

    fireEvent.focus(pill().firstElementChild as Element);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'order.discontinued — not available for this event',
    );
  });

  it('offers no tooltip until a variable is chosen', async () => {
    await mountEditor(docWith({ key: '' }));

    fireEvent.focus(pill());

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('prompts when no variable has been chosen', async () => {
    await mountEditor(docWith({ key: '' }));

    expect(screen.getByText(UNSET_VARIABLE_LABEL)).toBeInTheDocument();
    expect(pill()).toHaveAttribute('data-variable-state', 'empty');
  });

  it('flags a key the event no longer publishes', async () => {
    await mountEditor(docWith({ key: 'order.discontinued', format: 'text' }));

    expect(pill()).toHaveAttribute('data-variable-state', 'stale');
    expect(screen.getByText('order.discontinued')).toBeInTheDocument();
  });

  it('fills the pill while selected, alongside the focus ring', async () => {
    await mountEditor(docWith(MONEY));

    expect(pill()).toHaveClass('hover:bg-ui-tag-blue-bg-hover');
    expect(pill()).not.toHaveClass('bg-ui-tag-blue-bg-hover');

    fireEvent.mouseDown(pill());

    await waitFor(() => {
      expect(pill()).toHaveClass('shadow-borders-focus');
      expect(pill()).toHaveClass('bg-ui-tag-blue-bg-hover');
    });
  });

  it('names the variable, its format and its state to assistive tech', async () => {
    await mountEditor(docWith(MONEY));

    expect(screen.getByLabelText('Variable: Total, Money')).toBeInTheDocument();
  });

  it('selects the pill when it is clicked', async () => {
    const editor = await mountEditor(docWith(MONEY));

    fireEvent.mouseDown(pill());

    const { selection } = editor.state;

    expect(selection).toBeInstanceOf(NodeSelection);
    expect((selection as NodeSelection).node.type.name).toBe('variable');
  });

  it('stays selected when an already-selected pill is clicked again', async () => {
    const editor = await mountEditor(docWith(MONEY));

    fireEvent.mouseDown(pill());
    fireEvent.mouseDown(pill());

    const { selection } = editor.state;

    expect(selection).toBeInstanceOf(NodeSelection);
    expect((selection as NodeSelection).node.attrs.key).toBe('order.total');
  });
});

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
    await mountWithInspector(docWith(MONEY));

    expect(screen.queryByLabelText('Variable')).toBeNull();
  });

  it('shows the variable and its format once the pill is selected', async () => {
    await mountWithInspector(docWith(MONEY));

    fireEvent.mouseDown(pill());

    expect(await screen.findByLabelText('Variable')).toHaveValue('order.total');
    expect(screen.getByLabelText('Format')).toHaveValue('money');
  });

  it('offers only the formats the variable supports', async () => {
    await mountWithInspector(docWith(MONEY));

    fireEvent.mouseDown(pill());

    const format = await screen.findByLabelText('Format');
    const offered = Array.from(
      format.querySelectorAll('option'),
      (option) => option.value,
    );

    expect(offered).toEqual(['text', 'money']);
  });

  it('writes a format change back to the node', async () => {
    await mountWithInspector(docWith(MONEY));

    fireEvent.mouseDown(pill());

    const format = await screen.findByLabelText('Format');

    fireEvent.change(format, { target: { value: 'text' } });

    await waitFor(() => {
      expect(document.querySelector('[data-variable-node]')?.textContent).toBe(
        '55',
      );
    });
  });
});

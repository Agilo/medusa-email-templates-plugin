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
  // The currency is a variable of its own, and the money pill renders through
  // its example rather than guessing a symbol.
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
  // A host's custom event may declare anything as an example. Nothing stops
  // this reaching the canvas, so the pill has to cope with it.
  { key: 'order.notes', label: 'Notes', example: { free: 'form' } },
];

/** A money pill as `attributesFor` builds one, currency source included. */
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
  /*
   * The canvas reads like the email, so the pill shows what a recipient will
   * see. Through the send path's own `formatMoney`, which is why the currency
   * arrives as another variable's example rather than as a guessed symbol.
   */
  it('renders the value a recipient will see, not the Liquid', async () => {
    await mountEditor(docWith(MONEY));

    expect(screen.getByText('€55.00')).toBeInTheDocument();
    // The whole point of the structured model: no Liquid on the canvas.
    expect(screen.queryByText(/\{\{/)).toBeNull();
  });

  /*
   * What the format control is for. "Long date" names a choice; `October 1,
   * 2026` shows it, which is the difference between a label and a preview.
   */
  it('renders a date in the format that was chosen', async () => {
    await mountEditor(
      docWith({ key: 'invite.expires_at', format: 'date_long' }),
    );

    expect(screen.getByText('October 1, 2026')).toBeInTheDocument();
  });

  it('renders an unformatted value as it stands', async () => {
    // Plain text is a real choice, and an ISO string is what that pill sends.
    await mountEditor(docWith({ key: 'invite.expires_at', format: 'text' }));

    expect(screen.getByText('2026-10-01T10:00:00.000Z')).toBeInTheDocument();
  });

  it('falls back to the name when the example cannot be shown', async () => {
    // `[object Object]` inline would be worse than saying nothing useful.
    await mountEditor(docWith({ key: 'order.notes', format: 'text' }));

    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  /*
   * The pill shows a value, so a tooltip must name the variable (`title`
   * never appears in contenteditable). Opened by focus: it skips the hover
   * delay and pointer events jsdom lacks.
   */
  it('names the variable in a tooltip', async () => {
    await mountEditor(docWith(MONEY));

    fireEvent.focus(pill().firstElementChild as Element);

    // The name and nothing else. The format is already legible in the €55.00
    // on the pill, and repeating it would crowd out the one thing hovering is
    // for.
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
    // It would repeat the pill's own text, which already reads "Choose a
    // variable".
    await mountEditor(docWith({ key: '' }));

    fireEvent.focus(pill());

    expect(screen.queryByRole('tooltip')).toBeNull();
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

  it('fills the pill while selected, alongside the focus ring', async () => {
    // The ring alone reads as focus rather than "this is what the Inspector
    // is editing"; the fill is what makes the selected pill obvious.
    await mountEditor(docWith(MONEY));

    expect(pill()).toHaveClass('hover:bg-ui-tag-blue-bg-hover');
    expect(pill()).not.toHaveClass('bg-ui-tag-blue-bg-hover');

    fireEvent.mouseDown(pill());

    await waitFor(() => {
      expect(pill()).toHaveClass('shadow-borders-focus');
      expect(pill()).toHaveClass('bg-ui-tag-blue-bg-hover');
    });
  });

  /*
   * Screen readers can't see the colours, and `aria-label` replaces the
   * visible value, so it must name the variable, format and state.
   */
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

    // The second click dispatches nothing through ProseMirror's own click
    // handling, which is what kept the bubble menu from reopening.
    const { selection } = editor.state;

    expect(selection).toBeInstanceOf(NodeSelection);
    expect((selection as NodeSelection).node.attrs.key).toBe('order.total');
  });
});

/**
 * The Inspector panel. It only receives the pill once the editor is focused
 * with a NodeSelection on it, so the Variable control appearing proves the
 * whole click-to-select chain.
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

    // Visible in the pill, not just stored: dropping the currency formatting
    // leaves the bare number the template would then send.
    await waitFor(() => {
      expect(document.querySelector('[data-variable-node]')?.textContent).toBe(
        '55',
      );
    });
  });
});

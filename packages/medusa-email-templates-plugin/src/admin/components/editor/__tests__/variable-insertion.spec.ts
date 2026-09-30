import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';

import type { EmailTemplateVariable } from '../../../lib/types';
import {
  attributesFor,
  defaultFormatFor,
  formatsFor,
  groupVariables,
} from '../../../lib/variables';
import { VariableNode } from '../variable-node';
import { variableSlashCommand } from '../variable-slash-command';

const variables: EmailTemplateVariable[] = [
  {
    key: 'order.display_id',
    label: 'Order number',
    example: 1001,
    group: 'Order',
  },
  {
    key: 'order.total',
    label: 'Total',
    example: 55,
    type: 'money',
    currencyKey: 'order.currency_code',
    group: 'Totals',
  },
  {
    key: 'order.created_at',
    label: 'Order date',
    example: '2026-10-01T10:00:00.000Z',
    type: 'date',
    group: 'Order',
  },
  { key: 'store.name', label: 'Store name', example: 'Shop' },
];

const byKey = (key: string) => variables.find((entry) => entry.key === key);

describe('variable formats', () => {
  it('offers only plain text for a variable with no declared type', () => {
    expect(formatsFor(byKey('order.display_id'))).toEqual(['text']);
  });

  it('offers money alongside text, so a raw number stays possible', () => {
    expect(formatsFor(byKey('order.total'))).toEqual(['text', 'money']);
  });

  it('offers every date format for a date', () => {
    expect(formatsFor(byKey('order.created_at'))).toEqual([
      'text',
      'date_long',
      'date_short',
      'date_time',
    ]);
  });

  it('offers nothing beyond text for an unknown variable', () => {
    expect(formatsFor(undefined)).toEqual(['text']);
  });

  it.each([
    ['order.display_id', 'text'],
    ['order.total', 'money'],
    ['order.created_at', 'date_long'],
  ])('defaults %s to %s', (key, expected) => {
    expect(defaultFormatFor(byKey(key))).toBe(expected);
  });

  it('carries the currency source across when a money variable is chosen', () => {
    expect(attributesFor(byKey('order.total'))).toEqual({
      key: 'order.total',
      format: 'money',
      currencySource: 'order.currency_code',
    });
  });

  it('leaves the currency source unset for everything else', () => {
    expect(attributesFor(byKey('store.name')).currencySource).toBeNull();
  });
});

describe('groupVariables', () => {
  it('keeps variables under their group and falls back to Other', () => {
    expect(groupVariables(variables)).toEqual([
      ['Order', [byKey('order.display_id'), byKey('order.created_at')]],
      ['Totals', [byKey('order.total')]],
      ['Other', [byKey('store.name')]],
    ]);
  });
});

describe('variable slash command', () => {
  const editors: Editor[] = [];

  afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
  });

  const editorWithText = () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure(),
        EmailTheming.configure({ theme: 'basic' }),
        VariableNode,
      ],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] },
        ],
      },
    });
    editors.push(editor);

    return editor;
  };

  const TRIGGER = '/variable';

  /**
   * Runs the command as the suggestion plugin does: the trigger text is in the
   * document and `range` spans it. (A collapsed range can't catch a stale
   * position, since deleting nothing keeps the positions correct.)
   */
  const runSlashCommand = (editor: Editor) => {
    editor.commands.focus('end');
    editor.commands.insertContent(TRIGGER);

    const to = editor.state.selection.from;

    variableSlashCommand(variables).command({
      editor,
      range: { from: to - TRIGGER.length, to },
    });
  };

  it('inserts an unconfigured pill and selects it', () => {
    const editor = editorWithText();

    runSlashCommand(editor);

    expect(JSON.stringify(editor.getJSON())).toContain('"variable"');

    const { selection } = editor.state;

    expect(selection).toBeInstanceOf(NodeSelection);
    expect((selection as NodeSelection).node.type.name).toBe('variable');
  });

  it('removes the typed trigger text', () => {
    const editor = editorWithText();

    runSlashCommand(editor);

    // A leftover "/variable" would mean deleteRange and the insert disagreed
    // about where they were operating.
    expect(editor.getText()).not.toContain(TRIGGER);
    expect(editor.getText()).toContain('Hi');
  });

  it('inserts nothing configured, so the pill exports empty until chosen', () => {
    const editor = editorWithText();

    runSlashCommand(editor);

    const selection = editor.state.selection as NodeSelection;

    expect(selection.node.attrs.key).toBe('');
    expect(selection.node.attrs.format).toBe('text');
  });

  it('says so when a template exposes no variables', () => {
    expect(variableSlashCommand([]).description).toContain('No variables');
  });
});

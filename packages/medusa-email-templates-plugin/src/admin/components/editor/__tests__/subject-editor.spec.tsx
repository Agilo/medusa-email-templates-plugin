import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import type { EmailTemplateVariable } from '../../../lib/types';
import SubjectEditor, { type SubjectEditorHandle } from '../subject-editor';

/**
 * Mounts the real component: with a bare `new Editor()`,
 * `ReactNodeViewRenderer` returns a stub and pills are never rendered.
 */

const variables: EmailTemplateVariable[] = [
  { key: 'store.name', label: 'Store name', example: 'Shop', group: 'Store' },
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
];

const mount = async (subject: string) => {
  const ref = createRef<SubjectEditorHandle>();

  render(
    <SubjectEditor
      ref={ref}
      subject={subject}
      variables={variables}
      onDirty={() => {}}
    />,
  );

  // Node views render through React portals published via `queueMicrotask`,
  // so nothing is in the DOM the instant `render()` returns.
  await waitFor(() => {
    expect(screen.getByLabelText('Subject')).toBeInTheDocument();
  });

  return ref;
};

const field = () => screen.getByLabelText('Subject');

describe('subject editor', () => {
  it('shows a stored variable as a pill rather than raw Liquid', async () => {
    await mount('Your {{ store.name }} order');

    await waitFor(() => {
      expect(document.querySelector('[data-variable-node]')).not.toBeNull();
    });

    expect(screen.getByText('Shop')).toBeInTheDocument();
    expect(field().textContent).not.toContain('{{');
  });

  it('serialises back to exactly the Liquid it was given', async () => {
    const subject = 'Your {{ store.name }} order #{{ order.display_id }}';
    const ref = await mount(subject);

    expect(ref.current?.getText()).toBe(subject);
  });

  it('round-trips a formatted variable, filter and all', async () => {
    const subject = '{{ order.total | money: order.currency_code }} due';
    const ref = await mount(subject);

    expect(ref.current?.getText()).toBe(subject);
  });

  it('keeps a variable the template does not declare', async () => {
    const subject = 'Hi {{ store.nme }}';
    const ref = await mount(subject);

    expect(ref.current?.getText()).toBe(subject);
  });

  it('mounts on an empty subject without throwing', async () => {
    const ref = await mount('');

    expect(ref.current?.getText()).toBe('');
  });

  it('inserts a variable with its format applied', async () => {
    const ref = await mount('Order ');

    ref.current?.insertVariable({
      key: 'order.total',
      format: 'money',
      currencySource: 'order.currency_code',
    });

    await waitFor(() => {
      expect(ref.current?.getText()).toBe(
        'Order {{ order.total | money: order.currency_code }}',
      );
    });
  });

  it('appends when the field has never been focused', async () => {
    const ref = await mount('Order');

    ref.current?.insertVariable({ key: 'store.name', format: 'text' });

    await waitFor(() => {
      expect(ref.current?.getText()).toBe('Order{{ store.name }}');
    });
  });

  it('reports an edit only once someone types', async () => {
    let dirty = false;
    const ref = createRef<SubjectEditorHandle>();

    render(
      <SubjectEditor
        ref={ref}
        subject="Your {{ store.name }} order"
        variables={variables}
        onDirty={() => {
          dirty = true;
        }}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Subject')).toBeVisible());

    expect(dirty).toBe(false);
  });

  it('stays on one line when Enter is pressed', async () => {
    const ref = await mount('Order update');

    fireEvent.keyDown(field(), { key: 'Enter', code: 'Enter' });

    expect(ref.current?.getText()).toBe('Order update');
    expect(document.querySelectorAll('p')).toHaveLength(1);
  });
});

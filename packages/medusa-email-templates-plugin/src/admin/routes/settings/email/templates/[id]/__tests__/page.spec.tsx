import { toast } from '@medusajs/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sdk } from '../../../../../../lib/sdk';
import type { EmailTemplateDetail } from '../../../../../../lib/types';
import { createQueryWrapper } from '../../../../../../test/render';
import EmailTemplatePage from '../page';

vi.mock('../../../../../../lib/sdk', () => ({
  sdk: { client: { fetch: vi.fn() } },
}));

const navigate = vi.fn();
const confirm = vi.fn(async () => true);

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ id: 'order-placed' }),
}));

vi.mock('@medusajs/ui', async () => {
  const actual =
    await vi.importActual<typeof import('@medusajs/ui')>('@medusajs/ui');

  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
    usePrompt: () => confirm,
  };
});

const fetchMock = vi.mocked(sdk.client.fetch);

const template = (
  overrides: Partial<EmailTemplateDetail> = {},
): EmailTemplateDetail => ({
  id: 'etpl_1',
  template_key: 'order-placed',
  event: 'order.placed',
  label: 'Order placed',
  enabled: true,
  subject_template: 'Your order #{{ order.display_id }}',
  is_customized: true,
  updated_at: '2026-09-14T10:12:00.000Z',
  warnings: [],
  editor_content: null,
  html_template: '<p>Hi</p>',
  text_template: null,
  variables: [
    {
      key: 'order.display_id',
      label: 'Order number',
      example: 1001,
      group: 'Order',
    },
    { key: 'store.name', label: 'Store name', example: 'Shop', group: 'Store' },
    {
      key: 'order.total',
      label: 'Total',
      example: 55,
      type: 'money',
      currencyKey: 'order.currency_code',
      group: 'Totals',
    },
  ],
  snippets: [],
  default_template: { subject: 'Default subject', html: '<p>Default</p>' },
  ...overrides,
});

const renderPage = () => {
  const { wrapper } = createQueryWrapper();

  return render(<EmailTemplatePage />, { wrapper });
};

/**
 * The subject is a contenteditable now, not an input, so `toHaveValue` and
 * `userEvent.type` no longer apply. Its own behaviour — serialising pills back
 * to Liquid, insertion, single-line enforcement — is covered in
 * `components/editor/__tests__/subject-editor.spec.tsx`. What stays here is
 * what only the page knows: Save enabling and the discard prompt.
 */
const subjectField = () => screen.getByLabelText('Subject');

/**
 * Marks the subject dirty the way a user does.
 *
 * Insertion rather than typing: `userEvent.type` against ProseMirror in jsdom
 * does not reliably produce a document transaction, and the dropdown path is
 * both realistic and deterministic.
 */
const editSubject = async () => {
  await userEvent.click(
    screen.getByRole('button', { name: 'Insert variable' }),
  );
  await userEvent.click(
    await screen.findByRole('menuitem', { name: 'Order number' }),
  );
};

describe('EmailTemplatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue(true);
  });

  it('shows the template it is editing', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();

    expect(await screen.findByText('Order placed')).toBeInTheDocument();
    expect(screen.getByText('order.placed')).toBeInTheDocument();

    // The stored subject arrives as a pill plus its surrounding text, and the
    // pill shows the example value — so the field reads as the subject line
    // that will be sent, not as the expression behind it.
    await waitFor(() => {
      expect(subjectField().textContent).toBe('Your order #1001');
    });
    expect(subjectField().textContent).not.toContain('{{');
  });

  it('opens clean, even though the editor loads its content', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    // Seeding the editor fires update events of its own; none of them are an
    // edit, so nothing here should count as unsaved.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('opens showing the default template rather than a blank body', async () => {
    fetchMock.mockResolvedValue({
      template: template({ html_template: null }),
    });

    renderPage();

    /*
     * Derived from `default_template.html`, because this template has no
     * stored `editor_content`. Opening blank was the dangerous state: the
     * canvas looked empty, one keystroke marked it dirty, and saving exported
     * that blankness over a designed email. Without the seeding this assertion
     * finds nothing.
     */
    expect(await screen.findByText('Default')).toBeInTheDocument();
  });

  /*
   * HTML saved without editor content — through the API, say — is what a real
   * send uses, so it is what the editor opens. It used to open the default,
   * and the next body save replaced the custom HTML with it.
   */
  it('opens the stored HTML over the default when there is no editor content', async () => {
    fetchMock.mockResolvedValue({
      template: template({ html_template: '<p>Custom body</p>' }),
    });

    renderPage();

    expect(await screen.findByText('Custom body')).toBeInTheDocument();
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
  });

  it('only enables Save once something changes', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await editSubject();

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('saves only the subject, leaving the stored body alone', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    await editSubject();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    /*
     * Two things at once. A full replace would blank html_template and
     * editor_content — and the subject arrives as Liquid, proving the pills
     * serialised back through the node's own `renderText` on the way out.
     */
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/admin/email/templates/order-placed',
        {
          method: 'POST',
          body: {
            subject_template:
              'Your order #{{ order.display_id }}{{ order.display_id }}',
          },
        },
      ),
    );
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Template saved.'),
    );
  });

  /*
   * An edit made while a save is in flight is not in that request. Clearing
   * the flag regardless disabled Save and silenced the leave prompt, and the
   * edit was lost without a word.
   */
  it('keeps an edit made during a save as unsaved', async () => {
    let finishSave: (value: unknown) => void = () => undefined;
    fetchMock.mockImplementation(async (_path, init) =>
      (init as { method?: string } | undefined)?.method === 'POST'
        ? new Promise((resolve) => {
            finishSave = resolve;
          })
        : { template: template() },
    );

    renderPage();
    await screen.findByText('Order placed');

    await editSubject();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/admin/email/templates/order-placed',
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    // Typed while the request is still out.
    await editSubject();
    finishSave({ template: template() });

    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Template saved.'),
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('clears the unsaved state when nothing changed during the save', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    await editSubject();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Template saved.'),
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /*
   * Insertion and filter generation moved to the subject editor's own spec:
   * they are its behaviour, and testing them through a page render meant
   * driving ProseMirror at arm's length.
   *
   * The old "appends when the subject was never focused" test went with them
   * rather than being ported. It guarded a real bug — an unfocused input
   * reports `selectionStart` as 0, so every insertion silently prepended — but
   * that arithmetic no longer exists. The editor places a pill at its own
   * selection, and the equivalent guard now lives in the component spec.
   */

  /*
   * A total's default is Money, but a subject may well want the bare number —
   * and a date has four shapes. Picking one has to reach storage, not just the
   * menu, so this asserts the saved payload rather than what the field shows.
   *
   * Radix backs a submenu trigger with the same primitive as an item, so it is
   * also `role="menuitem"`, and clicking it opens the submenu synchronously —
   * the 100ms timer only guards the hover path.
   */
  it('lets a format be chosen for a variable that has several', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    await userEvent.click(
      screen.getByRole('button', { name: 'Insert variable' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Total' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Text' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Text, not the money filter the default would have applied.
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/admin/email/templates/order-placed',
        {
          method: 'POST',
          body: {
            subject_template:
              'Your order #{{ order.display_id }}{{ order.total }}',
          },
        },
      ),
    );
  });

  it('confirms before leaving with unsaved changes', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    await editSubject();
    await userEvent.click(
      screen.getByRole('button', { name: 'Back to email settings' }),
    );

    expect(confirm).toHaveBeenCalled();
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/settings/email'),
    );
  });

  it('stays put when the discard is dismissed', async () => {
    fetchMock.mockResolvedValue({ template: template() });
    confirm.mockResolvedValue(false);

    renderPage();
    await screen.findByText('Order placed');

    await editSubject();
    await userEvent.click(
      screen.getByRole('button', { name: 'Back to email settings' }),
    );

    expect(confirm).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves straight away when nothing has changed', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    await userEvent.click(
      screen.getByRole('button', { name: 'Back to email settings' }),
    );

    expect(confirm).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/settings/email'),
    );
  });

  it('warns when the template cannot send', async () => {
    fetchMock.mockResolvedValue({
      template: template({ warnings: ['storefront_url_not_configured'] }),
    });

    renderPage();

    expect(
      await screen.findByText(/It will not send until that is set/),
    ).toBeInTheDocument();
  });

  it('says the email still sends when only its link is lost', async () => {
    fetchMock.mockResolvedValue({
      template: template({ warnings: ['order_link_unavailable'] }),
    });

    renderPage();

    expect(
      await screen.findByText(/The email still sends, without it/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/will not send/)).not.toBeInTheDocument();
  });

  it('opens the preview drawer', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));

    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('Order placed')).toBeInTheDocument();
  });

  /*
   * An untouched body renders on the server exactly as a real send would —
   * the stored HTML — rather than as the editor's re-export of it, which is
   * not the same email for HTML written outside the editor.
   */
  it('previews an unedited body from the stored HTML, not the editor', async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/preview')
        ? { preview: { subject: 'S', html: '<p>Rendered</p>', text: 'T' } }
        : { template: template() },
    );

    renderPage();
    await screen.findByText('Order placed');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/preview$/),
        expect.anything(),
      ),
    );

    const [, request] = fetchMock.mock.calls.find(([path]) =>
      String(path).endsWith('/preview'),
    )!;
    const { draft } = (request as { body: { draft?: Record<string, unknown> } })
      .body;

    expect(draft?.html_template).toBeUndefined();
  });
});

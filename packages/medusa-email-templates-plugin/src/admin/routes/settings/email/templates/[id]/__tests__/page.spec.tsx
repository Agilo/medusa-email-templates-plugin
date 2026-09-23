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
  default_template: { subject: 'Default subject', html: '<p>Default</p>' },
  ...overrides,
});

const renderPage = () => {
  const { wrapper } = createQueryWrapper();

  return render(<EmailTemplatePage />, { wrapper });
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
    expect(screen.getByLabelText('Subject')).toHaveValue(
      'Your order #{{ order.display_id }}',
    );
  });

  it('opens clean, even though the editor loads its content', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    // Seeding the editor fires update events of its own; none of them are an
    // edit, so nothing here should count as unsaved.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });

  it('only enables Save once something changes', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Subject'), '!');

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('saves only the subject, leaving the stored body alone', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    const subject = screen.getByLabelText('Subject');
    await userEvent.clear(subject);
    await userEvent.type(subject, 'Rewritten');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    // A full replace here would blank html_template and editor_content.
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/admin/email/templates/order-placed',
        { method: 'POST', body: { subject_template: 'Rewritten' } },
      ),
    );
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Template saved.'),
    );
  });

  it('inserts a variable at the cursor', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    const subject = screen.getByLabelText('Subject');
    await userEvent.clear(subject);
    await userEvent.type(subject, 'Order ');

    await userEvent.click(
      screen.getByRole('button', { name: 'Insert variable' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Order number' }),
    );

    expect(subject).toHaveValue('Order {{ order.display_id }}');
  });

  it('generates the filter for a formatted variable', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    await userEvent.clear(screen.getByLabelText('Subject'));
    await userEvent.click(
      screen.getByRole('button', { name: 'Insert variable' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Total' }),
    );

    // Without the filter the subject renders a bare number, not a price.
    expect(screen.getByLabelText('Subject')).toHaveValue(
      '{{ order.total | money: order.currency_code }}',
    );
  });

  it('appends when the subject was never focused, rather than prepending', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    // No typing first: an unfocused input reports selectionStart 0.
    await userEvent.click(
      screen.getByRole('button', { name: 'Insert variable' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Order number' }),
    );

    expect(screen.getByLabelText('Subject')).toHaveValue(
      'Your order #{{ order.display_id }}{{ order.display_id }}',
    );
  });

  it('confirms before leaving with unsaved changes', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    await userEvent.type(screen.getByLabelText('Subject'), '!');
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

    await userEvent.type(screen.getByLabelText('Subject'), '!');
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
      await screen.findByText(/No storefront URL is configured/),
    ).toBeInTheDocument();
  });

  it('opens the preview drawer', async () => {
    fetchMock.mockResolvedValue({ template: template() });

    renderPage();
    await screen.findByText('Order placed');

    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));

    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('Order placed')).toBeInTheDocument();
  });
});

import { toast } from '@medusajs/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sdk } from '../../../lib/sdk';
import type { EmailTemplateListItem } from '../../../lib/types';
import { createQueryWrapper } from '../../../test/render';
import TemplatesSection from '../templates-section';

vi.mock('../../../lib/sdk', () => ({
  sdk: { client: { fetch: vi.fn() } },
}));

const navigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

const confirm = vi.fn(async () => true);

vi.mock('@medusajs/ui', async () => {
  const actual =
    await vi.importActual<typeof import('@medusajs/ui')>('@medusajs/ui');

  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
    // The prompt renders its own dialog outside the component tree.
    usePrompt: () => confirm,
  };
});

const fetchMock = vi.mocked(sdk.client.fetch);

const templates = (): EmailTemplateListItem[] => [
  {
    id: 'etpl_1',
    template_key: 'order-placed',
    event: 'order.placed',
    label: 'Order placed',
    enabled: true,
    subject_template: 'Your order #{{ order.display_id }}',
    is_customized: true,
    updated_at: '2026-09-14T10:12:00.000Z',
    warnings: [],
  },
  {
    id: null,
    template_key: 'invite-created',
    event: 'invite.created',
    label: 'Admin invite',
    enabled: false,
    subject_template: 'You have been invited',
    is_customized: false,
    updated_at: null,
    warnings: [],
  },
  {
    id: 'etpl_2',
    template_key: 'password-reset-customer',
    event: 'auth.password_reset',
    label: 'Password reset (customer)',
    enabled: true,
    subject_template: 'Reset your password',
    is_customized: true,
    updated_at: '2026-09-16T08:30:00.000Z',
    warnings: ['storefront_url_not_configured'],
  },
];

const renderSection = () => {
  const { wrapper } = createQueryWrapper();

  return render(<TemplatesSection />, { wrapper });
};

const row = (name: string) =>
  screen.getByRole('row', { name: new RegExp(name) });

describe('TemplatesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue(true);
  });

  it('lists every registered template with its event', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });

    renderSection();

    expect(await screen.findByText('Order placed')).toBeInTheDocument();
    expect(screen.getByText('order.placed')).toBeInTheDocument();
    expect(screen.getByText('Admin invite')).toBeInTheDocument();
    // Both password-reset templates share an event, so it must be shown.
    expect(screen.getByText('auth.password_reset')).toBeInTheDocument();
  });

  it('distinguishes a saved template from an untouched default', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });

    renderSection();
    await screen.findByText('Order placed');

    expect(within(row('Order placed')).getByText('Custom')).toBeInTheDocument();
    expect(
      within(row('Admin invite')).getByText('Default'),
    ).toBeInTheDocument();
    // Never saved, so there is no edit date to show.
    expect(within(row('Admin invite')).getByText('Never')).toBeInTheDocument();
  });

  it('flags a template that cannot send, beside its switch', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });

    renderSection();
    await screen.findByText('Order placed');

    // The marker sits in the status cell, since it is about sending.
    const blocked = row('Password reset');
    expect(
      within(blocked).getByLabelText('Password reset (customer) cannot send'),
    ).toBeInTheDocument();

    // Templates with nothing wrong carry no marker.
    expect(
      within(row('Order placed')).queryByLabelText(/cannot send/),
    ).toBeNull();
  });

  it('explains the warning on hover', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });

    renderSection();
    await screen.findByText('Order placed');

    await userEvent.hover(
      within(row('Password reset')).getByLabelText(
        'Password reset (customer) cannot send',
      ),
    );

    // Radix renders the text twice: the visible bubble and a screen-reader
    // copy, so scope the assertion to the tooltip itself.
    const [tooltip] = await screen.findAllByRole('tooltip');
    expect(tooltip).toHaveTextContent(
      'No storefront URL is configured, so the link cannot be built.',
    );
  });

  it('reflects enabled state in the switch', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });

    renderSection();
    await screen.findByText('Order placed');

    expect(within(row('Order placed')).getByRole('switch')).toBeChecked();
    expect(within(row('Admin invite')).getByRole('switch')).not.toBeChecked();
  });

  it('toggles without resending the template body', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });

    renderSection();
    await screen.findByText('Admin invite');

    await userEvent.click(within(row('Admin invite')).getByRole('switch'));

    // Only `enabled` travels: anything else would blank the saved body,
    // because the save endpoint replaces whatever it is given.
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/admin/email/templates/invite-created',
        { method: 'POST', body: { enabled: true } },
      ),
    );
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Admin invite is now sending.',
      ),
    );
  });

  it('offers the row actions, reserving Reset for saved templates', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });

    renderSection();
    await screen.findByText('Order placed');

    // Saved, so it can be reverted to the built-in default.
    await userEvent.click(within(row('Order placed')).getByRole('button'));
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Preview' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Send test' })).toBeVisible();
    expect(
      screen.getByRole('menuitem', { name: 'Reset to default' }),
    ).toBeVisible();

    await userEvent.keyboard('{Escape}');

    // Never saved: there is nothing to reset to.
    await userEvent.click(within(row('Admin invite')).getByRole('button'));
    await screen.findByRole('menuitem', { name: 'Edit' });
    expect(
      screen.queryByRole('menuitem', { name: 'Reset to default' }),
    ).toBeNull();
  });

  it('opens the editor when the row is clicked', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });

    renderSection();
    await screen.findByText('Order placed');

    await userEvent.click(screen.getByText('Order placed'));

    expect(navigate).toHaveBeenCalledWith(
      '/settings/email/templates/order-placed',
    );
  });

  it('does not navigate when a row control is used', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });

    renderSection();
    await screen.findByText('Admin invite');

    // The switch and the action menu live inside the clickable row, so both
    // must act without also opening the editor.
    await userEvent.click(within(row('Admin invite')).getByRole('switch'));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/admin/email/templates/invite-created',
        { method: 'POST', body: { enabled: true } },
      ),
    );
    expect(navigate).not.toHaveBeenCalled();

    await userEvent.click(within(row('Admin invite')).getByRole('button'));
    await screen.findByRole('menuitem', { name: 'Edit' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the editor from the Edit action', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });

    renderSection();
    await screen.findByText('Admin invite');

    await userEvent.click(within(row('Admin invite')).getByRole('button'));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Edit' }),
    );

    expect(navigate).toHaveBeenCalledWith(
      '/settings/email/templates/invite-created',
    );
  });

  it('renders a preview without sending anything', async () => {
    // `fetch` accepts string | URL | Request, so normalise before matching.
    fetchMock.mockImplementation((input) =>
      String(input) === '/admin/email/templates'
        ? Promise.resolve({ templates: templates(), count: 3 })
        : Promise.resolve({
            preview: {
              subject: 'Your order #1001',
              html: '<p>Hi Jane</p>',
              text: 'Hi Jane',
            },
          }),
    );

    renderSection();
    await screen.findByText('Order placed');

    await userEvent.click(within(row('Order placed')).getByRole('button'));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Preview' }),
    );

    expect(await screen.findByText('Your order #1001')).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/admin/email/templates/order-placed/preview',
        { method: 'POST', body: {} },
      ),
    );
  });

  it('sends a test of the template from its drawer', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });

    renderSection();
    await screen.findByText('Admin invite');

    await userEvent.click(within(row('Admin invite')).getByRole('button'));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Send test' }),
    );

    const drawer = await screen.findByRole('dialog');
    await userEvent.type(
      within(drawer).getByLabelText('Recipient'),
      'me@example.com',
    );
    await userEvent.click(within(drawer).getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/admin/email/templates/invite-created/send-test',
        { method: 'POST', body: { to: 'me@example.com' } },
      ),
    );
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Test email sent to me@example.com.',
      ),
    );
  });

  it('resets a template to its default once confirmed', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });

    renderSection();
    await screen.findByText('Order placed');

    await userEvent.click(within(row('Order placed')).getByRole('button'));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Reset to default' }),
    );

    expect(confirm).toHaveBeenCalled();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/admin/email/templates/order-placed',
        { method: 'DELETE' },
      ),
    );
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Order placed is back to the default.',
      ),
    );
  });

  it('leaves the template alone when the reset is dismissed', async () => {
    fetchMock.mockResolvedValue({ templates: templates(), count: 3 });
    confirm.mockResolvedValue(false);

    renderSection();
    await screen.findByText('Order placed');

    await userEvent.click(within(row('Order placed')).getByRole('button'));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Reset to default' }),
    );

    expect(confirm).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/admin/email/templates/order-placed',
      { method: 'DELETE' },
    );
  });

  it('shows the error message when the request fails', async () => {
    fetchMock.mockRejectedValue({ message: 'Not allowed to view templates' });

    renderSection();

    expect(
      await screen.findByText('Not allowed to view templates'),
    ).toBeInTheDocument();
  });
});

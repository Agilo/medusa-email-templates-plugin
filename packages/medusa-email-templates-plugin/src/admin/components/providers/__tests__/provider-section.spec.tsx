import { toast } from '@medusajs/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sdk } from '../../../lib/sdk';
import type { EmailProviderState } from '../../../lib/types';
import { createQueryWrapper } from '../../../test/render';
import ProvidersSection from '../providers-section';

vi.mock('../../../lib/sdk', () => ({
  sdk: { client: { fetch: vi.fn() } },
}));

vi.mock('@medusajs/ui', async () => {
  const actual =
    await vi.importActual<typeof import('@medusajs/ui')>('@medusajs/ui');

  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
  };
});

const fetchMock = vi.mocked(sdk.client.fetch);

const providerState = (): EmailProviderState => ({
  selected_transport_id: 'resend',
  encryption_available: true,
  transports: [
    {
      id: 'medusa-cloud',
      label: 'Medusa Cloud',
      selected: false,
      available: false,
      unavailable_reason: 'This backend is not running on Medusa Cloud',
      credential_sources: ['managed'],
      config: {},
      credential: null,
    },
    {
      id: 'resend',
      label: 'Resend',
      selected: true,
      available: true,
      credential_sources: ['environment', 'encrypted_database'],
      config: { from_address: 'orders@agilo.com' },
      credential: {
        source: 'environment',
        env_var_name: 'RESEND_API_KEY',
        configured: true,
      },
    },
    {
      id: 'mailgun',
      label: 'Mailgun',
      selected: false,
      available: true,
      credential_sources: ['environment', 'encrypted_database'],
      config: { from_address: 'orders@mg.agilo.com', domain: 'mg.agilo.com' },
      credential: { source: 'encrypted_database', configured: true },
    },
  ],
});

const renderSection = () => {
  const { wrapper } = createQueryWrapper();

  return render(<ProvidersSection />, { wrapper });
};

const openRowMenu = async (rowName: string) => {
  const row = screen.getByRole('row', { name: new RegExp(rowName) });

  await userEvent.click(within(row).getByRole('button'));
};

describe('ProvidersSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a row per transport with its status', async () => {
    fetchMock.mockResolvedValue({ provider: providerState() });

    renderSection();

    expect(await screen.findByText('Resend')).toBeInTheDocument();
    expect(screen.getByText('Medusa Cloud')).toBeInTheDocument();
    expect(screen.getByText('Mailgun')).toBeInTheDocument();

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('shows how each transport sends', async () => {
    fetchMock.mockResolvedValue({ provider: providerState() });

    renderSection();

    expect(await screen.findByText('orders@agilo.com')).toBeInTheDocument();
    expect(screen.getByText('RESEND_API_KEY')).toBeInTheDocument();
    expect(
      screen.getByText('This backend is not running on Medusa Cloud'),
    ).toBeInTheDocument();
  });

  it('labels the action Configure until a transport is set up', async () => {
    const state = providerState();
    state.transports[2].credential = null;
    state.transports[2].config = {};
    fetchMock.mockResolvedValue({ provider: state });

    renderSection();
    await screen.findByText('Mailgun');

    expect(screen.getByText('Not configured')).toBeInTheDocument();

    await openRowMenu('Mailgun');
    expect(
      await screen.findByRole('menuitem', { name: 'Configure' }),
    ).toBeVisible();
  });

  it('offers Use only for a transport that could take over', async () => {
    fetchMock.mockResolvedValue({ provider: providerState() });

    renderSection();
    await screen.findByText('Mailgun');

    await openRowMenu('Mailgun');
    expect(await screen.findByRole('menuitem', { name: 'Use' })).toBeVisible();

    await userEvent.keyboard('{Escape}');

    await openRowMenu('Resend');
    await screen.findByRole('menuitem', { name: 'Edit' });
    expect(screen.queryByRole('menuitem', { name: 'Use' })).toBeNull();
  });

  it('activates a transport from the row menu', async () => {
    fetchMock.mockResolvedValue({ provider: providerState() });

    renderSection();
    await screen.findByText('Mailgun');

    await openRowMenu('Mailgun');
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Use' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/admin/email/provider', {
        method: 'POST',
        body: {
          transport_id: 'mailgun',
          config: {
            from_address: 'orders@mg.agilo.com',
            domain: 'mg.agilo.com',
          },
        },
      }),
    );

    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Mailgun now sends email.',
      ),
    );
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it('opens the drawer from Edit', async () => {
    fetchMock.mockResolvedValue({ provider: providerState() });

    renderSection();
    await screen.findByText('Mailgun');

    await openRowMenu('Mailgun');
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Edit' }),
    );

    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByLabelText('Sending domain')).toHaveValue(
      'mg.agilo.com',
    );
    expect(
      within(drawer).getByRole('button', { name: 'Save & activate' }),
    ).toBeInTheDocument();
  });

  it('offers Send test on any configured transport, active or not', async () => {
    fetchMock.mockResolvedValue({ provider: providerState() });

    renderSection();
    await screen.findByText('Mailgun');

    await openRowMenu('Mailgun');
    expect(
      await screen.findByRole('menuitem', { name: 'Send test' }),
    ).toBeVisible();

    await userEvent.keyboard('{Escape}');

    await openRowMenu('Resend');
    expect(
      await screen.findByRole('menuitem', { name: 'Send test' }),
    ).toBeVisible();

    await userEvent.keyboard('{Escape}');

    await openRowMenu('Medusa Cloud');
    await screen.findByRole('menuitem', { name: 'Edit' });
    expect(screen.queryByRole('menuitem', { name: 'Send test' })).toBeNull();
  });

  it('sends a test email from its own drawer, naming the transport', async () => {
    fetchMock.mockResolvedValue({ provider: providerState() });

    renderSection();
    await screen.findByText('Mailgun');

    await openRowMenu('Mailgun');
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
        '/admin/email/provider/send-test',
        {
          method: 'POST',
          body: { to: 'me@example.com', transport_id: 'mailgun' },
        },
      ),
    );
    await waitFor(() =>
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Test email sent to me@example.com.',
      ),
    );
  });

  it('shows the error message when the request fails', async () => {
    fetchMock.mockRejectedValue({ message: 'Not allowed to view providers' });

    renderSection();

    expect(
      await screen.findByText('Not allowed to view providers'),
    ).toBeInTheDocument();
  });
});

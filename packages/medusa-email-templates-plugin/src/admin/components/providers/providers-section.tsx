import { Check, PaperPlane, PencilSquare } from '@medusajs/icons';
import {
  Alert,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Heading,
  StatusBadge,
  Text,
  toast,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';

import {
  useEmailProvider,
  useSaveEmailProvider,
} from '../../hooks/use-email-provider';
import { getApiErrorMessage } from '../../lib/api-error';
import type { EmailProviderTransportState } from '../../lib/types';
import TestEmailDrawer from './test-email-drawer';
import TransportDrawer from './provider-drawer';

type StatusColor = 'green' | 'red' | 'blue' | 'orange' | 'grey';

type RowStatus = {
  color: StatusColor;
  label: string;
};

const isConfigured = (transport: EmailProviderTransportState): boolean =>
  transport.credential !== null ||
  transport.credential_sources.includes('managed');

const statusFor = (transport: EmailProviderTransportState): RowStatus => {
  if (!isConfigured(transport)) {
    return { color: 'orange', label: 'Not configured' };
  }

  if (!transport.available) {
    return transport.selected
      ? { color: 'red', label: 'Cannot send' }
      : { color: 'grey', label: 'Unavailable' };
  }

  return transport.selected
    ? { color: 'green', label: 'Active' }
    : { color: 'blue', label: 'Available' };
};

const fromAddress = (transport: EmailProviderTransportState): string =>
  typeof transport.config.from_address === 'string'
    ? transport.config.from_address
    : '-';

const credentialSummary = (transport: EmailProviderTransportState): string => {
  const credential = transport.credential;

  if (!credential) {
    return '-';
  }

  switch (credential.source) {
    case 'environment':
      return credential.env_var_name ?? 'Environment variable';
    case 'encrypted_database':
      return 'Stored API key';
    case 'managed':
      return 'Managed by Medusa';
    default:
      return '-';
  }
};

const columnHelper = createDataTableColumnHelper<EmailProviderTransportState>();

const SectionHeading = () => (
  <>
    <Heading level="h2">Provider</Heading>
    <Text size="small" className="text-ui-fg-subtle">
      One provider sends every email. The others keep their settings, so
      switching back takes a single click.
    </Text>
  </>
);

const ProvidersSection = () => {
  const { data: provider, isPending, isError, error } = useEmailProvider();
  const saveProvider = useSaveEmailProvider();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const transports = useMemo(
    () => provider?.transports ?? [],
    [provider?.transports],
  );

  const editing = transports.find((it) => it.id === editingId) ?? null;
  const testing = transports.find((it) => it.id === testingId) ?? null;

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'transport',
        header: 'Provider',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <Text size="small" leading="compact" weight="plus">
              {row.original.label}
            </Text>
            {!row.original.available && row.original.unavailable_reason && (
              <Text
                size="xsmall"
                leading="compact"
                className="text-ui-fg-subtle"
              >
                {row.original.unavailable_reason}
              </Text>
            )}
          </div>
        ),
      }),
      columnHelper.display({
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = statusFor(row.original);

          return <StatusBadge color={status.color}>{status.label}</StatusBadge>;
        },
      }),
      columnHelper.accessor((row) => fromAddress(row), {
        id: 'from',
        header: 'Sends from',
      }),
      columnHelper.accessor((row) => credentialSummary(row), {
        id: 'credential',
        header: 'Credential',
      }),
      columnHelper.action({
        actions: (ctx) => {
          const transport = ctx.row.original;
          const actions = [];

          if (!transport.selected && transport.available) {
            actions.push({
              label: 'Use',
              icon: <Check />,
              onClick: () =>
                saveProvider.mutate(
                  {
                    transport_id: transport.id,
                    config: transport.config,
                  },
                  {
                    onSuccess: () =>
                      toast.success(`${transport.label} now sends email.`),
                    onError: (mutationError: unknown) =>
                      toast.error(getApiErrorMessage(mutationError)),
                  },
                ),
            });
          }

          actions.push({
            label: isConfigured(transport) ? 'Edit' : 'Configure',
            icon: <PencilSquare />,
            onClick: () => setEditingId(transport.id),
          });

          if (isConfigured(transport) && transport.available) {
            actions.push({
              label: 'Send test',
              icon: <PaperPlane />,
              onClick: () => setTestingId(transport.id),
            });
          }

          return actions;
        },
      }),
    ],
    [saveProvider],
  );

  const table = useDataTable({
    data: transports,
    columns,
    getRowId: (transport) => transport.id,
    isLoading: isPending,
  });

  if (isError) {
    return (
      <Container className="divide-y p-0">
        <div className="flex flex-col gap-y-1 px-6 py-4">
          <SectionHeading />
        </div>
        <div className="px-6 py-4">
          <Alert variant="error">{getApiErrorMessage(error)}</Alert>
        </div>
      </Container>
    );
  }

  return (
    <Container className="divide-y overflow-hidden p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex-col items-start gap-y-1">
          <SectionHeading />
        </DataTable.Toolbar>
        <DataTable.Table />
      </DataTable>

      {editing && (
        <TransportDrawer
          key={editing.id}
          transport={editing}
          encryptionAvailable={provider?.encryption_available ?? false}
          onClose={() => setEditingId(null)}
        />
      )}

      {testing && (
        <TestEmailDrawer
          key={`test-${testing.id}`}
          transport={testing}
          onClose={() => setTestingId(null)}
        />
      )}
    </Container>
  );
};

export default ProvidersSection;

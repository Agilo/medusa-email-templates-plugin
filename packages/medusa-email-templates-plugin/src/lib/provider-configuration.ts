import type { Logger } from '@medusajs/framework/types';

import { maskCredential, type MaskedCredential } from './credentials/mask';
import {
  resolveCredential,
  type StoredCredential,
} from './credentials/resolve-credential';
import { isEncryptionAvailable } from './crypto/encryption-key';
import { getErrorMessage, providerNotReadyError } from './errors';
import { getEmailTransport, listEmailTransports } from './transports/registry';
import type {
  CloudEmailConfig,
  CredentialSource,
  EmailTransport,
  EmailTransportContext,
} from './transports/types';

export interface EmailProviderConfigurationRecord {
  id: string;
  transport_id: string;
  is_selected: boolean;
  config: Record<string, unknown> | null;
  credential?: StoredCredential | null;
}

export interface EmailProviderTransportState {
  id: string;
  label: string;
  selected: boolean;
  available: boolean;
  unavailable_reason?: string;
  credential_sources: CredentialSource[];
  config: Record<string, unknown>;
  credential: MaskedCredential | null;
}

export interface EmailProviderState {
  selected_transport_id: string | null;
  /** Whether MEDUSA_EMAIL_ENCRYPTION_KEY is set, enabling stored API keys. */
  encryption_available: boolean;
  transports: EmailProviderTransportState[];
}

export type TransportContextOptions = {
  logger?: Logger;
  idempotencyKey?: string | null;
  /** Medusa Cloud settings, when the app runs on Cloud. */
  cloud?: CloudEmailConfig | null;
};

type ModuleServiceLike = {
  listEmailProviderConfigurations: (
    filters: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => Promise<unknown>;
};

export const listEmailProviderConfigurations = async (
  service: ModuleServiceLike,
  filters: { is_selected?: boolean; transport_id?: string } = {},
): Promise<EmailProviderConfigurationRecord[]> =>
  (await service.listEmailProviderConfigurations(filters, {
    relations: ['credential'],
  })) as EmailProviderConfigurationRecord[];

export const buildTransportContext = (
  configuration: EmailProviderConfigurationRecord,
  options: TransportContextOptions = {},
): EmailTransportContext => ({
  config: configuration.config ?? {},
  credential: resolveCredential(configuration.credential),
  cloud: options.cloud ?? null,
  idempotencyKey: options.idempotencyKey ?? null,
  logger: options.logger,
});

/**
 * Loads the selected transport and its context, failing with a
 * "provider not ready" error when email can't be sent.
 */
export const resolveSelectedTransport = async (
  service: ModuleServiceLike,
  options: TransportContextOptions = {},
): Promise<{
  configuration: EmailProviderConfigurationRecord;
  transport: EmailTransport;
  context: EmailTransportContext;
}> => {
  const [configuration] = await listEmailProviderConfigurations(service, {
    is_selected: true,
  });

  if (!configuration) {
    throw providerNotReadyError(
      'No email provider is selected. Choose one in Settings → Email → Provider.',
    );
  }

  const transport = getEmailTransport(configuration.transport_id);

  if (!transport) {
    throw providerNotReadyError(
      `The selected email transport "${configuration.transport_id}" is not registered.`,
    );
  }

  const context = buildTransportContext(configuration, options);

  if (!(await transport.isAvailable(context))) {
    throw providerNotReadyError(
      `${transport.label} is not available. Check its configuration and credentials.`,
    );
  }

  return { configuration, transport, context };
};

const getAvailability = async (
  transport: EmailTransport,
  configuration: EmailProviderConfigurationRecord | undefined,
  options: TransportContextOptions,
): Promise<{ available: boolean; unavailable_reason?: string }> => {
  // Managed transports (Medusa Cloud) need no stored configuration: their
  // availability depends only on the environment.
  const isManaged = transport.credentialSources.includes('managed');

  if (!configuration && !isManaged) {
    return { available: false, unavailable_reason: 'Not configured.' };
  }

  try {
    const context = configuration
      ? buildTransportContext(configuration, options)
      : { config: {}, credential: null, cloud: options.cloud ?? null };

    const available = await transport.isAvailable(context);

    return available
      ? { available: true }
      : {
          available: false,
          unavailable_reason: isManaged
            ? 'Not available in this environment.'
            : 'Credentials are not configured.',
        };
  } catch (error) {
    return { available: false, unavailable_reason: getErrorMessage(error) };
  }
};

/** Admin-facing provider state. Credentials are always masked. */
export const getEmailProviderState = async (
  service: ModuleServiceLike,
  options: TransportContextOptions = {},
): Promise<EmailProviderState> => {
  const configurations = await listEmailProviderConfigurations(service);
  const byTransport = new Map(
    configurations.map((configuration) => [
      configuration.transport_id,
      configuration,
    ]),
  );

  const transports = await Promise.all(
    listEmailTransports().map(async (transport) => {
      const configuration = byTransport.get(transport.id);

      return {
        id: transport.id,
        label: transport.label,
        selected: Boolean(configuration?.is_selected),
        ...(await getAvailability(transport, configuration, options)),
        credential_sources: transport.credentialSources,
        config: configuration?.config ?? {},
        credential: maskCredential(configuration?.credential),
      };
    }),
  );

  return {
    selected_transport_id:
      configurations.find((configuration) => configuration.is_selected)
        ?.transport_id ?? null,
    encryption_available: isEncryptionAvailable(),
    transports,
  };
};

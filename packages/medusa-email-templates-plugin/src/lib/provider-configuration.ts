import type { Logger } from '@medusajs/framework/types';

import type EmailTemplatesModuleService from '../modules/email-templates/service';
import { maskCredential, type MaskedCredential } from './credentials/mask';
import {
  resolveCredential,
  type StoredCredential,
} from './credentials/resolve-credential';
import { getErrorMessage, providerNotReadyError } from './errors';
import { getEmailTransport, listEmailTransports } from './transports/registry';
import type {
  EmailTransport,
  EmailTransportContext,
  CredentialSource,
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
  // Stored API keys arrive in Phase 3 (PLAN.md §5).
  encryption_available: boolean;
  transports: EmailProviderTransportState[];
}

export const listEmailProviderConfigurations = async (
  service: EmailTemplatesModuleService,
  filters: { is_selected?: boolean; transport_id?: string } = {},
): Promise<EmailProviderConfigurationRecord[]> =>
  (await service.listEmailProviderConfigurations(filters, {
    relations: ['credential'],
  })) as unknown as EmailProviderConfigurationRecord[];

export const buildTransportContext = (
  configuration: EmailProviderConfigurationRecord,
  options: { logger?: Logger; idempotencyKey?: string | null } = {},
): EmailTransportContext => ({
  config: configuration.config ?? {},
  credential: resolveCredential(configuration.credential),
  cloud: null,
  idempotencyKey: options.idempotencyKey ?? null,
  logger: options.logger,
});

/**
 * Loads the selected transport and its context, failing with a
 * "provider not ready" error when email can't be sent.
 */
export const resolveSelectedTransport = async (
  service: EmailTemplatesModuleService,
  options: { logger?: Logger; idempotencyKey?: string | null } = {},
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
): Promise<{ available: boolean; unavailable_reason?: string }> => {
  if (!configuration) {
    return { available: false, unavailable_reason: 'Not configured.' };
  }

  try {
    const available = await transport.isAvailable(
      buildTransportContext(configuration),
    );

    return available
      ? { available: true }
      : {
          available: false,
          unavailable_reason: 'Credentials are not configured.',
        };
  } catch (error) {
    return { available: false, unavailable_reason: getErrorMessage(error) };
  }
};

/** Admin-facing provider state. Credentials are always masked. */
export const getEmailProviderState = async (
  service: EmailTemplatesModuleService,
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
        ...(await getAvailability(transport, configuration)),
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
    encryption_available: false,
    transports,
  };
};

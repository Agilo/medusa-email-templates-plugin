import { mailgunTransport } from './mailgun';
import { localPreviewTransport } from './local-preview';
import { medusaCloudTransport } from './medusa-cloud';
import { resendTransport } from './resend';
import type { EmailTransport } from './types';

const transports = new Map<string, EmailTransport>();

export const registerEmailTransport = (transport: EmailTransport): void => {
  if (transports.has(transport.id)) {
    throw new Error(
      `An email transport with id "${transport.id}" is already registered.`,
    );
  }

  transports.set(transport.id, transport);
};

export const getEmailTransport = (id: string): EmailTransport | undefined =>
  transports.get(id);

export const listEmailTransports = (): EmailTransport[] => [
  ...transports.values(),
];

registerEmailTransport(medusaCloudTransport);
registerEmailTransport(resendTransport);
registerEmailTransport(mailgunTransport);
registerEmailTransport(localPreviewTransport);

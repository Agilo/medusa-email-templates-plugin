import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailErrorCodes } from '../../errors';
import { isCloudEmailConfigured, readCloudEmailConfig } from '../cloud-config';
import { medusaCloudTransport } from '../medusa-cloud';
import type { EmailTransportContext, RenderedEmail } from '../types';

const cloud = {
  apiKey: 'cloud_api_key',
  emailsEndpoint: 'https://emails.medusajs.app',
  environmentHandle: 'env_123',
};

const context = (
  overrides: Partial<EmailTransportContext> = {},
): EmailTransportContext => ({
  config: {},
  credential: null,
  cloud,
  idempotencyKey: null,
  ...overrides,
});

const email = (overrides: Partial<RenderedEmail> = {}): RenderedEmail => ({
  to: 'customer@example.com',
  template: 'order-placed',
  data: { order: { display_id: 1001 } },
  content: { subject: 'Your order', html: '<p>Thanks</p>', text: 'Thanks' },
  ...overrides,
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ id: 'cloud_email_1' }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('cloud config', () => {
  it('reads the settings Medusa injects into projectConfig', () => {
    expect(readCloudEmailConfig({ projectConfig: { cloud } } as never)).toEqual(
      {
        apiKey: 'cloud_api_key',
        emailsEndpoint: 'https://emails.medusajs.app',
        environmentHandle: 'env_123',
        sandboxHandle: undefined,
      },
    );
    expect(readCloudEmailConfig({ projectConfig: {} } as never)).toBeNull();
    expect(readCloudEmailConfig(null)).toBeNull();
  });

  it.each([
    ['a full environment config', cloud, true],
    [
      'a sandbox config',
      { ...cloud, environmentHandle: undefined, sandboxHandle: 'sbx_1' },
      true,
    ],
    [
      'a config with no handle',
      { ...cloud, environmentHandle: undefined },
      false,
    ],
    ['a config with no api key', { ...cloud, apiKey: undefined }, false],
    [
      'a config with no endpoint',
      { ...cloud, emailsEndpoint: undefined },
      false,
    ],
    ['nothing', null, false],
  ])('accepts %s', (_name, value, expected) => {
    expect(isCloudEmailConfigured(value)).toBe(expected);
  });
});

describe('medusaCloudTransport.isAvailable', () => {
  it('follows the same rule as Medusa core', async () => {
    await expect(medusaCloudTransport.isAvailable(context())).resolves.toBe(
      true,
    );
    await expect(
      medusaCloudTransport.isAvailable(context({ cloud: null })),
    ).resolves.toBe(false);
  });
});

describe('medusaCloudTransport.validateConfiguration', () => {
  it('allows an empty config, since Cloud provides the sender', async () => {
    await expect(
      medusaCloudTransport.validateConfiguration({}),
    ).resolves.toEqual({});
  });

  it('accepts and validates an optional from address', async () => {
    await expect(
      medusaCloudTransport.validateConfiguration({
        from_address: 'Shop <orders@example.com>',
      }),
    ).resolves.toEqual({ from_address: 'Shop <orders@example.com>' });

    await expect(
      medusaCloudTransport.validateConfiguration({ from_address: 'nope' }),
    ).rejects.toThrow('Invalid Medusa Cloud configuration');
  });
});

describe('medusaCloudTransport.send', () => {
  it('posts the notification envelope to the Cloud endpoint', async () => {
    const result = await medusaCloudTransport.send(email(), context());

    expect(result).toEqual({ id: 'cloud_email_1' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://emails.medusajs.app/send');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Basic cloud_api_key',
      'x-medusa-environment-handle': 'env_123',
    });
    expect(JSON.parse(init.body)).toEqual({
      to: 'customer@example.com',
      template: 'order-placed',
      data: { order: { display_id: 1001 } },
      content: { subject: 'Your order', html: '<p>Thanks</p>', text: 'Thanks' },
    });
  });

  it('sends the sandbox handle when that is what Cloud injected', async () => {
    await medusaCloudTransport.send(
      email(),
      context({
        cloud: {
          ...cloud,
          environmentHandle: undefined,
          sandboxHandle: 'sbx_1',
        },
      }),
    );

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      'x-medusa-sandbox-handle': 'sbx_1',
    });
  });

  it('forwards from, attachments and provider data when present', async () => {
    await medusaCloudTransport.send(
      email({
        from: 'Shop <orders@example.com>',
        provider_data: { cc: 'support@example.com' },
        attachments: [
          {
            filename: 'invoice.pdf',
            content: 'JVBERi0=',
            content_type: 'application/pdf',
          },
        ],
      }),
      context(),
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      from: 'Shop <orders@example.com>',
      provider_data: { cc: 'support@example.com' },
      attachments: [{ filename: 'invoice.pdf' }],
    });
  });

  it('reports Cloud errors the way Medusa core words them', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ message: 'Sender domain not verified' }),
    });

    await expect(medusaCloudTransport.send(email(), context())).rejects.toThrow(
      expect.objectContaining({
        code: EmailErrorCodes.TRANSPORT_FAILED,
        message:
          'Failed to send email: 422 - Unprocessable Entity: Sender domain not verified',
      }),
    );
  });

  it('fails as not ready when Cloud is not configured', async () => {
    await expect(
      medusaCloudTransport.send(email(), context({ cloud: null })),
    ).rejects.toThrow(
      expect.objectContaining({ code: EmailErrorCodes.PROVIDER_NOT_READY }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

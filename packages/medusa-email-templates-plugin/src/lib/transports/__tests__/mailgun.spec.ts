import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailErrorCodes } from '../../errors';
import { mailgunTransport } from '../mailgun';
import type { EmailTransportContext, RenderedEmail } from '../types';

const API_KEY = 'key-mailgun-unit-test';

const context = (
  overrides: Partial<EmailTransportContext> = {},
): EmailTransportContext => ({
  config: {
    domain: 'mg.example.com',
    region: 'us',
    from_address: 'Shop <orders@mg.example.com>',
  },
  credential: { api_key: API_KEY },
  cloud: null,
  idempotencyKey: null,
  ...overrides,
});

const email = (overrides: Partial<RenderedEmail> = {}): RenderedEmail => ({
  to: 'customer@example.com',
  content: { subject: 'Your order', html: '<p>Thanks</p>', text: 'Thanks' },
  ...overrides,
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id: '<20260916@mg.example.com>', message: 'Queued' }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MEDUSA_EMAIL_MAILGUN_BASE_URL;
});

const sentForm = (): FormData => fetchMock.mock.calls[0][1].body as FormData;

describe('mailgunTransport.validateConfiguration', () => {
  it('accepts a domain and region', async () => {
    await expect(
      mailgunTransport.validateConfiguration({
        domain: 'mg.example.com',
        region: 'eu',
        from_address: 'orders@mg.example.com',
      }),
    ).resolves.toMatchObject({ domain: 'mg.example.com', region: 'eu' });
  });

  it.each([
    ['a missing domain', { region: 'us', from_address: 'a@b.com' }],
    [
      'an invalid domain',
      { domain: 'not a domain', region: 'us', from_address: 'a@b.com' },
    ],
    [
      'an unknown region',
      { domain: 'mg.example.com', region: 'apac', from_address: 'a@b.com' },
    ],
    [
      'an invalid from address',
      { domain: 'mg.example.com', region: 'us', from_address: 'nope' },
    ],
  ])('rejects %s', async (_name, config) => {
    await expect(
      mailgunTransport.validateConfiguration(config),
    ).rejects.toThrow('Invalid Mailgun configuration');
  });
});

describe('mailgunTransport.send', () => {
  it('posts multipart form data to the US endpoint with basic auth', async () => {
    const result = await mailgunTransport.send(email(), context());

    expect(result).toEqual({ id: '<20260916@mg.example.com>' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mailgun.net/v3/mg.example.com/messages');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from(`api:${API_KEY}`).toString('base64')}`,
    );

    const form = sentForm();
    expect(form.get('from')).toBe('Shop <orders@mg.example.com>');
    expect(form.get('to')).toBe('customer@example.com');
    expect(form.get('subject')).toBe('Your order');
    expect(form.get('html')).toBe('<p>Thanks</p>');
    expect(form.get('text')).toBe('Thanks');
  });

  it('uses the EU endpoint for the eu region', async () => {
    await mailgunTransport.send(
      email(),
      context({
        config: {
          domain: 'mg.example.com',
          region: 'eu',
          from_address: 'orders@mg.example.com',
        },
      }),
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.eu.mailgun.net/v3/mg.example.com/messages',
    );
  });

  it('maps provider data and attachments', async () => {
    await mailgunTransport.send(
      email({
        provider_data: {
          cc: 'support@example.com',
          bcc: ['audit@example.com'],
          reply_to: 'help@example.com',
          headers: { 'X-Order': '1001' },
          tags: [{ name: 'type', value: 'order' }, 'manual'],
        },
        attachments: [
          {
            filename: 'invoice.pdf',
            content: Buffer.from('invoice').toString('base64'),
            content_type: 'application/pdf',
          },
        ],
      }),
      context(),
    );

    const form = sentForm();
    expect(form.get('cc')).toBe('support@example.com');
    expect(form.get('bcc')).toBe('audit@example.com');
    expect(form.get('h:Reply-To')).toBe('help@example.com');
    expect(form.get('h:X-Order')).toBe('1001');
    expect(form.getAll('o:tag')).toEqual(['order', 'manual']);

    const attachment = form.get('attachment') as File;
    expect(attachment.name).toBe('invoice.pdf');
    expect(await attachment.text()).toBe('invoice');
  });

  it('falls back to the configured reply-to', async () => {
    await mailgunTransport.send(
      email(),
      context({
        config: {
          domain: 'mg.example.com',
          region: 'us',
          from_address: 'orders@mg.example.com',
          reply_to: 'help@example.com',
        },
      }),
    );

    expect(sentForm().get('h:Reply-To')).toBe('help@example.com');
  });

  it('throws a transport error when Mailgun rejects the message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Invalid private key' }),
    });

    await expect(mailgunTransport.send(email(), context())).rejects.toThrow(
      expect.objectContaining({
        code: EmailErrorCodes.TRANSPORT_FAILED,
        message: 'Mailgun rejected the email: 401 Invalid private key',
      }),
    );
  });

  it('fails as not ready without an API key', async () => {
    await expect(
      mailgunTransport.send(email(), context({ credential: null })),
    ).rejects.toThrow(
      expect.objectContaining({ code: EmailErrorCodes.PROVIDER_NOT_READY }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

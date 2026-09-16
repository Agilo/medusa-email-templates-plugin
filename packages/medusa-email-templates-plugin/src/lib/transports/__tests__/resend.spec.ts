import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailErrorCodes } from '../../errors';
import { resendTransport } from '../resend';
import type { EmailTransportContext, RenderedEmail } from '../types';

const { send, ResendMock } = vi.hoisted(() => {
  const send = vi.fn();
  const ResendMock = vi.fn(function () {
    return { emails: { send } };
  });

  return { send, ResendMock };
});

vi.mock('resend', () => ({ Resend: ResendMock }));

const API_KEY = 're_unit_test_key';

const context = (
  overrides: Partial<EmailTransportContext> = {},
): EmailTransportContext => ({
  config: { from_address: 'Shop <orders@example.com>' },
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

beforeEach(() => {
  send.mockReset();
  ResendMock.mockClear();
  send.mockResolvedValue({ data: { id: 're_email_1' }, error: null });
});

describe('resendTransport.validateConfiguration', () => {
  it.each(['orders@example.com', 'Shop <orders@example.com>'])(
    'accepts from_address %s',
    async (fromAddress) => {
      await expect(
        resendTransport.validateConfiguration({ from_address: fromAddress }),
      ).resolves.toEqual({ from_address: fromAddress });
    },
  );

  it.each([{}, { from_address: 'not-an-email' }, { from_address: 'a@b' }])(
    'rejects %j',
    async (config) => {
      await expect(
        resendTransport.validateConfiguration(config),
      ).rejects.toThrow('Invalid Resend configuration');
    },
  );
});

describe('resendTransport.isAvailable', () => {
  it('requires a resolved API key', async () => {
    await expect(resendTransport.isAvailable(context())).resolves.toBe(true);
    await expect(
      resendTransport.isAvailable(context({ credential: null })),
    ).resolves.toBe(false);
  });
});

describe('resendTransport.send', () => {
  it('maps the rendered email to the Resend payload', async () => {
    const result = await resendTransport.send(
      email({
        attachments: [
          {
            filename: 'invoice.pdf',
            content: 'JVBERi0=',
            content_type: 'application/pdf',
          },
        ],
        provider_data: {
          cc: 'support@example.com',
          bcc: ['audit@example.com'],
          reply_to: 'help@example.com',
          headers: { 'X-Order': '1001', ignored: 1 },
          tags: [{ name: 'type', value: 'order' }, { invalid: true }],
        },
      }),
      context({ idempotencyKey: 'order-1001' }),
    );

    expect(result).toEqual({ id: 're_email_1' });
    expect(ResendMock).toHaveBeenCalledWith(API_KEY);
    expect(send).toHaveBeenCalledWith(
      {
        from: 'Shop <orders@example.com>',
        to: 'customer@example.com',
        subject: 'Your order',
        html: '<p>Thanks</p>',
        text: 'Thanks',
        cc: ['support@example.com'],
        bcc: ['audit@example.com'],
        replyTo: ['help@example.com'],
        headers: { 'X-Order': '1001' },
        tags: [{ name: 'type', value: 'order' }],
        attachments: [
          {
            filename: 'invoice.pdf',
            content: 'JVBERi0=',
            contentType: 'application/pdf',
          },
        ],
      },
      { idempotencyKey: 'order-1001' },
    );
  });

  it('prefers the notification from address and falls back to config reply_to', async () => {
    await resendTransport.send(
      email({ from: 'Other <other@example.com>' }),
      context({
        config: {
          from_address: 'orders@example.com',
          reply_to: 'help@example.com',
        },
      }),
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Other <other@example.com>',
        replyTo: 'help@example.com',
      }),
      undefined,
    );
  });

  it('throws a transport error when Resend returns an error', async () => {
    send.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'Invalid `to` field' },
    });

    await expect(resendTransport.send(email(), context())).rejects.toThrow(
      expect.objectContaining({
        code: EmailErrorCodes.TRANSPORT_FAILED,
        message: 'Resend rejected the email: Invalid `to` field',
      }),
    );
  });

  it('fails as not ready without an API key', async () => {
    await expect(
      resendTransport.send(email(), context({ credential: null })),
    ).rejects.toThrow(
      expect.objectContaining({ code: EmailErrorCodes.PROVIDER_NOT_READY }),
    );
    expect(send).not.toHaveBeenCalled();
  });
});

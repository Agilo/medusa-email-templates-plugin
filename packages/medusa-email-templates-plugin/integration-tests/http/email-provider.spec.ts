import { randomBytes } from 'node:crypto';

import { ENCRYPTION_KEY_ENV } from '../../src/lib/crypto/encryption-key';
import { createAdminHeaders } from '../helpers/admin';
import {
  startCaptureServer,
  type CaptureServer,
} from '../helpers/capture-server';
import { pluginIntegrationSuite } from '../helpers/run';

jest.setTimeout(60000);

const API_KEY_ENV = 'EMAIL_TEMPLATES_HTTP_RESEND_KEY';
const API_KEY = 're_http_secret_value_654321';
const STORED_API_KEY = 're_http_stored_value_987654';

type ErrorResponse = { status: number; data: Record<string, unknown> };
type TransportState = { id: string };

const resendBody = (overrides: Record<string, unknown> = {}) => ({
  transport_id: 'resend',
  config: { from_address: 'Shop <orders@example.com>' },
  credential: { source: 'environment', env_var_name: API_KEY_ENV },
  ...overrides,
});

const mailgunBody = (overrides: Record<string, unknown> = {}) => ({
  transport_id: 'mailgun',
  config: {
    domain: 'mg.example.com',
    region: 'eu',
    from_address: 'Shop <orders@mg.example.com>',
  },
  credential: { source: 'encrypted_database', api_key: STORED_API_KEY },
  ...overrides,
});

const findTransport = (
  data: { provider: { transports: TransportState[] } },
  id: string,
) => data.provider.transports.find((transport) => transport.id === id);

pluginIntegrationSuite(({ api, getContainer }) => {
  let capture: CaptureServer;

  beforeAll(async () => {
    capture = await startCaptureServer();
    process.env.RESEND_BASE_URL = capture.url;
    process.env.MEDUSA_EMAIL_MAILGUN_BASE_URL = capture.url;
    process.env[API_KEY_ENV] = API_KEY;
    process.env[ENCRYPTION_KEY_ENV] = randomBytes(32).toString('base64');
  });

  afterAll(async () => {
    delete process.env.RESEND_BASE_URL;
    delete process.env.MEDUSA_EMAIL_MAILGUN_BASE_URL;
    delete process.env[API_KEY_ENV];
    delete process.env[ENCRYPTION_KEY_ENV];
    await capture.close();
  });

  beforeEach(() => capture.reset());

  const catchResponse = (error: { response: ErrorResponse }) => error.response;

  describe('authentication', () => {
    it('rejects unauthenticated requests (401)', async () => {
      const responses = await Promise.all([
        api.get('/admin/email/provider').catch(catchResponse),
        api.post('/admin/email/provider', resendBody()).catch(catchResponse),
        api
          .post('/admin/email/provider/send-test', { to: 'me@example.com' })
          .catch(catchResponse),
      ]);

      responses.forEach((response) => expect(response.status).toEqual(401));
    });
  });

  describe('GET /admin/email/provider', () => {
    it('lists the transports as not configured before anything is saved', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api.get('/admin/email/provider', { headers });

      expect(res.status).toEqual(200);
      expect(res.data.provider).toMatchObject({
        selected_transport_id: null,
        encryption_available: true,
      });
      expect(res.data.provider.transports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'resend',
            selected: false,
            available: false,
            credential: null,
          }),
          expect.objectContaining({ id: 'mailgun', selected: false }),
          // No MEDUSA_CLOUD_* settings here, so Cloud is unavailable.
          expect.objectContaining({
            id: 'medusa-cloud',
            available: false,
            credential_sources: ['managed'],
          }),
        ]),
      );
    });
  });

  describe('Medusa Cloud outside Cloud', () => {
    it('refuses to select Medusa Cloud (409)', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .post(
          '/admin/email/provider',
          { transport_id: 'medusa-cloud', config: {} },
          { headers },
        )
        .catch(catchResponse);

      expect(res.status).toEqual(409);
      expect(res.data).toMatchObject({
        code: 'email_provider_not_ready',
        message: expect.stringContaining('not available in this environment'),
      });
    });
  });

  describe('POST /admin/email/provider', () => {
    it('saves and selects Resend with an environment credential, masking the secret', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api.post('/admin/email/provider', resendBody(), {
        headers,
      });

      expect(res.status).toEqual(200);
      expect(res.data.provider.selected_transport_id).toEqual('resend');
      expect(findTransport(res.data, 'resend')).toMatchObject({
        selected: true,
        available: true,
        config: { from_address: 'Shop <orders@example.com>' },
        credential: {
          source: 'environment',
          env_var_name: API_KEY_ENV,
          configured: true,
        },
      });

      const fetched = await api.get('/admin/email/provider', { headers });
      expect(fetched.data.provider.selected_transport_id).toEqual('resend');
      expect(JSON.stringify(res.data)).not.toContain(API_KEY);
      expect(JSON.stringify(fetched.data)).not.toContain(API_KEY);
    });

    it('stores an encrypted API key and never returns it', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api.post('/admin/email/provider', mailgunBody(), {
        headers,
      });

      expect(res.status).toEqual(200);
      expect(res.data.provider.selected_transport_id).toEqual('mailgun');
      expect(findTransport(res.data, 'mailgun')).toMatchObject({
        selected: true,
        available: true,
        config: { domain: 'mg.example.com', region: 'eu' },
        credential: { source: 'encrypted_database', configured: true },
      });

      const fetched = await api.get('/admin/email/provider', { headers });
      [res.data, fetched.data].forEach((payload) => {
        const body = JSON.stringify(payload);
        expect(body).not.toContain(STORED_API_KEY);
        expect(body).not.toContain('ciphertext');
        expect(body).not.toContain('key_fingerprint');
      });
    });

    it('keeps the stored key when saved again without one', async () => {
      const headers = await createAdminHeaders(getContainer());
      await api.post('/admin/email/provider', mailgunBody(), { headers });

      const res = await api.post(
        '/admin/email/provider',
        mailgunBody({ credential: { source: 'encrypted_database' } }),
        { headers },
      );

      expect(res.status).toEqual(200);
      expect(findTransport(res.data, 'mailgun')).toMatchObject({
        available: true,
        credential: { source: 'encrypted_database', configured: true },
      });
    });

    it('rejects a stored key when no encryption key is configured (400)', async () => {
      const headers = await createAdminHeaders(getContainer());
      const encryptionKey = process.env[ENCRYPTION_KEY_ENV];
      delete process.env[ENCRYPTION_KEY_ENV];

      try {
        const res = await api
          .post('/admin/email/provider', mailgunBody(), { headers })
          .catch(catchResponse);

        expect(res.status).toEqual(400);
        expect(String(res.data.message)).toContain(ENCRYPTION_KEY_ENV);

        const fetched = await api.get('/admin/email/provider', { headers });
        expect(fetched.data.provider.encryption_available).toBe(false);
      } finally {
        process.env[ENCRYPTION_KEY_ENV] = encryptionKey;
      }
    });

    it('reports a missing environment variable without failing the save', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api.post(
        '/admin/email/provider',
        resendBody({
          credential: {
            source: 'environment',
            env_var_name: 'EMAIL_TEMPLATES_UNSET_KEY',
          },
        }),
        { headers },
      );

      expect(res.status).toEqual(200);
      expect(findTransport(res.data, 'resend')).toMatchObject({
        available: false,
        credential: { configured: false, reason: 'env_var_missing' },
      });
    });

    it.each([
      ['a missing transport_id', { transport_id: undefined }],
      [
        'an invalid environment variable name',
        {
          credential: { source: 'environment', env_var_name: 'not-valid' },
        },
      ],
      ['an unknown field', { secret: 'nope' }],
      ['an unknown transport', { transport_id: 'carrier-pigeon' }],
      ['an invalid from address', { config: { from_address: 'not-an-email' } }],
      ['a missing credential', { credential: undefined }],
    ])('rejects %s (400)', async (_, overrides) => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .post('/admin/email/provider', resendBody(overrides), { headers })
        .catch(catchResponse);

      expect(res.status).toEqual(400);
    });

    it.each([
      ['a missing domain', { region: 'eu', from_address: 'a@mg.example.com' }],
      [
        'an unknown region',
        {
          domain: 'mg.example.com',
          region: 'apac',
          from_address: 'a@mg.example.com',
        },
      ],
    ])('rejects Mailgun with %s (400)', async (_, config) => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .post('/admin/email/provider', mailgunBody({ config }), { headers })
        .catch(catchResponse);

      expect(res.status).toEqual(400);
    });
  });

  describe('POST /admin/email/provider/send-test', () => {
    it('rejects an invalid recipient (400)', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .post('/admin/email/provider/send-test', { to: 'nope' }, { headers })
        .catch(catchResponse);

      expect(res.status).toEqual(400);
    });

    it('returns 409 when no provider is selected', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .post(
          '/admin/email/provider/send-test',
          { to: 'me@example.com' },
          { headers },
        )
        .catch(catchResponse);

      expect(res.status).toEqual(409);
      expect(res.data).toMatchObject({
        code: 'email_provider_not_ready',
        message: expect.stringContaining('No email provider is selected'),
      });
    });

    it('sends a test email through the selected transport', async () => {
      const headers = await createAdminHeaders(getContainer());
      await api.post('/admin/email/provider', resendBody(), { headers });
      capture.respondWith(200, { id: 're_test_email' });

      const res = await api.post(
        '/admin/email/provider/send-test',
        { to: 'me@example.com' },
        { headers },
      );

      expect(res.status).toEqual(200);
      expect(res.data.result).toMatchObject({
        external_id: 're_test_email',
        transport_id: 'resend',
        notification_id: expect.any(String),
      });
      expect(capture.requests).toHaveLength(1);
      expect(capture.requests[0].json()).toMatchObject({
        from: 'Shop <orders@example.com>',
        to: 'me@example.com',
        subject: 'Test email from Medusa',
      });
    });

    it('sends through Mailgun with a stored key', async () => {
      const headers = await createAdminHeaders(getContainer());
      await api.post('/admin/email/provider', mailgunBody(), { headers });
      capture.respondWith(200, { id: '<mg-test>', message: 'Queued' });

      const res = await api.post(
        '/admin/email/provider/send-test',
        { to: 'me@example.com' },
        { headers },
      );

      expect(res.status).toEqual(200);
      expect(res.data.result).toMatchObject({
        external_id: '<mg-test>',
        transport_id: 'mailgun',
      });
      expect(capture.requests[0].url).toEqual('/v3/mg.example.com/messages');
      expect(capture.requests[0].headers.authorization).toEqual(
        `Basic ${Buffer.from(`api:${STORED_API_KEY}`).toString('base64')}`,
      );
    });

    it('returns 502 with a redacted message when the transport fails', async () => {
      const headers = await createAdminHeaders(getContainer());
      await api.post('/admin/email/provider', resendBody(), { headers });
      capture.respondWith(403, {
        name: 'invalid_api_key',
        message: `API key ${API_KEY} is invalid`,
      });

      const res = await api
        .post(
          '/admin/email/provider/send-test',
          { to: 'me@example.com' },
          { headers },
        )
        .catch(catchResponse);

      expect(res.status).toEqual(502);
      expect(res.data).toMatchObject({ code: 'email_transport_failed' });
      expect(String(res.data.message)).toContain('Resend rejected the email');
      expect(JSON.stringify(res.data)).not.toContain(API_KEY);
    });
  });
});

import { createAdminHeaders } from '../helpers/admin';
import {
  startCaptureServer,
  type CaptureServer,
} from '../helpers/capture-server';
import { pluginIntegrationSuite } from '../helpers/run';

jest.setTimeout(60000);

const API_KEY_ENV = 'EMAIL_TEMPLATES_HTTP_RESEND_KEY';
const API_KEY = 're_http_secret_value_654321';

type ErrorResponse = { status: number; data: Record<string, unknown> };

const resendBody = (overrides: Record<string, unknown> = {}) => ({
  transport_id: 'resend',
  config: { from_address: 'Shop <orders@example.com>' },
  credential: { source: 'environment', env_var_name: API_KEY_ENV },
  ...overrides,
});

pluginIntegrationSuite(({ api, getContainer }) => {
  let capture: CaptureServer;

  beforeAll(async () => {
    capture = await startCaptureServer();
    process.env.RESEND_BASE_URL = capture.url;
    process.env[API_KEY_ENV] = API_KEY;
  });

  afterAll(async () => {
    delete process.env.RESEND_BASE_URL;
    delete process.env[API_KEY_ENV];
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
    it('lists Resend as not configured before anything is saved', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api.get('/admin/email/provider', { headers });

      expect(res.status).toEqual(200);
      expect(res.data.provider).toMatchObject({
        selected_transport_id: null,
        encryption_available: false,
      });
      expect(res.data.provider.transports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'resend',
            selected: false,
            available: false,
            credential: null,
          }),
        ]),
      );
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
      expect(
        res.data.provider.transports.find(
          (transport: { id: string }) => transport.id === 'resend',
        ),
      ).toMatchObject({
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
      expect(
        res.data.provider.transports.find(
          (transport: { id: string }) => transport.id === 'resend',
        ),
      ).toMatchObject({
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
      [
        'a stored API key (not supported yet)',
        { credential: { source: 'encrypted_database', api_key: 're_x' } },
      ],
    ])('rejects %s (400)', async (_, overrides) => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .post('/admin/email/provider', resendBody(overrides), { headers })
        .catch(catchResponse);

      expect(res.status).toEqual(400);
    });
  });

  describe('POST /admin/email/provider/test', () => {
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

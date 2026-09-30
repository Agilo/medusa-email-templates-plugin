import { createAdminHeaders } from '../helpers/admin';
import {
  startCaptureServer,
  type CaptureServer,
} from '../helpers/capture-server';
import { pluginIntegrationSuite } from '../helpers/run';

jest.setTimeout(60000);

const API_KEY_ENV = 'EMAIL_TEMPLATES_HTTP_TEMPLATE_KEY';
const API_KEY = 're_templates_secret_value_123';

type ErrorResponse = { status: number; data: Record<string, unknown> };
type TemplateListItem = { template_key: string };

const savedTemplate = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  subject_template: 'Your order #{{ order.display_id }}',
  html_template: '<p>Hi {{ order.customer_name }}</p>',
  editor_content: { type: 'doc', content: [] },
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

  const selectResend = (headers: Record<string, string>) =>
    api.post(
      '/admin/email/provider',
      {
        transport_id: 'resend',
        config: { from_address: 'Shop <orders@example.com>' },
        credential: { source: 'environment', env_var_name: API_KEY_ENV },
      },
      { headers },
    );

  describe('authentication', () => {
    it('rejects unauthenticated requests (401)', async () => {
      const responses = await Promise.all([
        api.get('/admin/email/templates').catch(catchResponse),
        api.get('/admin/email/templates/order-placed').catch(catchResponse),
        api
          .post('/admin/email/templates/order-placed', savedTemplate())
          .catch(catchResponse),
        api
          .post('/admin/email/templates/order-placed/preview', {})
          .catch(catchResponse),
        api
          .post('/admin/email/templates/order-placed/send-test', {
            to: 'me@example.com',
          })
          .catch(catchResponse),
      ]);

      responses.forEach((response) => expect(response.status).toEqual(401));
    });
  });

  describe('GET /admin/email/templates', () => {
    it('lists every registered template, saved or not', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api.get('/admin/email/templates', { headers });

      expect(res.status).toEqual(200);
      const keys = res.data.templates.map(
        (template: TemplateListItem) => template.template_key,
      );
      expect(keys).toEqual(
        expect.arrayContaining([
          'order-placed',
          'invite-created',
          'invite-resent',
          'password-reset-user',
          'password-reset-customer',
          'email-verification',
        ]),
      );
      expect(res.data.count).toEqual(res.data.templates.length);

      const orderPlaced = res.data.templates.find(
        (template: TemplateListItem) =>
          template.template_key === 'order-placed',
      );
      expect(orderPlaced).toMatchObject({
        id: null,
        enabled: false,
        is_customized: false,
        event: 'order.placed',
      });
    });

    it('warns when a customer link cannot be built', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api.get('/admin/email/templates', { headers });

      expect(
        res.data.templates.find(
          (template: TemplateListItem) =>
            template.template_key === 'password-reset-customer',
        ).warnings,
      ).toEqual(['storefront_url_not_configured']);
    });
  });

  describe('GET /admin/email/templates/:id', () => {
    it('returns the variables and the built-in default', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api.get('/admin/email/templates/order-placed', {
        headers,
      });

      expect(res.status).toEqual(200);
      expect(res.data.template).toMatchObject({
        template_key: 'order-placed',
        is_customized: false,
        html_template: null,
      });
      expect(res.data.template.default_template.subject).toContain(
        '{{ order.display_id }}',
      );
      expect(
        res.data.template.variables.map((v: { key: string }) => v.key),
      ).toEqual(expect.arrayContaining(['order.display_id', 'store.name']));
    });

    it('returns 404 for an unregistered template', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .get('/admin/email/templates/not-a-template', { headers })
        .catch(catchResponse);

      expect(res.status).toEqual(404);
    });
  });

  describe('POST /admin/email/templates/:id', () => {
    it('saves a template and reads it back', async () => {
      const headers = await createAdminHeaders(getContainer());

      const saved = await api.post(
        '/admin/email/templates/order-placed',
        savedTemplate(),
        { headers },
      );

      expect(saved.status).toEqual(200);
      expect(saved.data.template).toMatchObject({
        enabled: true,
        is_customized: true,
        subject_template: 'Your order #{{ order.display_id }}',
        html_template: '<p>Hi {{ order.customer_name }}</p>',
      });
      expect(saved.data.template.id).toEqual(expect.any(String));

      const fetched = await api.get('/admin/email/templates/order-placed', {
        headers,
      });
      expect(fetched.data.template).toMatchObject({
        enabled: true,
        editor_content: { type: 'doc', content: [] },
      });
    });

    /*
     * `editor_content` is the editor's source for the HTML. Kept after the
     * HTML changed underneath it, the editor reopened the old email while the
     * new one sent, and the next body save put the old one back.
     */
    it('drops the editor content when HTML is saved without it', async () => {
      const headers = await createAdminHeaders(getContainer());

      await api.post('/admin/email/templates/order-placed', savedTemplate(), {
        headers,
      });
      await api.post(
        '/admin/email/templates/order-placed',
        { html_template: '<p>Written by hand</p>' },
        { headers },
      );

      const fetched = await api.get('/admin/email/templates/order-placed', {
        headers,
      });
      expect(fetched.data.template).toMatchObject({
        html_template: '<p>Written by hand</p>',
        editor_content: null,
      });
    });

    it('keeps the editor content when only the subject changes', async () => {
      const headers = await createAdminHeaders(getContainer());

      await api.post('/admin/email/templates/order-placed', savedTemplate(), {
        headers,
      });
      await api.post(
        '/admin/email/templates/order-placed',
        { subject_template: 'New subject' },
        { headers },
      );

      const fetched = await api.get('/admin/email/templates/order-placed', {
        headers,
      });
      expect(fetched.data.template.editor_content).toEqual({
        type: 'doc',
        content: [],
      });
    });

    it.each([
      ['a broken subject', { subject_template: '{{ order.display_id' }],
      ['a broken body', { html_template: '{% for item in %}' }],
      ['a forbidden tag', { html_template: '{% include "other" %}' }],
    ])('rejects %s (400)', async (_name, overrides) => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .post('/admin/email/templates/order-placed', savedTemplate(overrides), {
          headers,
        })
        .catch(catchResponse);

      expect(res.status).toEqual(400);
      expect(String(res.data.message)).toContain('Liquid');
    });

    // `enabled` is deliberately absent here: omitting a field is a partial
    // update, covered by the toggle tests above.
    it.each([
      ['an empty subject', { subject_template: '' }],
      ['an unknown field', { nope: true }],
    ])('rejects %s (400)', async (_name, overrides) => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .post('/admin/email/templates/order-placed', savedTemplate(overrides), {
          headers,
        })
        .catch(catchResponse);

      expect(res.status).toEqual(400);
    });

    it('returns 404 for an unregistered template', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .post('/admin/email/templates/not-a-template', savedTemplate(), {
          headers,
        })
        .catch(catchResponse);

      expect(res.status).toEqual(404);
    });

    it('enabling a default template does not make it customised', async () => {
      const headers = await createAdminHeaders(getContainer());

      // Turning a template on stores a row, but its content still matches the
      // built-in default, so the list must not claim it was edited.
      const res = await api.post(
        '/admin/email/templates/order-placed',
        { enabled: true },
        { headers },
      );

      expect(res.status).toEqual(200);
      expect(res.data.template).toMatchObject({
        enabled: true,
        is_customized: false,
      });
      expect(res.data.template.subject_template).toEqual(
        res.data.template.default_template.subject,
      );
    });

    it('toggles enabled without clearing the saved body', async () => {
      const headers = await createAdminHeaders(getContainer());
      await api.post('/admin/email/templates/order-placed', savedTemplate(), {
        headers,
      });

      // What the templates list sends when the switch is flipped.
      const res = await api.post(
        '/admin/email/templates/order-placed',
        { enabled: false },
        { headers },
      );

      expect(res.status).toEqual(200);
      expect(res.data.template).toMatchObject({
        enabled: false,
        subject_template: 'Your order #{{ order.display_id }}',
        html_template: '<p>Hi {{ order.customer_name }}</p>',
        editor_content: { type: 'doc', content: [] },
        is_customized: true,
      });
    });

    it('clears a body only when explicitly sent as null', async () => {
      const headers = await createAdminHeaders(getContainer());
      await api.post('/admin/email/templates/order-placed', savedTemplate(), {
        headers,
      });

      const res = await api.post(
        '/admin/email/templates/order-placed',
        { html_template: null },
        { headers },
      );

      expect(res.status).toEqual(200);
      expect(res.data.template).toMatchObject({
        html_template: null,
        // Untouched fields survive.
        enabled: true,
        subject_template: 'Your order #{{ order.display_id }}',
      });
    });
  });

  describe('DELETE /admin/email/templates/:id', () => {
    it('reverts the content but keeps a live template sending', async () => {
      const headers = await createAdminHeaders(getContainer());
      await api.post('/admin/email/templates/order-placed', savedTemplate(), {
        headers,
      });

      const res = await api.delete('/admin/email/templates/order-placed', {
        headers,
      });

      expect(res.status).toEqual(200);
      expect(res.data.template).toMatchObject({
        is_customized: false,
        html_template: null,
        editor_content: null,
        // Resetting the content must not silently stop the email.
        enabled: true,
      });
      // Back to what the event definition declares in code.
      expect(res.data.template.subject_template).toEqual(
        res.data.template.default_template.subject,
      );

      const fetched = await api.get('/admin/email/templates/order-placed', {
        headers,
      });
      expect(fetched.data.template).toMatchObject({
        is_customized: false,
        enabled: true,
      });
    });

    it('drops the row when the template is not sending', async () => {
      const headers = await createAdminHeaders(getContainer());
      await api.post(
        '/admin/email/templates/order-placed',
        savedTemplate({ enabled: false }),
        { headers },
      );

      const res = await api.delete('/admin/email/templates/order-placed', {
        headers,
      });

      expect(res.status).toEqual(200);
      expect(res.data.template).toMatchObject({
        id: null,
        is_customized: false,
        enabled: false,
      });
    });

    it('can be saved again after a reset', async () => {
      const headers = await createAdminHeaders(getContainer());
      await api.post(
        '/admin/email/templates/order-placed',
        savedTemplate({ enabled: false }),
        { headers },
      );
      await api.delete('/admin/email/templates/order-placed', { headers });

      // The unique index on template_key is partial, so the soft-deleted row
      // does not block a new one.
      const res = await api.post(
        '/admin/email/templates/order-placed',
        savedTemplate({ subject_template: 'Second attempt' }),
        { headers },
      );

      expect(res.status).toEqual(200);
      expect(res.data.template).toMatchObject({
        is_customized: true,
        subject_template: 'Second attempt',
      });
    });

    it('is a no-op for a template that was never saved', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api.delete('/admin/email/templates/invite-created', {
        headers,
      });

      expect(res.status).toEqual(200);
      expect(res.data.template).toMatchObject({
        is_customized: false,
        id: null,
      });
    });

    it('returns 404 for an unregistered template', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .delete('/admin/email/templates/not-a-template', { headers })
        .catch(catchResponse);

      expect(res.status).toEqual(404);
    });
  });

  describe('POST /admin/email/templates/:id/preview', () => {
    it('renders with sample data without sending anything', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api.post(
        '/admin/email/templates/order-placed/preview',
        {},
        { headers },
      );

      expect(res.status).toEqual(200);
      expect(res.data.preview.subject).toContain('1001');
      expect(res.data.preview.html).toContain('Medusa T-Shirt');
      expect(res.data.preview.html).not.toContain('{{');
      expect(res.data.preview.text).toBeTruthy();
      expect(capture.requests).toHaveLength(0);
    });

    it('previews unsaved edits and data overrides', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api.post(
        '/admin/email/templates/order-placed/preview',
        {
          data: { order: { display_id: 4242 } },
          draft: { subject_template: 'Draft #{{ order.display_id }}' },
        },
        { headers },
      );

      expect(res.data.preview.subject).toEqual('Draft #4242');
    });

    it('reports a broken draft (400)', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .post(
          '/admin/email/templates/order-placed/preview',
          { draft: { subject_template: '{{ oops' } },
          { headers },
        )
        .catch(catchResponse);

      expect(res.status).toEqual(400);
    });
  });

  describe('POST /admin/email/templates/:id/send-test', () => {
    it('sends a rendered template even while it is disabled', async () => {
      const headers = await createAdminHeaders(getContainer());
      await selectResend(headers);
      capture.respondWith(200, { id: 're_template_test' });

      const res = await api.post(
        '/admin/email/templates/order-placed/send-test',
        { to: 'me@example.com' },
        { headers },
      );

      expect(res.status).toEqual(200);
      expect(res.data.result).toMatchObject({
        external_id: 're_template_test',
        transport_id: 'resend',
      });

      const payload = capture.requests[0].json<{ to: string; html: string }>();
      expect(payload.to).toEqual('me@example.com');
      expect(payload.html).toContain('Medusa T-Shirt');
    });

    it('returns 409 when no provider is selected', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .post(
          '/admin/email/templates/order-placed/send-test',
          { to: 'me@example.com' },
          { headers },
        )
        .catch(catchResponse);

      expect(res.status).toEqual(409);
      expect(res.data).toMatchObject({ code: 'email_provider_not_ready' });
    });

    it('returns 502 when the transport fails', async () => {
      const headers = await createAdminHeaders(getContainer());
      await selectResend(headers);
      capture.respondWith(403, { message: 'nope' });

      const res = await api
        .post(
          '/admin/email/templates/order-placed/send-test',
          { to: 'me@example.com' },
          { headers },
        )
        .catch(catchResponse);

      expect(res.status).toEqual(502);
      expect(res.data).toMatchObject({ code: 'email_transport_failed' });
    });

    it('rejects an invalid recipient (400)', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api
        .post(
          '/admin/email/templates/order-placed/send-test',
          { to: 'nope' },
          { headers },
        )
        .catch(catchResponse);

      expect(res.status).toEqual(400);
    });
  });
});

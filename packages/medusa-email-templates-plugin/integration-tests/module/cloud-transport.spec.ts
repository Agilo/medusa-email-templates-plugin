import { Modules, NotificationStatus } from '@medusajs/framework/utils';
// Deep import: Medusa does not export its Cloud provider. Test-only, and the
// point of the contract test below.
import { MedusaCloudEmailNotificationProvider } from '@medusajs/notification/dist/providers/medusa-cloud-email';

import { medusaCloudTransport } from '../../src/lib/transports/medusa-cloud';
import { saveEmailProviderConfigurationWorkflow } from '../../src/workflows/save-email-provider-configuration';
import { createAdminHeaders } from '../helpers/admin';
import {
  startCaptureServer,
  type CaptureServer,
} from '../helpers/capture-server';
import { pluginIntegrationSuite } from '../helpers/run';

jest.setTimeout(60000);

const CLOUD_PORT = 4311;
const CLOUD_ENDPOINT = `http://127.0.0.1:${CLOUD_PORT}`;
const CLOUD_API_KEY = 'cloud_test_api_key';
const CLOUD_ENVIRONMENT = 'env_test_123';

// Set at module scope, before the runner loads medusa-config: Medusa reads the
// MEDUSA_CLOUD_* variables while evaluating `defineConfig`, and the runner's
// `env` option is applied after that, too late to enable Cloud.
process.env.MEDUSA_CLOUD_API_KEY = CLOUD_API_KEY;
process.env.MEDUSA_CLOUD_EMAILS_ENDPOINT = CLOUD_ENDPOINT;
process.env.MEDUSA_CLOUD_ENVIRONMENT_HANDLE = CLOUD_ENVIRONMENT;

const notification = {
  to: 'customer@example.com',
  from: undefined,
  attachments: null,
  channel: 'email',
  template: 'order-placed',
  data: { order: { display_id: 1001 } },
  provider_data: { cc: 'support@example.com' },
  content: { subject: 'Your order', html: '<p>Thanks</p>', text: 'Thanks' },
};

pluginIntegrationSuite(({ api, getContainer }) => {
  let capture: CaptureServer;

  beforeAll(async () => {
    capture = await startCaptureServer({ port: CLOUD_PORT });
  });

  afterAll(async () => {
    await capture.close();
  });

  beforeEach(() => capture.reset());

  describe('contract with Medusa core', () => {
    it('sends exactly the request Medusa core sends', async () => {
      capture.respondWith(200, { id: 'cloud_email_1' });

      const coreProvider = new MedusaCloudEmailNotificationProvider(
        {},
        {
          api_key: CLOUD_API_KEY,
          endpoint: CLOUD_ENDPOINT,
          environment_handle: CLOUD_ENVIRONMENT,
        },
      );

      const coreResult = await coreProvider.send(notification);
      const ourResult = await medusaCloudTransport.send(
        {
          to: notification.to,
          from: notification.from,
          attachments: notification.attachments,
          template: notification.template,
          data: notification.data,
          provider_data: notification.provider_data,
          content: notification.content,
        },
        {
          config: {},
          credential: null,
          cloud: {
            apiKey: CLOUD_API_KEY,
            emailsEndpoint: CLOUD_ENDPOINT,
            environmentHandle: CLOUD_ENVIRONMENT,
          },
        },
      );

      expect(capture.requests).toHaveLength(2);
      const [core, ours] = capture.requests;

      expect(ours.method).toEqual(core.method);
      expect(ours.url).toEqual(core.url);
      expect(ours.body).toEqual(core.body);
      expect(ours.headers.authorization).toEqual(core.headers.authorization);
      expect(ours.headers['content-type']).toEqual(
        core.headers['content-type'],
      );
      expect(ours.headers['x-medusa-environment-handle']).toEqual(
        core.headers['x-medusa-environment-handle'],
      );
      expect(ourResult).toEqual(coreResult);
    });
  });

  describe('with Cloud configured', () => {
    it('reports Medusa Cloud as available', async () => {
      const headers = await createAdminHeaders(getContainer());

      const res = await api.get('/admin/email/provider', { headers });

      expect(
        res.data.provider.transports.find(
          (transport: { id: string }) => transport.id === 'medusa-cloud',
        ),
      ).toMatchObject({
        id: 'medusa-cloud',
        available: true,
        credential_sources: ['managed'],
      });
    });

    it('sends through Cloud once selected, with no credential stored', async () => {
      await saveEmailProviderConfigurationWorkflow(getContainer()).run({
        input: { transport_id: 'medusa-cloud', config: {} },
      });
      capture.respondWith(200, { id: 'cloud_email_2' });

      const sent = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .createNotifications({
          to: 'customer@example.com',
          channel: 'email',
          template: 'host-rendered',
          content: { subject: 'Hello', html: '<p>Hello</p>' },
        });

      expect(sent.status).toEqual(NotificationStatus.SUCCESS);
      expect(sent.external_id).toEqual('cloud_email_2');

      const [request] = capture.requests;
      expect(request.url).toEqual('/send');
      expect(request.headers.authorization).toEqual(`Basic ${CLOUD_API_KEY}`);
      expect(request.headers['x-medusa-environment-handle']).toEqual(
        CLOUD_ENVIRONMENT,
      );
      expect(request.json()).toMatchObject({
        to: 'customer@example.com',
        content: { subject: 'Hello', html: '<p>Hello</p>' },
      });
    });
  });
});

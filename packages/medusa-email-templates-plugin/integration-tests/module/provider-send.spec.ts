import { Modules, NotificationStatus } from '@medusajs/framework/utils';

import { saveEmailProviderConfigurationWorkflow } from '../../src/workflows/save-email-provider-configuration';
import {
  startCaptureServer,
  type CaptureServer,
} from '../helpers/capture-server';
import { pluginIntegrationSuite } from '../helpers/run';

jest.setTimeout(60000);

const API_KEY_ENV = 'EMAIL_TEMPLATES_TEST_RESEND_KEY';
const API_KEY = 're_test_secret_value_123456';

/**
 * The email provider sends pre-rendered content through the selected
 * transport. The Resend transport is pointed at a local capture server.
 */
pluginIntegrationSuite(({ getContainer }) => {
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

  const selectResend = () =>
    saveEmailProviderConfigurationWorkflow(getContainer()).run({
      input: {
        transport_id: 'resend',
        config: { from_address: 'Shop <orders@example.com>' },
        credential: { source: 'environment', env_var_name: API_KEY_ENV },
      },
    });

  it('sends pre-rendered content unchanged through the selected transport', async () => {
    await selectResend();
    capture.respondWith(200, { id: 're_email_1' });

    const notification = await getContainer()
      .resolve(Modules.NOTIFICATION)
      .createNotifications({
        to: 'customer@example.com',
        channel: 'email',
        template: 'host-rendered',
        idempotency_key: 'order-1001-confirmation',
        content: {
          subject: 'Your order',
          html: '<p>Thanks for your order</p>',
          text: 'Thanks for your order',
        },
        provider_data: { cc: 'support@example.com' },
      });

    expect(notification.status).toEqual(NotificationStatus.SUCCESS);
    expect(notification.external_id).toEqual('re_email_1');

    expect(capture.requests).toHaveLength(1);
    const [request] = capture.requests;
    expect(request.method).toEqual('POST');
    expect(request.url).toEqual('/emails');
    expect(request.headers.authorization).toEqual(`Bearer ${API_KEY}`);
    expect(request.headers['idempotency-key']).toEqual(
      'order-1001-confirmation',
    );
    expect(request.json()).toMatchObject({
      from: 'Shop <orders@example.com>',
      to: 'customer@example.com',
      subject: 'Your order',
      html: '<p>Thanks for your order</p>',
      text: 'Thanks for your order',
      cc: ['support@example.com'],
    });
  });

  it('fails clearly when the notification has no rendered content', async () => {
    await selectResend();

    await expect(
      getContainer()
        .resolve(Modules.NOTIFICATION)
        .createNotifications({
          to: 'customer@example.com',
          channel: 'email',
          template: 'order-placed',
          data: { order_id: 'order_1' },
        }),
    ).rejects.toThrow('No managed email template "order-placed"');

    expect(capture.requests).toHaveLength(0);
  });

  it('fails clearly when no email provider is selected', async () => {
    const notificationModule = getContainer().resolve(Modules.NOTIFICATION);

    await expect(
      notificationModule.createNotifications({
        to: 'customer@example.com',
        channel: 'email',
        template: 'host-rendered',
        content: { subject: 'Hello', html: '<p>Hello</p>' },
      }),
    ).rejects.toThrow('No email provider is selected');

    const [failed] = await notificationModule.listNotifications({
      to: 'customer@example.com',
    });
    expect(failed.status).toEqual(NotificationStatus.FAILURE);
  });

  it('redacts the API key from transport errors', async () => {
    await selectResend();
    capture.respondWith(422, {
      name: 'validation_error',
      message: `Invalid key ${API_KEY}`,
    });

    const error = await getContainer()
      .resolve(Modules.NOTIFICATION)
      .createNotifications({
        to: 'customer@example.com',
        channel: 'email',
        template: 'host-rendered',
        content: { subject: 'Hello', html: '<p>Hello</p>' },
      })
      .catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('Resend rejected the email');
    expect((error as Error).message).not.toContain(API_KEY);
  });
});

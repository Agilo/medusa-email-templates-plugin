import { randomBytes } from 'node:crypto';
import { Modules, NotificationStatus } from '@medusajs/framework/utils';

import { ENCRYPTION_KEY_ENV } from '../../src/lib/crypto/encryption-key';
import { saveEmailProviderConfigurationWorkflow } from '../../src/workflows/save-email-provider-configuration';
import {
  startCaptureServer,
  type CaptureServer,
} from '../helpers/capture-server';
import { pluginIntegrationSuite } from '../helpers/run';

jest.setTimeout(60000);

const RESEND_KEY_ENV = 'EMAIL_TEMPLATES_SWITCH_RESEND_KEY';
const RESEND_KEY = 're_switch_secret_value_123';
const MAILGUN_KEY = 'key-switch-secret-value-456';

/**
 * Switching the selected transport takes effect on the next send, without a
 * restart, because the provider reads the selection per send.
 */
pluginIntegrationSuite(({ getContainer }) => {
  let capture: CaptureServer;

  beforeAll(async () => {
    capture = await startCaptureServer();
    process.env.RESEND_BASE_URL = capture.url;
    process.env.MEDUSA_EMAIL_MAILGUN_BASE_URL = capture.url;
    process.env[RESEND_KEY_ENV] = RESEND_KEY;
    process.env[ENCRYPTION_KEY_ENV] = randomBytes(32).toString('base64');
  });

  afterAll(async () => {
    delete process.env.RESEND_BASE_URL;
    delete process.env.MEDUSA_EMAIL_MAILGUN_BASE_URL;
    delete process.env[RESEND_KEY_ENV];
    delete process.env[ENCRYPTION_KEY_ENV];
    await capture.close();
  });

  beforeEach(() => capture.reset());

  const send = () =>
    getContainer()
      .resolve(Modules.NOTIFICATION)
      .createNotifications({
        to: 'customer@example.com',
        channel: 'email',
        template: 'host-rendered',
        content: { subject: 'Hello', html: '<p>Hello</p>' },
      });

  it('sends through the newly selected transport without a restart', async () => {
    await saveEmailProviderConfigurationWorkflow(getContainer()).run({
      input: {
        transport_id: 'resend',
        config: { from_address: 'Shop <orders@example.com>' },
        credential: { source: 'environment', env_var_name: RESEND_KEY_ENV },
      },
    });
    capture.respondWith(200, { id: 're_first' });

    const viaResend = await send();

    expect(viaResend.status).toEqual(NotificationStatus.SUCCESS);
    expect(capture.requests[0].url).toEqual('/emails');
    expect(capture.requests[0].headers.authorization).toEqual(
      `Bearer ${RESEND_KEY}`,
    );

    // Switch to Mailgun with a stored (encrypted) API key.
    capture.reset();
    await saveEmailProviderConfigurationWorkflow(getContainer()).run({
      input: {
        transport_id: 'mailgun',
        config: {
          domain: 'mg.example.com',
          region: 'eu',
          from_address: 'Shop <orders@mg.example.com>',
        },
        credential: { source: 'encrypted_database', api_key: MAILGUN_KEY },
      },
    });
    capture.respondWith(200, { id: '<mg-second>', message: 'Queued' });

    const viaMailgun = await send();

    expect(viaMailgun.status).toEqual(NotificationStatus.SUCCESS);
    expect(viaMailgun.external_id).toEqual('<mg-second>');
    expect(capture.requests).toHaveLength(1);

    const [request] = capture.requests;
    expect(request.url).toEqual('/v3/mg.example.com/messages');
    expect(request.headers.authorization).toEqual(
      `Basic ${Buffer.from(`api:${MAILGUN_KEY}`).toString('base64')}`,
    );
    expect(request.body).toContain('name="to"');
    expect(request.body).toContain('customer@example.com');
  });

  it('keeps the stored API key when it is saved again without one', async () => {
    await saveEmailProviderConfigurationWorkflow(getContainer()).run({
      input: {
        transport_id: 'mailgun',
        config: {
          domain: 'mg.example.com',
          region: 'us',
          from_address: 'orders@mg.example.com',
        },
        credential: { source: 'encrypted_database', api_key: MAILGUN_KEY },
      },
    });

    // Saving again with no api_key keeps the stored one.
    await saveEmailProviderConfigurationWorkflow(getContainer()).run({
      input: {
        transport_id: 'mailgun',
        config: {
          domain: 'mg.example.com',
          region: 'eu',
          from_address: 'orders@mg.example.com',
        },
        credential: { source: 'encrypted_database' },
      },
    });
    capture.respondWith(200, { id: '<mg-kept>' });

    const notification = await send();

    expect(notification.external_id).toEqual('<mg-kept>');
    expect(capture.requests[0].headers.authorization).toEqual(
      `Basic ${Buffer.from(`api:${MAILGUN_KEY}`).toString('base64')}`,
    );
  });

  it('rejects a stored credential when no API key was ever entered', async () => {
    // Save an environment credential first, so this transport provably has a
    // credential row but no stored API key, whatever ran before.
    await saveEmailProviderConfigurationWorkflow(getContainer()).run({
      input: {
        transport_id: 'resend',
        config: { from_address: 'Shop <orders@example.com>' },
        credential: { source: 'environment', env_var_name: RESEND_KEY_ENV },
      },
    });

    // `run()` returns a thenable that Jest's `.rejects` mistakes for a
    // function, so capture the error instead.
    const error = await saveEmailProviderConfigurationWorkflow(getContainer())
      .run({
        input: {
          transport_id: 'resend',
          config: { from_address: 'Shop <orders@example.com>' },
          credential: { source: 'encrypted_database' },
        },
      })
      .then(() => null)
      .catch((e: Error) => e);

    expect(error?.message).toContain('Enter an API key');
  });
});

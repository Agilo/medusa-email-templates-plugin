import { Modules } from '@medusajs/framework/utils';

import { orderPlacedDefaultTemplate } from '../../src/lib/events/built-in/default-templates/order-placed';
import { EMAIL_TEMPLATES_MODULE } from '../../src/modules/email-templates';
import type EmailTemplatesModuleService from '../../src/modules/email-templates/service';
import { saveEmailProviderConfigurationWorkflow } from '../../src/workflows/save-email-provider-configuration';
import { sendEmailEventWorkflow } from '../../src/workflows/send-email-event';
import {
  startCaptureServer,
  type CaptureServer,
} from '../helpers/capture-server';
import { pluginIntegrationSuite } from '../helpers/run';

jest.setTimeout(60000);

const API_KEY_ENV = 'EMAIL_TEMPLATES_EVENTS_RESEND_KEY';
const API_KEY = 're_events_secret_value_123';

/** The order.placed email: rendered from the managed template and sent. */
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

  const createOrder = async () => {
    const [order] = await getContainer()
      .resolve(Modules.ORDER)
      .createOrders([
        {
          email: 'customer@example.com',
          currency_code: 'eur',
          items: [
            { title: 'Medusa T-Shirt', quantity: 2, unit_price: 20 },
            { title: 'Sweatpants', quantity: 1, unit_price: 35 },
          ],
        },
      ]);

    return order;
  };

  const enableOrderPlacedTemplate = (overrides: Record<string, unknown> = {}) =>
    getContainer()
      .resolve<EmailTemplatesModuleService>(EMAIL_TEMPLATES_MODULE)
      .createEmailTemplates({
        event: 'order.placed',
        template_key: 'order-placed',
        enabled: true,
        subject_template: orderPlacedDefaultTemplate.subject,
        html_template: orderPlacedDefaultTemplate.html,
        ...overrides,
      });

  it('renders and sends the order confirmation', async () => {
    await selectResend();
    await enableOrderPlacedTemplate();
    const order = await createOrder();
    capture.respondWith(200, { id: 're_order_email' });

    const { result } = await sendEmailEventWorkflow(getContainer()).run({
      input: { event: 'order.placed', data: { id: order.id } },
    });

    expect(result).toMatchObject({
      sent: true,
      skipped: null,
      external_id: 're_order_email',
    });

    expect(capture.requests).toHaveLength(1);
    const payload = capture.requests[0].json<{
      to: string;
      subject: string;
      html: string;
      text: string;
    }>();

    expect(payload.to).toEqual('customer@example.com');
    expect(payload.subject).toContain(`#${order.display_id}`);
    expect(payload.html).toContain('Medusa T-Shirt');
    expect(payload.html).toContain('Sweatpants');
    // Liquid is fully rendered before sending.
    expect(payload.html).not.toContain('{{');
    expect(payload.html).not.toContain('{%');
    expect(payload.text).toContain('Medusa T-Shirt');
  });

  it('skips the email while the template is disabled', async () => {
    await selectResend();
    await enableOrderPlacedTemplate({ enabled: false });
    const order = await createOrder();

    const { result } = await sendEmailEventWorkflow(getContainer()).run({
      input: { event: 'order.placed', data: { id: order.id } },
    });

    expect(result).toMatchObject({ sent: false, skipped: 'disabled' });
    expect(capture.requests).toHaveLength(0);
  });

  it('skips the email when no template has been saved', async () => {
    await selectResend();
    const order = await createOrder();

    const { result } = await sendEmailEventWorkflow(getContainer()).run({
      input: { event: 'order.placed', data: { id: order.id } },
    });

    expect(result).toMatchObject({ sent: false, skipped: 'disabled' });
    expect(capture.requests).toHaveLength(0);
  });

  it('skips the email when the order has no email address', async () => {
    await selectResend();
    await enableOrderPlacedTemplate();
    const [order] = await getContainer()
      .resolve(Modules.ORDER)
      .createOrders([
        {
          currency_code: 'eur',
          items: [{ title: 'Medusa T-Shirt', quantity: 1, unit_price: 20 }],
        },
      ]);

    const { result } = await sendEmailEventWorkflow(getContainer()).run({
      input: { event: 'order.placed', data: { id: order.id } },
    });

    expect(result).toMatchObject({ sent: false, skipped: 'no_recipient' });
    expect(capture.requests).toHaveLength(0);
  });

  it('skips events without a definition', async () => {
    await selectResend();

    const { result } = await sendEmailEventWorkflow(getContainer()).run({
      input: { event: 'nothing.registered', data: { id: 'x' } },
    });

    expect(result).toMatchObject({ sent: false, skipped: 'no_definition' });
  });
});

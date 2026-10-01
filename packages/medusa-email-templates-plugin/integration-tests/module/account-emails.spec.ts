import { Modules } from '@medusajs/framework/utils';

import {
  emailVerificationDefaultTemplate,
  inviteCreatedDefaultTemplate,
  passwordResetCustomerDefaultTemplate,
  passwordResetUserDefaultTemplate,
} from '../../src/lib/events/built-in/default-templates/account';
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

const API_KEY_ENV = 'EMAIL_TEMPLATES_ACCOUNT_RESEND_KEY';
const API_KEY = 're_account_secret_value_123';

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

  const enableTemplate = (
    templateKey: string,
    event: string,
    template: { subject: string; html: string },
  ) =>
    getContainer()
      .resolve<EmailTemplatesModuleService>(EMAIL_TEMPLATES_MODULE)
      .createEmailTemplates({
        event,
        template_key: templateKey,
        enabled: true,
        subject_template: template.subject,
        html_template: template.html,
      });

  const runEvent = (event: string, data: Record<string, unknown>) =>
    sendEmailEventWorkflow(getContainer()).run({ input: { event, data } });

  const createInvite = async () => {
    const [invite] = await getContainer()
      .resolve(Modules.USER)
      .createInvites([{ email: 'teammate@example.com' }]);

    return invite;
  };

  it('sends the admin invite with an accept link', async () => {
    await selectResend();
    await enableTemplate(
      'invite-created',
      'invite.created',
      inviteCreatedDefaultTemplate,
    );
    const invite = await createInvite();
    capture.respondWith(200, { id: 're_invite' });

    const { result } = await runEvent('invite.created', { id: invite.id });

    expect(result).toMatchObject({ sent: true, external_id: 're_invite' });

    const payload = capture.requests[0].json<{ to: string; html: string }>();
    expect(payload.to).toEqual('teammate@example.com');
    expect(payload.html).toContain('/app/invite?token=');
    expect(payload.html).not.toContain('{{');
  });

  it('sends the admin password reset with an admin link', async () => {
    await selectResend();
    await enableTemplate(
      'password-reset-user',
      'auth.password_reset',
      passwordResetUserDefaultTemplate,
    );
    capture.respondWith(200, { id: 're_reset_user' });

    const { result } = await runEvent('auth.password_reset', {
      entity_id: 'admin@example.com',
      actor_type: 'user',
      token: 'reset-token',
    });

    expect(result).toMatchObject({ sent: true });

    const payload = capture.requests[0].json<{ to: string; html: string }>();
    expect(payload.to).toEqual('admin@example.com');
    expect(payload.html).toContain('/app/reset-password?token=reset-token');
  });

  it('skips the customer password reset when no storefront url is configured', async () => {
    await selectResend();
    await enableTemplate(
      'password-reset-customer',
      'auth.password_reset',
      passwordResetCustomerDefaultTemplate,
    );

    const { result } = await runEvent('auth.password_reset', {
      entity_id: 'customer@example.com',
      actor_type: 'customer',
      token: 'reset-token',
    });

    expect(result).toMatchObject({
      sent: false,
      skipped: 'storefront_not_configured',
    });
    expect(capture.requests).toHaveLength(0);
  });

  it('sends the verification code for an email address', async () => {
    await selectResend();
    await enableTemplate(
      'email-verification',
      'auth.verification_requested',
      emailVerificationDefaultTemplate,
    );
    capture.respondWith(200, { id: 're_verification' });

    const { result } = await runEvent('auth.verification_requested', {
      entity_id: 'jane@example.com',
      entity_type: 'email',
      code: '482913',
    });

    expect(result).toMatchObject({ sent: true });
    expect(capture.requests[0].json<{ html: string }>().html).toContain(
      '482913',
    );
  });

  it('skips verification for entities that are not email addresses', async () => {
    await selectResend();
    await enableTemplate(
      'email-verification',
      'auth.verification_requested',
      emailVerificationDefaultTemplate,
    );

    const { result } = await runEvent('auth.verification_requested', {
      entity_id: '+4712345678',
      entity_type: 'phone',
      code: '482913',
    });

    expect(result).toMatchObject({ sent: false, skipped: 'no_definition' });
    expect(capture.requests).toHaveLength(0);
  });

  it('skips an account email while its template is disabled', async () => {
    await selectResend();

    const { result } = await runEvent('auth.password_reset', {
      entity_id: 'admin@example.com',
      actor_type: 'user',
      token: 'reset-token',
    });

    expect(result).toMatchObject({ sent: false, skipped: 'disabled' });
    expect(capture.requests).toHaveLength(0);
  });
});

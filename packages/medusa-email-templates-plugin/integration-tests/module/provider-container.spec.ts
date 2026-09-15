import { Modules, NotificationStatus } from '@medusajs/framework/utils';

import { pluginIntegrationSuite } from '../helpers/run';

jest.setTimeout(60000);

/**
 * Phase 0 spike (PLAN.md risk R1): the email notification provider is built
 * with the notification module's isolated container, so it must resolve this
 * plugin's module from the global container at send time.
 */
pluginIntegrationSuite(({ getContainer }) => {
  it('resolves the plugin module from the provider at send time', async () => {
    const notificationModule = getContainer().resolve(Modules.NOTIFICATION);

    const notification = await notificationModule.createNotifications({
      to: 'spike@example.com',
      channel: 'email',
      template: 'phase-0-spike',
      content: { subject: 'Spike', html: '<p>Spike</p>' },
    });

    expect(notification.status).toEqual(NotificationStatus.SUCCESS);
    expect(notification.external_id).toEqual('spike:pong:spike@example.com');
  });
});

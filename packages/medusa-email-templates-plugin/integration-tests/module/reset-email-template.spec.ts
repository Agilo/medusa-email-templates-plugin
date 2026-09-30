import {
  createStep,
  createWorkflow,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';

import { findEmailTemplate } from '../../src/lib/templates';
import { EMAIL_TEMPLATES_MODULE } from '../../src/modules/email-templates';
import type EmailTemplatesModuleService from '../../src/modules/email-templates/service';
import { resetEmailTemplateStep } from '../../src/workflows/steps/reset-email-template';
import { pluginIntegrationSuite } from '../helpers/run';

jest.setTimeout(60000);

/*
 * The reset step followed by one that fails, so the workflow engine rolls the
 * reset back. Nothing in the plugin composes it like this yet; the point is
 * that when something does, the compensation actually restores the row.
 */
const failAfterReset = createStep('fail-after-reset', async () => {
  throw new Error('Something later in the workflow failed.');
});

const resetThenFailWorkflow = createWorkflow(
  'test-reset-email-template-then-fail',
  (input: { template_key: string }) => {
    const result = resetEmailTemplateStep(input);
    failAfterReset();

    return new WorkflowResponse(result);
  },
);

pluginIntegrationSuite(({ getContainer }) => {
  const service = () =>
    getContainer().resolve<EmailTemplatesModuleService>(EMAIL_TEMPLATES_MODULE);

  /*
   * A disabled template is removed rather than reverted. It used to be removed
   * with a hard delete, which the compensation's `restore` cannot undo, so a
   * rolled-back reset lost the admin's customised template for good.
   */
  it('restores a removed template when the reset is rolled back', async () => {
    await service().createEmailTemplates({
      event: 'order.placed',
      template_key: 'order-placed',
      enabled: false,
      subject_template: 'Customised subject',
      html_template: '<p>Customised body</p>',
    });

    const failure = await resetThenFailWorkflow(getContainer())
      .run({ input: { template_key: 'order-placed' } })
      .then(() => null)
      .catch((error: unknown) => error);

    expect(failure).not.toBeNull();

    const restored = await findEmailTemplate(service(), 'order-placed');

    expect(restored).toMatchObject({
      enabled: false,
      subject_template: 'Customised subject',
      html_template: '<p>Customised body</p>',
    });
  });
});

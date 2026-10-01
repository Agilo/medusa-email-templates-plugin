import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';

export type SelectEmailProviderConfigurationInput = {
  transport_id: string;
  config: Record<string, unknown>;
};

type ConfigurationSnapshot = {
  id: string;
  is_selected: boolean;
  config: Record<string, unknown> | null;
};

type Compensation = {
  previous: ConfigurationSnapshot[];
  created_id: string | null;
};

export const selectEmailProviderConfigurationStepId =
  'select-email-provider-configuration';

export const selectEmailProviderConfigurationStep = createStep(
  selectEmailProviderConfigurationStepId,
  async (input: SelectEmailProviderConfigurationInput, { container }) => {
    const service = container.resolve<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );
    const existing = await service.listEmailProviderConfigurations();
    const previous: ConfigurationSnapshot[] = existing.map((configuration) => ({
      id: configuration.id,
      is_selected: configuration.is_selected,
      config: configuration.config as Record<string, unknown> | null,
    }));

    const toDeselect = existing.filter(
      (configuration) =>
        configuration.is_selected &&
        configuration.transport_id !== input.transport_id,
    );

    if (toDeselect.length) {
      await service.updateEmailProviderConfigurations(
        toDeselect.map((configuration) => ({
          id: configuration.id,
          is_selected: false,
        })),
      );
    }

    const current = existing.find(
      (configuration) => configuration.transport_id === input.transport_id,
    );

    const configuration = current
      ? await service.updateEmailProviderConfigurations({
          id: current.id,
          config: input.config,
          is_selected: true,
        })
      : await service.createEmailProviderConfigurations({
          transport_id: input.transport_id,
          config: input.config,
          is_selected: true,
        });

    return new StepResponse(configuration, {
      previous,
      created_id: current ? null : configuration.id,
    } satisfies Compensation);
  },
  async (compensation: Compensation | undefined, { container }) => {
    if (!compensation) {
      return;
    }

    const service = container.resolve<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );

    if (compensation.created_id) {
      await service.deleteEmailProviderConfigurations(compensation.created_id);
    }

    if (compensation.previous.length) {
      await service.updateEmailProviderConfigurations(
        compensation.previous.map((snapshot) => ({
          id: snapshot.id,
          config: snapshot.config,
          is_selected: false,
        })),
      );
    }

    const previouslySelected = compensation.previous.filter(
      (snapshot) => snapshot.is_selected,
    );

    if (previouslySelected.length) {
      await service.updateEmailProviderConfigurations(
        previouslySelected.map((snapshot) => ({
          id: snapshot.id,
          is_selected: true,
        })),
      );
    }
  },
);

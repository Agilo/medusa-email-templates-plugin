import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';

import {
  getEmailEventDefinitionForPayload,
  StorefrontUrlNotConfiguredError,
} from '../../lib/events';
import { findEmailTemplate } from '../../lib/templates';
import { EMAIL_TEMPLATES_MODULE } from '../../modules/email-templates';
import type EmailTemplatesModuleService from '../../modules/email-templates/service';

export type ResolveEmailEventInput = {
  event: string;
  data: Record<string, unknown>;
};

export type EmailEventSkipReason =
  'no_definition' | 'disabled' | 'no_recipient' | 'storefront_not_configured';

export type ResolvedEmailEvent =
  | { send: false; skipped: EmailEventSkipReason }
  | {
      send: true;
      skipped: null;
      to: string;
      template_key: string;
      data: Record<string, unknown>;
      idempotency_key: string | null;
      resource_id: string | null;
      resource_type: string | null;
    };

export const resolveEmailEventStepId = 'resolve-email-event';

/**
 * Decides whether an event results in an email, and builds its recipient and
 * context. Reads only.
 */
export const resolveEmailEventStep = createStep(
  resolveEmailEventStepId,
  async (input: ResolveEmailEventInput, { container }) => {
    const definition = getEmailEventDefinitionForPayload(
      input.event,
      input.data,
    );

    if (!definition) {
      return new StepResponse<ResolvedEmailEvent>({
        send: false,
        skipped: 'no_definition',
      });
    }

    const service = container.resolve<EmailTemplatesModuleService>(
      EMAIL_TEMPLATES_MODULE,
    );
    const template = await findEmailTemplate(service, definition.templateKey);

    // No saved template counts as disabled.
    if (!template?.enabled) {
      return new StepResponse<ResolvedEmailEvent>({
        send: false,
        skipped: 'disabled',
      });
    }

    const payload = input.data as never;
    const to = await definition.getRecipient(payload, container);

    if (!to) {
      return new StepResponse<ResolvedEmailEvent>({
        send: false,
        skipped: 'no_recipient',
      });
    }

    const resource = definition.getResource?.(payload) ?? {};

    try {
      return new StepResponse<ResolvedEmailEvent>({
        send: true,
        skipped: null,
        to,
        template_key: definition.templateKey,
        data: await definition.getContext(payload, container),
        idempotency_key: definition.getIdempotencyKey?.(payload) ?? null,
        resource_id: resource.resource_id ?? null,
        resource_type: resource.resource_type ?? null,
      });
    } catch (error) {
      // A link that needs the storefront URL cannot be built without it, so
      // skip instead of sending a broken link.
      if (error instanceof StorefrontUrlNotConfiguredError) {
        return new StepResponse<ResolvedEmailEvent>({
          send: false,
          skipped: 'storefront_not_configured',
        });
      }

      throw error;
    }
  },
);

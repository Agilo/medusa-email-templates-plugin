import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Envelope } from '@medusajs/icons';
import { Container, Heading, Text } from '@medusajs/ui';

import ProvidersSection from '../../../components/providers/providers-section';
import TemplatesSection from '../../../components/templates/templates-section';

const EmailSettingsPage = () => {
  return (
    <div className="flex flex-col gap-y-3">
      <Container>
        <div>
          <Heading>Email</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Manage transactional email templates for registered Medusa events
            and choose the provider used to send them.
          </Text>
        </div>
      </Container>

      <ProvidersSection />
      <TemplatesSection />
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Email',
  icon: Envelope,
});

/**
 * The dashboard builds the trail from every matched route, so this only
 * contributes its own crumb: Settings comes from the parent route. It must
 * return a non-empty string, or the crumb is dropped.
 */
export const handle = {
  breadcrumb: () => 'Email',
};

export default EmailSettingsPage;

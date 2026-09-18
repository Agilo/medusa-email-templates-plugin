import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Container, Heading, Text } from '@medusajs/ui';
import { Envelope } from '@medusajs/icons';
import ProvidersSection from '../../../components/providers/providers-section';

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
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Email',
  icon: Envelope,
});

export default EmailSettingsPage;

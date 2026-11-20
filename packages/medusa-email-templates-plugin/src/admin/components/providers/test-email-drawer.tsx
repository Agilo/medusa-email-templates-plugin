import { Button, Drawer, Input, Label, Text, toast } from '@medusajs/ui';
import { useState } from 'react';

import { useSendProviderTestEmail } from '../../hooks/use-email-provider';
import { getApiErrorMessage } from '../../lib/api-error';
import type { EmailProviderTransportState } from '../../lib/types';

type TestEmailDrawerProps = {
  transport: EmailProviderTransportState;
  onClose: () => void;
};

const TestEmailDrawer = ({ transport, onClose }: TestEmailDrawerProps) => {
  const sendTest = useSendProviderTestEmail();
  const [recipient, setRecipient] = useState('');
  const isLocalPreview = transport.id === 'local-preview';

  const send = () => {
    sendTest.mutate(
      { to: recipient, transport_id: transport.id },
      {
        onSuccess: () => {
          toast.success(
            isLocalPreview
              ? 'Local preview created. Its URL is in the Medusa server output.'
              : `Test email sent to ${recipient}.`,
          );
          onClose();
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title className="font-medium">Send test email</Drawer.Title>
          <Drawer.Description>
            {isLocalPreview
              ? 'Creates a local preview of a fixed test message. Nothing is delivered.'
              : `Sends a fixed message through ${transport.label}.`}
          </Drawer.Description>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus" htmlFor="test-recipient">
              {isLocalPreview ? 'Recipient shown in preview' : 'Recipient'}
            </Label>
            <Input
              id="test-recipient"
              type="email"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="you@example.com"
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              {isLocalPreview
                ? 'This address appears in the preview only. The HTML file URL is logged to the Medusa server output.'
                : `Sends through this transport's saved configuration, whether or not it is the active one. Save any changes before testing.`}
            </Text>
          </div>
        </Drawer.Body>

        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">
              Cancel
            </Button>
          </Drawer.Close>
          <Button
            size="small"
            disabled={!recipient || sendTest.isPending}
            onClick={send}
          >
            {isLocalPreview ? 'Create preview' : 'Send'}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

export default TestEmailDrawer;

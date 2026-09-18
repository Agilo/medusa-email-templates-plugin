import { Button, Drawer, Input, Label, Text, toast } from '@medusajs/ui';
import { useState } from 'react';

import { useSendProviderTestEmail } from '../../hooks/use-email-provider';
import { getApiErrorMessage } from '../../lib/api-error';
import type { EmailProviderTransportState } from '../../lib/types';

type TestEmailDrawerProps = {
  /** Any configured transport, active or not. */
  transport: EmailProviderTransportState;
  onClose: () => void;
};

const TestEmailDrawer = ({ transport, onClose }: TestEmailDrawerProps) => {
  const sendTest = useSendProviderTestEmail();
  const [recipient, setRecipient] = useState('');

  const send = () => {
    sendTest.mutate(
      { to: recipient, transport_id: transport.id },
      {
        onSuccess: () => {
          toast.success(`Test email sent to ${recipient}.`);
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
            Sends a fixed message through {transport.label}.
          </Drawer.Description>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus" htmlFor="test-recipient">
              Recipient
            </Label>
            <Input
              id="test-recipient"
              type="email"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="you@example.com"
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              Sends through this transport&apos;s saved configuration, whether
              or not it is the active one. Save any changes before testing.
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
            Send
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

export default TestEmailDrawer;

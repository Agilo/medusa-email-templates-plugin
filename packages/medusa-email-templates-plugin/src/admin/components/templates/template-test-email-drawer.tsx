import { Button, Drawer, Input, Label, Text, toast } from '@medusajs/ui';
import { useState } from 'react';

import { useSendTemplateTestEmail } from '../../hooks/use-email-template';
import { getApiErrorMessage } from '../../lib/api-error';
import type {
  EmailTemplateDraft,
  EmailTemplateListItem,
} from '../../lib/types';

type TemplateTestEmailDrawerProps = {
  template: EmailTemplateListItem;
  onClose: () => void;
  getDraft?: () => Promise<EmailTemplateDraft>;
};

const TemplateTestEmailDrawer = ({
  template,
  onClose,
  getDraft,
}: TemplateTestEmailDrawerProps) => {
  const sendTest = useSendTemplateTestEmail(template.template_key);
  const [recipient, setRecipient] = useState('');

  const send = async () => {
    let draft: EmailTemplateDraft | undefined;

    if (getDraft) {
      try {
        draft = await getDraft();
      } catch (error) {
        toast.error(getApiErrorMessage(error));
        return;
      }
    }

    sendTest.mutate(
      { to: recipient, ...(draft ? { draft } : {}) },
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
            Sends {template.label}, rendered with example values.
          </Drawer.Description>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus" htmlFor="template-test-recipient">
              Recipient
            </Label>
            <Input
              id="template-test-recipient"
              type="email"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="you@example.com"
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              Goes out through the active email provider, and works even while
              this template is disabled — which is how you check it before
              turning it on.
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

export default TemplateTestEmailDrawer;

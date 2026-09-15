import '@react-email/editor/themes/default.css';

import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Button, Container, Heading, Text } from '@medusajs/ui';
import { EmailEditor, type EmailEditorRef } from '@react-email/editor';
import { StarterKit } from '@react-email/editor/extensions';
import { EmailTheming } from '@react-email/editor/plugins';
import { useRef, useState } from 'react';

import { OrderItemsNode } from '../../../components/editor/order-items-node';
import { VariableNode } from '../../../components/editor/variable-node';

// Phase 0 spike (PLAN.md §11): verifies the editor, its CSS and the custom
// nodes work inside the Medusa Admin build. Replaced by the real Email
// settings overview in Phase 7.

const extensions = [
  StarterKit.configure(),
  EmailTheming.configure({ theme: 'basic' }),
  VariableNode,
  OrderItemsNode,
];

const initialContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Thanks for your order' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Order #' },
        { type: 'variable', attrs: { key: 'order.display_id' } },
        { type: 'text', text: ' is confirmed.' },
      ],
    },
    { type: 'orderItems' },
  ],
};

const EmailSettingsPage = () => {
  const editorRef = useRef<EmailEditorRef>(null);
  const [exported, setExported] = useState<{
    html: string;
    text: string;
  } | null>(null);

  const insertVariable = () => {
    editorRef.current?.editor
      ?.chain()
      .focus()
      .insertContent({ type: 'variable', attrs: { key: 'order.email' } })
      .run();
  };

  const insertOrderItems = () => {
    editorRef.current?.editor
      ?.chain()
      .focus()
      .insertContent({ type: 'orderItems' })
      .run();
  };

  const exportEmail = async () => {
    const result = await editorRef.current?.getEmail();
    setExported(result ?? null);
  };

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">Email</Heading>
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              Phase 0 spike: React Email Editor inside Medusa Admin
            </Text>
          </div>
          <div className="flex items-center gap-x-2">
            <Button size="small" variant="secondary" onClick={insertVariable}>
              Insert variable
            </Button>
            <Button size="small" variant="secondary" onClick={insertOrderItems}>
              Insert order items
            </Button>
            <Button size="small" onClick={exportEmail}>
              Export
            </Button>
          </div>
        </div>
        <div className="px-6 py-4">
          <EmailEditor
            ref={editorRef}
            content={initialContent}
            extensions={extensions}
          />
        </div>
      </Container>
      {exported && (
        <Container className="divide-y p-0">
          <div className="px-6 py-4">
            <Text size="small" leading="compact" weight="plus">
              Exported HTML
            </Text>
            <pre className="txt-compact-xsmall text-ui-fg-subtle mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono">
              {exported.html}
            </pre>
          </div>
          <div className="px-6 py-4">
            <Text size="small" leading="compact" weight="plus">
              Exported text
            </Text>
            <pre className="txt-compact-xsmall text-ui-fg-subtle mt-2 whitespace-pre-wrap break-all font-mono">
              {exported.text}
            </pre>
          </div>
        </Container>
      )}
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Email',
});

export default EmailSettingsPage;

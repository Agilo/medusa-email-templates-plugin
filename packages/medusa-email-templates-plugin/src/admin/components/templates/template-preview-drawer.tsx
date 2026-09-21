import { Alert, Button, Drawer, Skeleton, Tabs, Text } from '@medusajs/ui';
import { useEffect } from 'react';

import { usePreviewEmailTemplate } from '../../hooks/use-email-template';
import { getApiErrorMessage } from '../../lib/api-error';
import type { EmailTemplateListItem } from '../../lib/types';

type TemplatePreviewDrawerProps = {
  template: EmailTemplateListItem;
  onClose: () => void;
};

const TemplatePreviewDrawer = ({
  template,
  onClose,
}: TemplatePreviewDrawerProps) => {
  const preview = usePreviewEmailTemplate(template.template_key);
  const { mutate } = preview;

  // The endpoint is a POST, so rendering is a mutation rather than a query.
  // Fire it once when the drawer opens.
  useEffect(() => {
    mutate({});
  }, [mutate]);

  const rendered = preview.data?.preview;

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title className="font-medium">{template.label}</Drawer.Title>
          <Drawer.Description>
            Rendered with the example values from each variable. Nothing is
            sent.
          </Drawer.Description>
        </Drawer.Header>

        {/* Drawer.Body is flex-1 but has no min-h-0, so every level between
            it and the preview needs to be allowed to shrink — otherwise the
            panel keeps its natural height and leaves dead space below. */}
        <Drawer.Body className="flex min-h-0 flex-1 flex-col gap-y-4 overflow-hidden">
          {preview.isPending && (
            <div className="flex flex-col gap-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}

          {preview.isError && (
            <Alert variant="error">{getApiErrorMessage(preview.error)}</Alert>
          )}

          {rendered && (
            <div className="flex min-h-0 flex-1 flex-col gap-y-4">
              <div className="flex flex-col gap-y-1">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Subject
                </Text>
                <Text size="small" weight="plus">
                  {rendered.subject}
                </Text>
              </div>

              <Tabs
                defaultValue="html"
                className="flex min-h-0 flex-1 flex-col"
              >
                <Tabs.List>
                  <Tabs.Trigger value="html">HTML</Tabs.Trigger>
                  <Tabs.Trigger value="text">Text</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="html" className="min-h-0 flex-1 pt-4">
                  {/* Sandboxed: template markup must not run scripts or
                      navigate the admin. */}
                  <iframe
                    title={`${template.label} preview`}
                    srcDoc={rendered.html}
                    sandbox=""
                    className="bg-ui-bg-base h-full w-full rounded-lg border"
                  />
                </Tabs.Content>

                <Tabs.Content value="text" className="min-h-0 flex-1 pt-4">
                  {/* Mirrors the HTML tab, where the email's own styling puts
                      a white message on a grey page. */}
                  <div className="bg-ui-bg-subtle h-full w-full overflow-auto rounded-lg border p-6">
                    <div className="bg-ui-bg-base rounded-lg p-4">
                      <pre className="txt-compact-small text-ui-fg-base whitespace-pre-wrap">
                        {rendered.text}
                      </pre>
                    </div>
                  </div>
                </Tabs.Content>
              </Tabs>
            </div>
          )}
        </Drawer.Body>

        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">
              Close
            </Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

export default TemplatePreviewDrawer;

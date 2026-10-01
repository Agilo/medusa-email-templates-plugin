import { Alert, Button, Drawer, Skeleton, Tabs, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';

import { usePreviewEmailTemplate } from '../../hooks/use-email-template';
import { getApiErrorMessage } from '../../lib/api-error';
import type {
  EmailTemplateDraft,
  EmailTemplateListItem,
} from '../../lib/types';

type TemplatePreviewDrawerProps = {
  template: EmailTemplateListItem;
  onClose: () => void;
  getDraft?: () => Promise<EmailTemplateDraft>;
};

const TemplatePreviewDrawer = ({
  template,
  onClose,
  getDraft,
}: TemplatePreviewDrawerProps) => {
  const preview = usePreviewEmailTemplate(template.template_key);
  const { mutate } = preview;

  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    if (!getDraft) {
      // A bare `{}`: `draft: undefined` would still send the key, and the
      // schema is strict.
      mutate({});
      return;
    }

    let active = true;

    getDraft()
      .then((draft) => {
        if (active) {
          mutate({ draft });
        }
      })
      .catch((error) => {
        if (active) {
          setDraftError(getApiErrorMessage(error));
        }
      });

    return () => {
      active = false;
    };
  }, [getDraft, mutate]);

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

        <Drawer.Body className="flex min-h-0 flex-1 flex-col gap-y-4 overflow-hidden">
          {/* Not `preview.isPending`, which is false while the draft is still
              exporting and would leave the drawer blank. */}
          {!rendered && !draftError && !preview.isError && (
            <div className="flex flex-col gap-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}

          {draftError && <Alert variant="error">{draftError}</Alert>}

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
                    className="bg-ui-bg-base border-ui-border-base h-full w-full rounded-lg border"
                  />
                </Tabs.Content>

                <Tabs.Content value="text" className="min-h-0 flex-1 pt-4">
                  <div className="bg-ui-bg-base border-ui-border-base h-full w-full overflow-auto rounded-lg border p-4">
                    <pre className="txt-compact-small text-ui-fg-base whitespace-pre-wrap">
                      {rendered.text}
                    </pre>
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

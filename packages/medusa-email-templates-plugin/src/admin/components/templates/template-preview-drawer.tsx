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
  /**
   * The unsaved subject and body, read when the drawer opens.
   *
   * Omitted by the templates list, which has no editor behind it and previews
   * the stored template instead.
   *
   * Read once rather than watched: the drawer is modal, so nothing can be
   * edited while it is open, and closing it unmounts this component — the
   * next open reads again.
   */
  getDraft?: () => Promise<EmailTemplateDraft>;
};

const TemplatePreviewDrawer = ({
  template,
  onClose,
  getDraft,
}: TemplatePreviewDrawerProps) => {
  const preview = usePreviewEmailTemplate(template.template_key);
  const { mutate } = preview;

  /** Exporting the body can throw, which is not an API error. */
  const [draftError, setDraftError] = useState<string | null>(null);

  // The endpoint is a POST, so rendering is a mutation rather than a query.
  // Fire it once when the drawer opens.
  useEffect(() => {
    if (!getDraft) {
      /*
       * No editor behind this drawer, so there is nothing unsaved to send.
       * The body stays a bare `{}`: passing `draft: undefined` would still put
       * the key on the wire, and the schema is a strict object.
       */
      mutate({});
      return;
    }

    // Exporting is async, so the drawer can be closed before it resolves.
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

        {/* Drawer.Body is flex-1 but has no min-h-0, so every level between
            it and the preview needs to be allowed to shrink — otherwise the
            panel keeps its natural height and leaves dead space below. */}
        <Drawer.Body className="flex min-h-0 flex-1 flex-col gap-y-4 overflow-hidden">
          {/* Not `preview.isPending`: with a draft the mutation has not even
              started while the body is still exporting, so keying on that
              leaves the drawer blank for the length of the export. */}
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
                  {/* Neutral surface on purpose: any background here would be
                      the drawer's, not the email's. Only the HTML tab shows
                      the template's own page styling. */}
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

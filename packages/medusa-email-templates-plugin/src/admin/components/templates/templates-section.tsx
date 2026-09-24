import {
  ArrowPath,
  ExclamationCircle,
  Eye,
  PaperPlane,
  PencilSquare,
} from '@medusajs/icons';
import {
  Alert,
  Container,
  createDataTableColumnHelper,
  DataTable,
  Heading,
  Switch,
  Text,
  toast,
  Tooltip,
  useDataTable,
  usePrompt,
} from '@medusajs/ui';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  useResetEmailTemplate,
  useToggleEmailTemplate,
} from '../../hooks/use-email-template';
import { useEmailTemplates } from '../../hooks/use-email-templates';
import { getApiErrorMessage } from '../../lib/api-error';
import type { EmailTemplateListItem } from '../../lib/types';
import TemplatePreviewDrawer from './template-preview-drawer';
import TemplateTestEmailDrawer from './template-test-email-drawer';

/** Warnings are codes; only the ones we can explain get friendly text. */
const WARNING_TEXT: Record<string, string> = {
  storefront_url_not_configured:
    'No storefront URL is configured, so the link cannot be built.',
};

const warningText = (template: EmailTemplateListItem): string | null => {
  const [warning] = template.warnings;

  if (!warning) {
    return null;
  }

  return WARNING_TEXT[warning] ?? warning;
};

const lastEdited = (template: EmailTemplateListItem): string => {
  if (!template.updated_at) {
    return 'Never';
  }

  const edited = new Date(template.updated_at);

  if (Number.isNaN(edited.getTime())) {
    return 'Never';
  }

  return edited.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const columnHelper = createDataTableColumnHelper<EmailTemplateListItem>();

const SectionHeading = () => (
  <>
    <Heading level="h2">Templates</Heading>
    <Text size="small" className="text-ui-fg-subtle">
      One template per registered event. Disabled templates are skipped at send
      time, so nothing goes out until you turn it on.
    </Text>
  </>
);

/** The editor lives at a nested route, keyed by template key rather than id. */
const editorPath = (templateKey: string) =>
  `/settings/email/templates/${encodeURIComponent(templateKey)}`;

/**
 * The table makes the whole row clickable, but the row also holds a switch and
 * an action menu. Medusa stops propagation on menu *items* only, so a click on
 * any control would otherwise both act and navigate.
 */
const isInteractive = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  Boolean(
    target.closest(
      'button, a, input, [role="switch"], [role="menu"], [role="menuitem"]',
    ),
  );

const TemplatesSection = () => {
  const { data, isPending, isError, error } = useEmailTemplates();
  const toggleTemplate = useToggleEmailTemplate();
  const resetTemplate = useResetEmailTemplate();
  const navigate = useNavigate();
  const prompt = usePrompt();
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [testKey, setTestKey] = useState<string | null>(null);

  const templates = useMemo(() => data?.templates ?? [], [data?.templates]);

  const previewing =
    templates.find((it) => it.template_key === previewKey) ?? null;
  const testing = templates.find((it) => it.template_key === testKey) ?? null;

  const openTemplate = useCallback(
    (event: React.MouseEvent, row: EmailTemplateListItem) => {
      if (isInteractive(event.target)) {
        return;
      }

      // @medusajs/ui types this as the row data, but the table actually passes
      // the TanStack row wrapper. Read through `original`, falling back in case
      // the types ever become true.
      const template =
        (row as unknown as { original?: EmailTemplateListItem }).original ??
        row;

      navigate(editorPath(template.template_key));
    },
    [navigate],
  );

  const confirmReset = useCallback(
    async (template: EmailTemplateListItem) => {
      const confirmed = await prompt({
        title: `Reset ${template.label}?`,
        description:
          'The saved subject and body are discarded, and this event goes back to the built-in template. This cannot be undone.',
        variant: 'danger',
        confirmText: 'Reset',
      });

      if (!confirmed) {
        return;
      }

      resetTemplate.mutate(
        { template_key: template.template_key },
        {
          onSuccess: () =>
            toast.success(`${template.label} is back to the default.`),
          onError: (error: unknown) => toast.error(getApiErrorMessage(error)),
        },
      );
    },
    [prompt, resetTemplate],
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'template',
        header: 'Template',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <Text size="small" leading="compact" weight="plus">
              {row.original.label}
            </Text>
            <Text
              size="xsmall"
              leading="compact"
              className="text-ui-fg-subtle font-mono"
            >
              {row.original.event}
            </Text>
          </div>
        ),
      }),
      columnHelper.display({
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const template = row.original;
          const warning = warningText(template);

          return (
            <div className="flex items-center gap-x-2">
              <Switch
                checked={template.enabled}
                disabled={toggleTemplate.isPending}
                aria-label={`Enable ${template.label}`}
                onCheckedChange={(enabled) =>
                  toggleTemplate.mutate(
                    { template_key: template.template_key, enabled },
                    {
                      onSuccess: () =>
                        toast.success(
                          enabled
                            ? `${template.label} is now sending.`
                            : `${template.label} is disabled.`,
                        ),
                      onError: (mutationError: unknown) =>
                        toast.error(getApiErrorMessage(mutationError)),
                    },
                  )
                }
              />
              {/* A warning belongs with the state it affects: enabled or
                  not, this template will not send until it is resolved.

                  Amber rather than `text-ui-fg-warning`, which looks right but
                  does not exist: Medusa's theme has no `warning` foreground at
                  all, so that class generated nothing and the icon rendered in
                  the inherited body colour. */}
              {warning && (
                <Tooltip content={warning}>
                  <span
                    className="text-ui-tag-orange-text flex"
                    aria-label={`${template.label} cannot send`}
                  >
                    <ExclamationCircle />
                  </span>
                </Tooltip>
              )}
            </div>
          );
        },
      }),
      // Accessor columns render through the table, which truncates long values
      // and reveals the full text on hover.
      columnHelper.accessor(
        (row) => (row.is_customized ? 'Custom' : 'Default'),
        { id: 'source', header: 'Source' },
      ),
      columnHelper.accessor((row) => lastEdited(row), {
        id: 'updated',
        header: 'Last edited',
      }),
      columnHelper.action({
        actions: (ctx) => {
          const template = ctx.row.original;

          const edit = [
            {
              label: 'Edit',
              icon: <PencilSquare />,
              onClick: () => navigate(editorPath(template.template_key)),
            },
            {
              label: 'Preview',
              icon: <Eye />,
              onClick: () => setPreviewKey(template.template_key),
            },
            {
              label: 'Send test',
              icon: <PaperPlane />,
              onClick: () => setTestKey(template.template_key),
            },
          ];

          // Resetting a template nobody has saved would do nothing.
          return template.is_customized
            ? [
                edit,
                [
                  {
                    label: 'Reset to default',
                    icon: <ArrowPath />,
                    onClick: () => confirmReset(template),
                  },
                ],
              ]
            : [edit];
        },
      }),
    ],
    [confirmReset, navigate, toggleTemplate],
  );

  const table = useDataTable({
    data: templates,
    columns,
    getRowId: (template) => template.template_key,
    isLoading: isPending,
    onRowClick: openTemplate,
  });

  // A failed query has no table to head, so the error replaces it entirely.
  if (isError) {
    return (
      <Container className="divide-y p-0">
        <div className="flex flex-col gap-y-1 px-6 py-4">
          <SectionHeading />
        </div>
        <div className="px-6 py-4">
          <Alert variant="error">{getApiErrorMessage(error)}</Alert>
        </div>
      </Container>
    );
  }

  return (
    <Container className="divide-y overflow-hidden p-0">
      <DataTable instance={table}>
        {/* Toolbar supplies its own px-6 py-4 and the divider beneath it. */}
        <DataTable.Toolbar className="flex-col items-start gap-y-1">
          <SectionHeading />
        </DataTable.Toolbar>
        <DataTable.Table />
      </DataTable>

      {previewing && (
        <TemplatePreviewDrawer
          key={`preview-${previewing.template_key}`}
          template={previewing}
          onClose={() => setPreviewKey(null)}
        />
      )}

      {testing && (
        <TemplateTestEmailDrawer
          key={`test-${testing.template_key}`}
          template={testing}
          onClose={() => setTestKey(null)}
        />
      )}
    </Container>
  );
};

export default TemplatesSection;

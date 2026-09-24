import { ArrowLeft, Eye, PaperPlane, Plus } from '@medusajs/icons';
import {
  Alert,
  Button,
  Container,
  DropdownMenu,
  Heading,
  Label,
  Skeleton,
  Switch,
  Text,
  toast,
  usePrompt,
} from '@medusajs/ui';
import { Suspense, lazy, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, type UIMatch } from 'react-router-dom';

import TemplatePreviewDrawer from '../../../../../components/templates/template-preview-drawer';
import TemplateTestEmailDrawer from '../../../../../components/templates/template-test-email-drawer';
import {
  useEmailTemplate,
  useSaveEmailTemplate,
  useToggleEmailTemplate,
} from '../../../../../hooks/use-email-template';
import type { VariableFormat } from '../../../../../../lib/rendering/variable-format';
import { getApiErrorMessage } from '../../../../../lib/api-error';
import {
  attributesFor,
  FORMAT_LABELS,
  formatsFor,
  groupVariables,
} from '../../../../../lib/variables';
// Type-only, so the editor module stays out of this route's bundle.
import type { EmailTemplateEditorHandle } from '../../../../../components/editor/email-template-editor';
import type { SubjectEditorHandle } from '../../../../../components/editor/subject-editor';

const EmailTemplateEditor = lazy(
  () => import('../../../../../components/editor/email-template-editor'),
);

/*
 * Lazy for the same reason as the body: it pulls in `@tiptap/react` and the
 * variable pill, which should not land in any other admin route's bundle.
 */
const SubjectEditor = lazy(
  () => import('../../../../../components/editor/subject-editor'),
);

const SETTINGS_PATH = '/settings/email';

const WARNING_TEXT: Record<string, string> = {
  storefront_url_not_configured:
    'No storefront URL is configured, so links in this email cannot be built. It will not send until that is set.',
};

/**
 * Inline code: the event name in the header, the slash key in the body hint.
 *
 * The list page sets the event in bare `font-mono`; a chip is the same idea
 * with an edge, which is what keeps it readable mid-sentence rather than
 * looking like emphasised prose.
 */
const CodeChip = ({ children }: { children: string }) => (
  <code className="bg-ui-bg-component text-ui-fg-subtle rounded-md px-1 py-px font-mono text-xs">
    {children}
  </code>
);

const EmailTemplatePage = () => {
  const { id: templateKey = '' } = useParams();
  const navigate = useNavigate();
  const prompt = usePrompt();

  const {
    data: template,
    isPending,
    isError,
    error,
  } = useEmailTemplate(templateKey);
  const saveTemplate = useSaveEmailTemplate(templateKey);
  const toggleTemplate = useToggleEmailTemplate();

  const subjectRef = useRef<SubjectEditorHandle>(null);
  const editorRef = useRef<EmailTemplateEditorHandle>(null);
  /*
   * Both fields are uncontrolled: each editor owns its document, and the value
   * is read back only when saving. Mirroring the subject into state would
   * reseed the editor on every keystroke, and `useEditor` takes its content
   * once anyway.
   */
  const [subjectDirty, setSubjectDirty] = useState(false);
  const [bodyDirty, setBodyDirty] = useState(false);

  const isDirty = subjectDirty || bodyDirty;

  const groups = useMemo(
    () => groupVariables(template?.variables ?? []),
    [template?.variables],
  );

  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);

  /**
   * The editor places the pill at its own selection, so there is no caret
   * arithmetic here any more. `attributesFor` carries the format and currency
   * source across, so a money or date variable arrives formatted rather than
   * as a raw number.
   */
  const insertVariable = (key: string, format?: VariableFormat) => {
    const variable = template?.variables.find((entry) => entry.key === key);

    subjectRef.current?.insertVariable(attributesFor(variable, format));
    setSubjectDirty(true);
  };

  const save = async () => {
    // Partial update: an untouched body is left out entirely rather than
    // resent, so the stored HTML cannot be clobbered by an export.
    let body;

    if (bodyDirty) {
      try {
        body = await editorRef.current?.getBody();
      } catch (exportError) {
        toast.error(getApiErrorMessage(exportError));
        return;
      }
    }

    saveTemplate.mutate(
      {
        // `getText()` serialises each pill back through the node's own
        // `renderText`, so this is the same Liquid string the field has always
        // stored.
        ...(subjectDirty
          ? { subject_template: subjectRef.current?.getText() ?? '' }
          : {}),
        ...(body ?? {}),
      },
      {
        onSuccess: () => {
          setSubjectDirty(false);
          setBodyDirty(false);
          toast.success('Template saved.');
        },
        onError: (saveError) => toast.error(getApiErrorMessage(saveError)),
      },
    );
  };

  const leave = async () => {
    if (isDirty) {
      const confirmed = await prompt({
        title: 'Discard changes?',
        description:
          'This template has unsaved changes. Leaving now discards them.',
        variant: 'danger',
        confirmText: 'Discard',
      });

      if (!confirmed) {
        return;
      }
    }

    navigate(SETTINGS_PATH);
  };

  if (isPending) {
    return (
      <Container className="divide-y p-0">
        <div className="flex flex-col gap-y-2 px-6 py-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="px-6 py-4">
          <Skeleton className="h-64 w-full" />
        </div>
      </Container>
    );
  }

  if (isError || !template) {
    return (
      <Container className="p-0">
        <div className="px-6 py-4">
          <Alert variant="error">{getApiErrorMessage(error)}</Alert>
        </div>
      </Container>
    );
  }

  const warning = template.warnings[0];

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-start gap-x-3">
            <Button
              size="small"
              variant="transparent"
              aria-label="Back to email settings"
              onClick={leave}
            >
              <ArrowLeft />
            </Button>
            <div className="flex min-w-0 flex-col gap-y-0.5">
              <Heading level="h2">{template.label}</Heading>
              {/*
                The event's own description, not one fixed sentence. Only the
                order template goes to a customer — the invite and the admin
                password reset go to an admin user, so copy that said "sent to
                the customer" would be wrong on half the built-ins. Each event
                already carries the right sentence; the chip names the event
                behind it.
              */}
              <Text
                size="small"
                className="text-ui-fg-subtle flex flex-wrap items-center gap-x-1.5"
              >
                {template.description ? (
                  <>
                    {template.description}
                    <CodeChip>{template.event}</CodeChip>
                  </>
                ) : (
                  <>
                    Sent when <CodeChip>{template.event}</CodeChip> fires
                  </>
                )}
              </Text>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
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
                    onError: (toggleError: unknown) =>
                      toast.error(getApiErrorMessage(toggleError)),
                  },
                )
              }
            />
            <Button
              size="small"
              variant="secondary"
              onClick={() => setPreviewing(true)}
            >
              <Eye />
              Preview
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setTesting(true)}
            >
              <PaperPlane />
              Send test
            </Button>
            <Button
              size="small"
              disabled={!isDirty || saveTemplate.isPending}
              onClick={save}
            >
              Save
            </Button>
          </div>
        </div>

        {warning && (
          <div className="px-6 py-4">
            <Alert variant="warning">{WARNING_TEXT[warning] ?? warning}</Alert>
          </div>
        )}
      </Container>

      <Container className="p-0">
        <div className="flex flex-col gap-y-2 px-6 py-4">
          <Label size="small" weight="plus" htmlFor="subject">
            Subject
          </Label>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Suspense fallback={<Skeleton className="h-8 w-full" />}>
                <SubjectEditor
                  ref={subjectRef}
                  subject={template.subject_template}
                  variables={template.variables}
                  onDirty={() => setSubjectDirty(true)}
                />
              </Suspense>
            </div>
            <DropdownMenu>
              {/*
                Icon plus a visible label. `aria-label` repeats that label and
                takes precedence over the text in the accessible name, so it is
                what a screen reader announces and what the tests query by.
                `shrink-0` stops the field beside it squeezing the button as it
                grows.
              */}
              <DropdownMenu.Trigger asChild>
                <Button
                  size="small"
                  variant="secondary"
                  className="flex items-center gap-x-2 shrink-0"
                  aria-label="Insert variable"
                >
                  <Plus />
                  <span>Insert variable</span>
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                {groups.map(([group, variables], index) => (
                  // `Group`, not a bare `div`: it renders the same element but
                  // with `role="group"`, so the label names a group of items
                  // rather than floating above a flat list.
                  <DropdownMenu.Group key={group}>
                    {index > 0 && <DropdownMenu.Separator />}
                    <DropdownMenu.Label>{group}</DropdownMenu.Label>
                    {variables.map((variable) => {
                      const formats = formatsFor(variable);

                      /*
                       * A variable with one sensible rendering inserts on the
                       * spot. Totals and dates open a submenu instead, because
                       * the default is only a guess — a total might belong in
                       * a subject as a plain number, and a date has four
                       * shapes. Without this the format was decided for you.
                       */
                      if (formats.length === 1) {
                        return (
                          <DropdownMenu.Item
                            key={variable.key}
                            onClick={() => insertVariable(variable.key)}
                          >
                            {variable.label}
                          </DropdownMenu.Item>
                        );
                      }

                      return (
                        <DropdownMenu.SubMenu key={variable.key}>
                          <DropdownMenu.SubMenuTrigger>
                            {variable.label}
                          </DropdownMenu.SubMenuTrigger>
                          <DropdownMenu.SubMenuContent>
                            {formats.map((format) => (
                              <DropdownMenu.Item
                                key={format}
                                onClick={() =>
                                  insertVariable(variable.key, format)
                                }
                              >
                                {FORMAT_LABELS[format]}
                              </DropdownMenu.Item>
                            ))}
                          </DropdownMenu.SubMenuContent>
                        </DropdownMenu.SubMenu>
                      );
                    })}
                  </DropdownMenu.Group>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        </div>
      </Container>

      {/*
        The body is its own card, so the two things being edited read as two
        sections rather than one long surface.

        Its rule is an explicit `border-t`, not `divide-y`: the editor renders
        its bubble menus and slash menu as siblings of the canvas, and
        `divide-y` would stripe a rule above each of them. `overflow-hidden`
        keeps the Inspector's rail from squaring off the bottom corners.
      */}
      <Container className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-6 py-4">
          <Text size="small" weight="plus">
            Body
          </Text>
          {/* The slash menu is the only way to reach most block types, and
              nothing else on the page advertises it. */}
          <Text
            size="small"
            className="text-ui-fg-subtle flex items-center gap-x-1.5"
          >
            Type <CodeChip>/</CodeChip> to add a block
          </Text>
        </div>

        <div className="border-ui-border-base border-t">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <EmailTemplateEditor
              ref={editorRef}
              template={template}
              onDirty={() => setBodyDirty(true)}
            />
          </Suspense>
        </div>
      </Container>

      {previewing && (
        <TemplatePreviewDrawer
          template={template}
          onClose={() => setPreviewing(false)}
        />
      )}

      {testing && (
        <TemplateTestEmailDrawer
          template={template}
          onClose={() => setTesting(false)}
        />
      )}
    </div>
  );
};

/**
 * Must return a non-empty string, so this shows the template key from the URL
 * rather than the label, which would need a request the breadcrumb cannot
 * wait for.
 */
export const handle = {
  breadcrumb: (match: UIMatch<unknown, unknown>) =>
    (match.params as { id?: string }).id ?? 'Template',
};

export default EmailTemplatePage;

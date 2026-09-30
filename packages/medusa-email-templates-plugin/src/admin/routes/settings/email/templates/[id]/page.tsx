import { ArrowLeft, Eye, PaperPlane, Plus } from '@medusajs/icons';
import {
  Alert,
  Button,
  Container,
  DropdownMenu,
  Heading,
  IconButton,
  Label,
  Skeleton,
  Switch,
  Text,
  toast,
  usePrompt,
} from '@medusajs/ui';
import { Suspense, lazy, useCallback, useMemo, useRef, useState } from 'react';
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
import type { EmailTemplateDraft } from '../../../../../lib/types';
import {
  attributesFor,
  FORMAT_LABELS,
  formatsFor,
  groupVariables,
  scalarVariables,
} from '../../../../../lib/variables';
import { describeWarning } from '../../../../../lib/warnings';
// Type-only, so the editor module stays out of this route's bundle.
import type { EmailTemplateEditorHandle } from '../../../../../components/editor/email-template-editor';
import type { SubjectEditorHandle } from '../../../../../components/editor/subject-editor';

const EmailTemplateEditor = lazy(
  () => import('../../../../../components/editor/email-template-editor'),
);

// Lazy like the body editor, keeping `@tiptap/react` out of other routes.
const SubjectEditor = lazy(
  () => import('../../../../../components/editor/subject-editor'),
);

const SETTINGS_PATH = '/settings/email';

/**
 * Inline code chip (the event name, the `/` hint). The border keeps it
 * readable mid-sentence.
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
  // Both editors are uncontrolled and read back on save; mirroring into state
  // would reseed them on every keystroke.
  const [subjectDirty, setSubjectDirty] = useState(false);
  const [bodyDirty, setBodyDirtyState] = useState(false);
  // Mirror for `getDraft`, which keeps a stable identity and can't read state.
  const bodyDirtyRef = useRef(false);
  const setBodyDirty = useCallback((dirty: boolean) => {
    bodyDirtyRef.current = dirty;
    setBodyDirtyState(dirty);
  }, []);

  /*
   * Edit counters, so a finished save only clears a field's dirty flag if the
   * field wasn't edited while the request was in flight. Otherwise those
   * edits would be silently marked as saved.
   */
  const subjectEdits = useRef(0);
  const bodyEdits = useRef(0);

  const markSubjectEdited = useCallback(() => {
    subjectEdits.current += 1;
    setSubjectDirty(true);
  }, []);

  const markBodyEdited = useCallback(() => {
    bodyEdits.current += 1;
    setBodyDirty(true);
  }, [setBodyDirty]);

  const isDirty = subjectDirty || bodyDirty;

  const groups = useMemo(
    // A subject has no Repeat block, so lists have nowhere to go.
    () => groupVariables(scalarVariables(template?.variables ?? [])),
    [template?.variables],
  );

  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);

  // Inserted at the editor's selection, already formatted for money/dates.
  const insertVariable = (key: string, format?: VariableFormat) => {
    const variable = template?.variables.find((entry) => entry.key === key);

    subjectRef.current?.insertVariable(attributesFor(variable, format));
    markSubjectEdited();
  };

  /**
   * The unsaved work, so preview and test send use it instead of the last
   * save. Read on demand (the drawers are modal). Stable identity: the
   * preview drawer keys an effect on it.
   *
   * - An empty subject is omitted (the schema requires `min(1)`).
   * - Only `html_template` is sent; the draft schema is strict.
   * - The body is sent only once edited. Untouched, the server renders the
   *   stored HTML, exactly as a real send would; the editor's re-export can
   *   differ for HTML written outside the editor.
   */
  const getDraft = useCallback(async (): Promise<EmailTemplateDraft> => {
    const subject = subjectRef.current?.getText() ?? '';
    const body = bodyDirtyRef.current
      ? await editorRef.current?.getBody()
      : undefined;

    return {
      ...(subject ? { subject_template: subject } : {}),
      ...(body ? { html_template: body.html_template } : {}),
    };
  }, []);

  const save = async () => {
    // Before the export awaits, so edits made during it count as unsaved.
    const sentSubjectEdits = subjectEdits.current;
    const sentBodyEdits = bodyEdits.current;

    // Partial update: an untouched body is omitted, so an export can't
    // clobber the stored HTML.
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
        // `getText()` serialises pills back to the stored Liquid string.
        ...(subjectDirty
          ? { subject_template: subjectRef.current?.getText() ?? '' }
          : {}),
        ...(body ?? {}),
      },
      {
        onSuccess: () => {
          // Only fields untouched since the request left are now saved.
          if (subjectEdits.current === sentSubjectEdits) {
            setSubjectDirty(false);
          }
          if (bodyEdits.current === sentBodyEdits) {
            setBodyDirty(false);
          }
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
      <Container className="flex flex-col gap-y-3 px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-x-3">
            <IconButton
              size="small"
              variant="transparent"
              aria-label="Back to email settings"
              onClick={leave}
            >
              <ArrowLeft />
            </IconButton>
            <div className="flex min-w-0 flex-col gap-y-0.5">
              <Heading level="h2">{template.label}</Heading>
              {/* The event's own description: not every template goes to a
                  customer (invites and admin resets go to admin users). */}
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
          <div>
            <Alert variant="warning">{describeWarning(warning).text}</Alert>
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
                  onDirty={markSubjectEdited}
                />
              </Suspense>
            </div>
            <DropdownMenu>
              {/* `aria-label` sets the accessible name (and what tests query
                  by). `shrink-0` stops the growing field squeezing it. */}
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
                  // `Group` adds `role="group"`, so the label names the items.
                  <DropdownMenu.Group key={group}>
                    {index > 0 && <DropdownMenu.Separator />}
                    <DropdownMenu.Label>{group}</DropdownMenu.Label>
                    {variables.map((variable) => {
                      const formats = formatsFor(variable);

                      /*
                       * One format: insert directly. Money and dates open a
                       * submenu to choose (a subject may want a plain number;
                       * dates have several shapes).
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
        The body gets its own card. `border-t`, not `divide-y`, which would
        also draw a rule above the editor's menus (siblings of the canvas).
        `overflow-hidden` keeps the Inspector from squaring the corners.
      */}
      <Container className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-6 py-4">
          <Text size="small" weight="plus">
            Body
          </Text>
          {/* The only hint that the slash menu exists. */}
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
              onDirty={markBodyEdited}
            />
          </Suspense>
        </div>
      </Container>

      {previewing && (
        <TemplatePreviewDrawer
          template={template}
          getDraft={getDraft}
          onClose={() => setPreviewing(false)}
        />
      )}

      {testing && (
        <TemplateTestEmailDrawer
          template={template}
          getDraft={getDraft}
          onClose={() => setTesting(false)}
        />
      )}
    </div>
  );
};

/**
 * Must return a non-empty string synchronously, so it shows the template key
 * from the URL rather than the label (which needs a request).
 */
export const handle = {
  breadcrumb: (match: UIMatch<unknown, unknown>) =>
    (match.params as { id?: string }).id ?? 'Template',
};

export default EmailTemplatePage;

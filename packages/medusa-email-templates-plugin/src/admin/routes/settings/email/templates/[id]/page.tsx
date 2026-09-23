import { ArrowLeft, Eye, PaperPlane } from '@medusajs/icons';
import {
  Alert,
  Button,
  Container,
  DropdownMenu,
  Heading,
  Input,
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
import { toLiquidExpression } from '../../../../../../lib/rendering/variable-format';
import { getApiErrorMessage } from '../../../../../lib/api-error';
import { defaultFormatFor, groupVariables } from '../../../../../lib/variables';
// Type-only, so the editor module stays out of this route's bundle.
import type { EmailTemplateEditorHandle } from '../../../../../components/editor/email-template-editor';

const EmailTemplateEditor = lazy(
  () => import('../../../../../components/editor/email-template-editor'),
);

const SETTINGS_PATH = '/settings/email';

const WARNING_TEXT: Record<string, string> = {
  storefront_url_not_configured:
    'No storefront URL is configured, so links in this email cannot be built. It will not send until that is set.',
};

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

  const subjectRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<EmailTemplateEditorHandle>(null);
  // Undefined means untouched, so the saved value shows through and a refetch
  // never clobbers what is being typed.
  const [draftSubject, setDraftSubject] = useState<string>();
  const [bodyDirty, setBodyDirty] = useState(false);

  const subject = draftSubject ?? template?.subject_template ?? '';
  const subjectDirty =
    draftSubject !== undefined && draftSubject !== template?.subject_template;
  const isDirty = subjectDirty || bodyDirty;

  const groups = useMemo(
    () => groupVariables(template?.variables ?? []),
    [template?.variables],
  );

  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);

  /** Inserts at the cursor rather than appending, so it lands where expected. */
  const insertVariable = (key: string) => {
    const input = subjectRef.current;
    const variable = template?.variables.find((entry) => entry.key === key);
    // Generated, not hand-built: a money or date variable needs its filter
    // here just as much as in the body, or the subject shows a raw number.
    const token = toLiquidExpression(key, defaultFormatFor(variable), {
      currencySource: variable?.currencyKey,
    });
    // An unfocused input reports `selectionStart` as 0 rather than null, and
    // opening the menu blurs the field — so trusting the caret unconditionally
    // silently prepended every insertion.
    const hasCaret = Boolean(input) && document.activeElement === input;
    const start = hasCaret
      ? (input?.selectionStart ?? subject.length)
      : subject.length;
    const end = hasCaret
      ? (input?.selectionEnd ?? subject.length)
      : subject.length;

    setDraftSubject(`${subject.slice(0, start)}${token}${subject.slice(end)}`);

    // Put the caret after the inserted token.
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + token.length, start + token.length);
    });
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
        ...(subjectDirty ? { subject_template: subject } : {}),
        ...(body ?? {}),
      },
      {
        onSuccess: () => {
          setDraftSubject(undefined);
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
            <div className="flex min-w-0 flex-col">
              <Heading level="h2">{template.label}</Heading>
              <Text size="small" className="text-ui-fg-subtle font-mono">
                {template.event}
              </Text>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {isDirty && (
              <Text size="small" className="text-ui-fg-subtle">
                Unsaved changes
              </Text>
            )}
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

        <div className="flex flex-col gap-y-2 px-6 py-4">
          <Label size="small" weight="plus" htmlFor="subject">
            Subject
          </Label>
          <div className="flex items-center gap-2">
            {/*
              The flex sizing lives on this wrapper rather than on `Input`.
              Medusa's Input renders its own `relative` div and forwards
              `className` to the inner `<input>`, so `flex-1` passed as a prop
              lands a level too deep to size the flex child — the wrapper
              stays content-sized and the input dutifully fills it. The inner
              input is already `w-full`, so it takes whatever this gets.
            */}
            <div className="min-w-0 flex-1">
              <Input
                id="subject"
                ref={subjectRef}
                value={subject}
                onChange={(event) => setDraftSubject(event.target.value)}
              />
            </div>
            <DropdownMenu>
              {/* Sized to its label, and never squeezed as the field grows. */}
              <DropdownMenu.Trigger asChild>
                <Button size="small" variant="secondary" className="shrink-0">
                  Insert variable
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                {groups.map(([group, variables], index) => (
                  <div key={group}>
                    {index > 0 && <DropdownMenu.Separator />}
                    <DropdownMenu.Label>{group}</DropdownMenu.Label>
                    {variables.map((variable) => (
                      <DropdownMenu.Item
                        key={variable.key}
                        onClick={() => insertVariable(variable.key)}
                      >
                        {variable.label}
                      </DropdownMenu.Item>
                    ))}
                  </div>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Liquid without quotes, for example{' '}
            <span className="font-mono">{'{{ order.display_id }}'}</span>.
          </Text>
        </div>
      </Container>

      <Container className="p-0">
        <div className="px-6 py-4">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
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

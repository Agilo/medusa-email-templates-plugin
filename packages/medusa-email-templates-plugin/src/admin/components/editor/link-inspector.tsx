import {
  Inspector,
  type InspectorNodeContext,
  type InspectorTextContext,
} from '@react-email/editor/ui';
import { useCurrentEditor } from '@tiptap/react';
import { useState, type ReactNode } from 'react';

import type { EmailTemplateVariable } from '../../lib/types';
import { validateUrl } from '../../lib/liquid-url';
import { groupVariables, urlVariables } from '../../lib/variables';

/**
 * URL editing lives in the Inspector, not the bubble menus.
 *
 * The library's bubble-menu link forms close and submit on any mousedown
 * outside the form, including a portalled picker, and that can't be turned
 * off. The Inspector panel sits in an `EditorFocusScope`, so the selection
 * survives while its fields have focus and they can edit the link under the
 * caret.
 */

const WHOLE_EXPRESSION = /^\{\{\s*([^{}|\s]+)\s*(?:\|[^{}]*)?\}\}$/;

const wholeValueKey = (href: string): string | null =>
  WHOLE_EXPRESSION.exec(href.trim())?.[1] ?? null;

export const addressWarning = (
  href: string,
  variables: EmailTemplateVariable[],
): string | null => {
  const key = wholeValueKey(href);

  if (!key) {
    return null;
  }

  const declared = variables.find((variable) => variable.key === key);

  if (!declared) {
    return `${key} is not a variable in this template.`;
  }

  return declared.type === 'url'
    ? null
    : `${declared.label} is not marked as a link address.`;
};

const CUSTOM_ADDRESS = '';

export const chosenVariableKey = (
  href: string,
  variables: EmailTemplateVariable[],
): string | null => {
  const key = wholeValueKey(href);

  if (!key) {
    return null;
  }

  const declared = variables.find((variable) => variable.key === key);

  return declared?.type === 'url' ? key : null;
};

type LinkFieldsProps = {
  href: string;
  onCommit: (href: string | null) => void;
  variables: EmailTemplateVariable[];
  children?: ReactNode;
};

const LinkFields = ({
  href,
  onCommit,
  variables,
  children,
}: LinkFieldsProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState(href);
  const [committed, setCommitted] = useState(href);
  // Held, not derived from the href: otherwise choosing "Custom" while the
  // href is still `{{ invite_url }}` would snap straight back.
  const [choice, setChoice] = useState(
    () => chosenVariableKey(href, variables) ?? CUSTOM_ADDRESS,
  );

  /*
   * Re-seed when the document's href changes (another link selected, or
   * `validateUrl` normalised a commit). Done during render rather than in an
   * effect, so no stale frame shows and the lint rules are satisfied. An
   * uncommitted draft survives, since `href` only moves with the document.
   */
  if (href !== committed) {
    setCommitted(href);
    setDraft(href);
    setChoice(chosenVariableKey(href, variables) ?? CUSTOM_ADDRESS);
  }

  const linkable = urlVariables(variables);
  const isCustom = choice === CUSTOM_ADDRESS;

  const warning = isCustom ? addressWarning(draft, variables) : null;

  const commit = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      onCommit(null);
      return;
    }

    const validated = validateUrl(trimmed);

    if (validated) {
      onCommit(validated);
    }
  };

  const chooseAddress = (next: string) => {
    setChoice(next);

    if (next === CUSTOM_ADDRESS) {
      setDraft('');
      return;
    }

    const expression = `{{ ${next} }}`;

    setDraft(expression);
    commit(expression);
  };

  return (
    <div data-re-inspector-section="" data-has-title="">
      <div data-re-inspector-section-header="">
        <button
          type="button"
          data-re-inspector-section-toggle=""
          onClick={() => setCollapsed((value) => !value)}
        >
          Link
        </button>
      </div>

      {!collapsed && (
        <div data-re-inspector-section-body="">
          <div data-re-inspector-prop-row="">
            <label data-re-inspector-label="" htmlFor="link-address">
              Address
            </label>
            {/* Native select: no portal, so focus stays in the panel's scope.
                Shows the variable's label rather than raw Liquid. No format
                choice — a URL always wants the raw value. */}
            <select
              data-re-inspector-select=""
              id="link-address"
              value={choice}
              onChange={(event) => chooseAddress(event.target.value)}
            >
              <option value={CUSTOM_ADDRESS}>Custom URL…</option>
              {linkable.length === 0 ? (
                <option disabled>No link variables</option>
              ) : (
                groupVariables(linkable).map(([group, grouped]) => (
                  <optgroup key={group} label={group}>
                    {grouped.map((variable) => (
                      <option key={variable.key} value={variable.key}>
                        {variable.label}
                      </option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
          </div>

          {isCustom && (
            <>
              <span data-re-inspector-number="" data-link-url-control="">
                <input
                  data-re-inspector-input=""
                  data-link-url=""
                  id="link-url"
                  type="text"
                  aria-label="Link URL"
                  value={draft}
                  placeholder="https://"
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={(event) => commit(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      // Keep Enter from reaching the still-"focused" editor.
                      event.preventDefault();
                      commit(draft);
                    }
                  }}
                />
              </span>

              {warning && (
                <span
                  data-re-inspector-text=""
                  data-color="muted"
                  className="text-xs"
                >
                  {warning}
                </span>
              )}
            </>
          )}

          {children}
        </div>
      )}
    </div>
  );
};

export const ButtonLinkSection = ({
  getAttr,
  setAttr,
  variables,
}: InspectorNodeContext & { variables: EmailTemplateVariable[] }) => {
  const raw = getAttr('href');
  const href = typeof raw === 'string' && raw !== '#' ? raw : '';

  return (
    <LinkFields
      href={href}
      variables={variables}
      onCommit={(next) => setAttr('href', next ?? '#')}
    />
  );
};

const SHORT_HEX = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const LONG_HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

/**
 * Mirrors the library's internal `normalizeHex`: `<input type="color">` only
 * accepts `#rrggbb`, so expand shorthand and replace anything else.
 */
const normalizeHex = (value: string): string => {
  const trimmed = value.trim();
  const short = SHORT_HEX.exec(trimmed);

  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  }

  return LONG_HEX.test(trimmed) ? trimmed : '#000000';
};

type TextLinkSectionProps = Pick<
  InspectorTextContext,
  'linkHref' | 'linkColor' | 'setLinkColor'
> & { variables: EmailTemplateVariable[] };

/**
 * A text link's URL and colour. The context has no href setter, so writes go
 * through the editor, as the library's `setLinkHref` does: with a bare caret,
 * widen to the link first, then restore the caret.
 */
const TextLinkSection = ({
  linkHref,
  linkColor,
  setLinkColor,
  variables,
}: TextLinkSectionProps) => {
  const { editor } = useCurrentEditor();

  if (!editor) {
    return null;
  }

  const commit = (next: string | null) => {
    if (!next) {
      editor.chain().unsetLink().run();
      return;
    }

    const { from, to } = editor.state.selection;

    if (from === to) {
      editor
        .chain()
        .extendMarkRange('link')
        .setLink({ href: next })
        .setTextSelection({ from, to })
        .run();
    } else {
      editor.chain().setLink({ href: next }).run();
    }
  };

  return (
    <LinkFields href={linkHref} variables={variables} onCommit={commit}>
      <div data-re-inspector-prop-row="">
        <label data-re-inspector-label="" htmlFor="link-color">
          Color
        </label>
        <span data-re-inspector-color-control="">
          <input
            type="color"
            data-re-inspector-color-trigger=""
            id="link-color"
            value={normalizeHex(linkColor)}
            onChange={(event) => setLinkColor(event.target.value)}
          />
          <input
            type="text"
            data-re-inspector-color-hex=""
            aria-label="Link color"
            value={linkColor}
            onChange={(event) => setLinkColor(event.target.value)}
          />
        </span>
      </div>
    </LinkFields>
  );
};

export const LinkTextInspector = ({
  variables,
}: {
  variables: EmailTemplateVariable[];
}) => (
  <Inspector.Text>
    {(context) => (
      <>
        <Inspector.Typography {...context} />
        {context.isLinkActive && (
          <TextLinkSection {...context} variables={variables} />
        )}
      </>
    )}
  </Inspector.Text>
);

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

/**
 * The key when an href is exactly one expression, else null.
 *
 * `https://shop.test/orders/{{ order.id }}` is a fine address, so embedded
 * expressions are ignored. A filter is allowed (`{{ total | money }}`).
 */
const WHOLE_EXPRESSION = /^\{\{\s*([^{}|\s]+)\s*(?:\|[^{}]*)?\}\}$/;

const wholeValueKey = (href: string): string | null =>
  WHOLE_EXPRESSION.exec(href.trim())?.[1] ?? null;

/**
 * A warning for an address that is a single expression, or null.
 *
 * Advisory only: rejecting in `validateUrl` would unset the link in the bubble
 * menus rather than refuse the input.
 *
 * An undeclared key matters most: without `strictVariables`,
 * `{{ invte_url }}` renders empty and the email ships `<a href="">` silently.
 */
export const addressWarning = (
  href: string,
  variables: EmailTemplateVariable[],
): string | null => {
  const key = wholeValueKey(href);

  if (!key) {
    return null;
  }

  const declared = variables.find((variable) => variable.key === key);

  // By key: an undeclared variable has no label, and the key is the typo.
  if (!declared) {
    return `${key} is not a variable in this template.`;
  }

  return declared.type === 'url'
    ? null
    : `${declared.label} is not marked as a link address.`;
};

/** The select's value for "type an address of your own". */
const CUSTOM_ADDRESS = '';

/**
 * The `url` variable an address is set to, or null. Mistyped or non-link
 * expressions stay as raw text, so a typo like `{{ invte_url }}` stays
 * noticeable instead of looking like a chosen variable.
 */
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
  /** The href as the document currently has it. */
  href: string;
  /** Receives a validated href, or null to clear the link. */
  onCommit: (href: string | null) => void;
  variables: EmailTemplateVariable[];
  /** Extra rows, for properties only one kind of link has. */
  children?: ReactNode;
};

/**
 * The link section, shared by buttons and text links.
 *
 * Reproduces the markup of the library's internal section primitives (as
 * `VariableSection` does) so the same `data-re-inspector-*` attributes pick up
 * the panel's styling. Will drift if the library changes them.
 */
const LinkFields = ({
  href,
  onCommit,
  variables,
  children,
}: LinkFieldsProps) => {
  // Matching the library's sections, which are collapsible by their title.
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

  // Only for typed addresses (a chosen variable is always a link). Read from
  // the draft so it updates while typing; an incomplete `{{ inv` matches
  // nothing.
  const warning = isCustom ? addressWarning(draft, variables) : null;

  const commit = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      onCommit(null);
      return;
    }

    const validated = validateUrl(trimmed);

    // Invalid: keep the old href and the draft, so a half-typed URL can be
    // finished (the bubble menus clear it instead).
    if (validated) {
      onCommit(validated);
    }
  };

  // A `url` variable is already a complete URL (built in the event's
  // `getContext`), so the two modes are exclusive and a variable needs no
  // extra input.
  const chooseAddress = (next: string) => {
    setChoice(next);

    if (next === CUSTOM_ADDRESS) {
      // Cleared but not committed: committing null would remove the link
      // before a replacement is typed.
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
                /* Explains an empty list; disabled as it isn't a choice. */
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

          {/*
           * Stacked, not in a prop row: a label beside it would leave ~9rem
           * for a URL (as `PaddingSection` also stacks). The row above already
           * says Address, so no second label.
           */}
          {isCustom && (
            <>
              {/* `data-re-inspector-number` is the library's generic bordered
                  shell (border, radius, height, focus ring). `INSPECTOR_CLASS`
                  strips the input's own border, expecting such a shell. */}
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

              {/* `text-xs`: outside a prop row, nothing else sets the size. */}
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

/**
 * The button's URL. Its href is an unvalidated node attribute, so `setAttr`
 * accepts Liquid directly.
 */
export const ButtonLinkSection = ({
  getAttr,
  setAttr,
  variables,
}: InspectorNodeContext & { variables: EmailTemplateVariable[] }) => {
  const raw = getAttr('href');
  // `#` is the node's "no link" default; don't show it as a value.
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
        {/* Mirrors the library's internal `ColorInput`, keeping the colour
            row `Inspector.Link` had. */}
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

/**
 * Drop-in replacement for `Inspector.Text`: typography, then an editable link
 * section (the library's is read-only).
 *
 * Shown only when link text is selected; a bare caret in a link targets the
 * paragraph and is handled by `BubbleMenu.LinkDefault`.
 */
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

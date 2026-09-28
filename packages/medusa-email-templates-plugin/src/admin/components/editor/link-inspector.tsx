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
 * URL editing lives here rather than in the bubble menus.
 *
 * A picker cannot be hosted in a bubble menu without forking the library's
 * form components. Both `BubbleMenuLinkForm` and `BubbleMenuButtonForm` run an
 * unconditional `document` mousedown listener that closes the form — and
 * submits it — whenever the event target falls outside `formRef`, which any
 * portalled menu does. Nothing exposed turns that off.
 *
 * The Inspector has the opposite property. `Inspector.Root` renders its panel
 * inside an `EditorFocusScope`, and the focus-scope plugin's `handleFocusOut`
 * returns early when focus moves into a registered scope — so it never sets
 * `editor.isFocused = false` and never runs `setSelection(Selection.atStart)`.
 * The selection therefore survives while these fields have focus, which is
 * what lets them write to the link mark under the caret at all.
 */

/**
 * The key an href is set to wholesale, when that is all it is.
 *
 * Only the whole-value case counts. `https://shop.test/orders/{{ order.id }}`
 * is a perfectly good address and `order.id` has no business being a URL
 * variable, so an embedded expression says nothing about whether the href is
 * sound. A filter is tolerated so the key is still found in
 * `{{ total | money }}`, which is exactly the kind of value worth pointing at.
 */
const WHOLE_EXPRESSION = /^\{\{\s*([^{}|\s]+)\s*(?:\|[^{}]*)?\}\}$/;

const wholeValueKey = (href: string): string | null =>
  WHOLE_EXPRESSION.exec(href.trim())?.[1] ?? null;

/**
 * What to say about an address that is nothing but one expression.
 *
 * Advisory, never blocking. `validateUrl` is shared with both bubble menus,
 * and a null from it there does not reject the input — it unsets the link
 * (see `BubbleMenuLinkSelector`'s submit handler). Turning a questionable
 * address into a vanished one is the failure `liquid-url.ts` exists to
 * prevent, so this reports rather than refuses.
 *
 * The undeclared case is the one that matters most, even though it looks like
 * the pedantic one. Liquid runs without `strictVariables`, so `{{ invte_url }}`
 * renders to an empty string and the email ships `<a href="">` — a call to
 * action that goes nowhere, with nothing anywhere in the chain to say so. A
 * variable of the wrong type at least renders something visibly wrong.
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

  // By key, not by label: there is no label to quote for something the
  // template never declared, and the key is what was mistyped.
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
 * The variable an address is set to, when it is set to one.
 *
 * Null for everything else, a mistyped or non-link expression included. Those
 * belong in the text field as the text they are: shown as a chosen variable
 * they would read as correct, and the one thing that makes `{{ invte_url }}`
 * noticeable is that it does not turn into a name.
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
 * The section itself, shared by buttons and text links.
 *
 * The markup mirrors the library's internal `Section` / `PropRow` / `Label` /
 * `TextField` / `Select` primitives, exactly as `VariableSection` does: the
 * `Inspector` compound exports whole sections only, so emitting the same
 * `data-re-inspector-*` attributes is what makes this inherit the panel's
 * styling instead of reading as a foreign component. Reproduced rather than
 * invented, so it will drift if the library changes those attributes.
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
  /*
   * Which of the two the address is, held rather than derived. Derived from
   * the href it could not be switched: choosing to type your own while the
   * href is still `{{ invite_url }}` would resolve straight back to the
   * variable.
   */
  const [choice, setChoice] = useState(
    () => chosenVariableKey(href, variables) ?? CUSTOM_ADDRESS,
  );

  /*
   * Re-seeds the field when the document's href moves underneath it: another
   * link gets selected, or `validateUrl` normalises what was just committed.
   *
   * Adjusting state during render rather than from an effect. React re-runs
   * this component before touching the DOM, so there is no frame showing the
   * stale value, and the effect form is what this codebase's lint rules
   * reject. An uncommitted draft survives, because `href` only moves when the
   * document does — which is also what lets the custom mode stay chosen while
   * the field is still empty.
   */
  if (href !== committed) {
    setCommitted(href);
    setDraft(href);
    setChoice(chosenVariableKey(href, variables) ?? CUSTOM_ADDRESS);
  }

  const linkable = urlVariables(variables);
  const isCustom = choice === CUSTOM_ADDRESS;

  /*
   * Only worth saying about text somebody typed — a chosen variable is a link
   * address by definition. Read from the draft rather than the committed href
   * so it answers while the address is being typed: a half-typed `{{ inv` has
   * no closing braces and matches nothing, so the line appears only once an
   * expression is complete and clears itself as soon as the key is right.
   */
  const warning = isCustom ? addressWarning(draft, variables) : null;

  const commit = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      onCommit(null);
      return;
    }

    const validated = validateUrl(trimmed);

    /*
     * Invalid and non-empty: the document keeps the href it had and the field
     * keeps the draft, so a half-typed URL can be finished. Both bubble-menu
     * forms clear the href instead, which is the behaviour that made a link
     * vanish while it was being typed.
     */
    if (validated) {
      onCommit(validated);
    }
  };

  /*
   * A `url` variable is a finished URL by construction: `order_url`,
   * `invite_url` and `reset_url` are all composed in their event's
   * `getContext` from a configured base, precisely so nobody has to assemble
   * one here. That is what makes the two modes exclusive rather than parts of
   * one value, and it is why picking a variable needs no input beside it.
   */
  const chooseAddress = (next: string) => {
    setChoice(next);

    if (next === CUSTOM_ADDRESS) {
      /*
       * Emptied, but deliberately not committed. `onCommit(null)` unsets the
       * link mark outright for a text link, so saying "I will type my own"
       * would delete the link before there was anything to put in its place.
       * The document keeps the address it had until a replacement is entered.
       */
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
            {/* A native select, so there is no portal and nothing leaves the
                panel's focus scope.

                Its value is the address, not a way of building one: it names
                the chosen variable by label, so the raw `{{ invite_url }}`
                never has to be read. That is the point of the mode — a
                variable is a pill everywhere else in this editor, and a text
                field spelling out Liquid was the one place it was not.

                No format choice: a URL wants the raw value, never `money` or
                a formatted date. */}
            <select
              data-re-inspector-select=""
              id="link-address"
              value={choice}
              onChange={(event) => chooseAddress(event.target.value)}
            >
              <option value={CUSTOM_ADDRESS}>Custom URL…</option>
              {linkable.length === 0 ? (
                /* Said rather than hidden: an empty list explains why there
                   is nothing to pick, where silence reads as a bug. Disabled
                   because it is an explanation, not a choice. */
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
           * Stacked rather than wrapped in a `[data-re-inspector-prop-row]`,
           * because the body is already a flex column and a prop row would put
           * a label beside the field, leaving roughly 9rem for a value that is
           * routinely longer than the panel is wide. `PaddingSection` stacks
           * for the same reason, so this is the panel's own idiom rather than
           * a new one. There is no visible label: the row above says Address
           * and a second word for the same thing would only repeat it.
           */}
          {isCustom && (
            <>
              {/* `data-re-inspector-number` is the library's generic bordered
                  control shell, not a number-specific one — the select and the
                  colour control carry the identical rule. It supplies the
                  border, radius, 1.6rem height and focus ring, so this field
                  sits flush with every other control in the panel rather than
                  as a bare line of text: `INSPECTOR_CLASS` strips the
                  user-agent background and border from every
                  `[data-re-inspector-input]`, on the assumption each one has a
                  shell like this around it. */}
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
                      // Otherwise the keystroke reaches the editor, which is
                      // still focused as far as the focus scope is concerned.
                      event.preventDefault();
                      commit(draft);
                    }
                  }}
                />
              </span>

              {/* `text-xs` because the muted-text rule carries only a colour,
                  and this line sits outside a `[data-re-inspector-prop-row]`,
                  which is what sets 0.75rem everywhere else in the panel. */}
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
 * The button's URL.
 *
 * A button's href is a plain node attribute with nothing validating it, so
 * `setAttr` accepts Liquid directly — it is only the bubble-menu form's own
 * `validateUrl` that ever stood in the way.
 */
export const ButtonLinkSection = ({
  getAttr,
  setAttr,
  variables,
}: InspectorNodeContext & { variables: EmailTemplateVariable[] }) => {
  const raw = getAttr('href');
  // `#` is the node's own default for "no link", and showing it would read as
  // a real value.
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
 * Mirrors the library's internal `normalizeHex`.
 *
 * `<input type="color">` accepts `#rrggbb` and nothing else, so a shorthand
 * has to be expanded and anything else replaced before it reaches the swatch.
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
 * A text link's URL and colour.
 *
 * `InspectorTextContext` carries `linkHref` but no setter for it, so writes go
 * through the editor. The two shapes below are the library's own `setLinkHref`:
 * with the caret inside a link there is nothing selected to mark, so the range
 * is widened to the link first and the caret put back afterwards.
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
        {/* Mirrors the library's `ColorInput`, which is internal. Kept because
            this section replaces `Inspector.Link`, which showed a colour row
            beside its read-only URL — dropping it would be a regression. */}
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
 * Drop-in replacement for `Inspector.Text`.
 *
 * Mirrors the library's own `InspectorTextDefaults` — typography, then the
 * link section when a link is active — with the difference that ours can be
 * typed into. `Inspector.Link` renders its URL field `readOnly`.
 *
 * Note that `Inspector.Root` only reports a `text` target when the selection
 * has content, so this appears when link text is *selected*. A bare caret
 * inside a link resolves to the paragraph instead, and is covered by
 * `BubbleMenu.LinkDefault`.
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

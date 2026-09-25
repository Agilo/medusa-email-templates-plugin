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
  const linkable = urlVariables(variables);

  /*
   * Re-seeds the field when the document's href moves underneath it: another
   * link gets selected, or `validateUrl` normalises what was just committed.
   *
   * Adjusting state during render rather than from an effect. React re-runs
   * this component before touching the DOM, so there is no frame showing the
   * stale value, and the effect form is what this codebase's lint rules
   * reject. An uncommitted draft survives, because `href` only moves when the
   * document does.
   */
  if (href !== committed) {
    setCommitted(href);
    setDraft(href);
  }

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
   * Appended, never substituted. `{{ invite_url }}` alone and
   * `https://shop.test/{{ token }}` are both valid hrefs — `isLiquidUrl`
   * admits each — and appending is the only behaviour that serves the second
   * without discarding what was typed. An empty field makes the expression
   * the whole value, which is the common case.
   */
  const insertVariable = (key: string) => {
    const next = `${draft}{{ ${key} }}`;

    setDraft(next);
    commit(next);
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
        /*
         * The body is already a flex column, so the URL's label and field are
         * emitted as two of its children rather than wrapped in a
         * `[data-re-inspector-prop-row]`. That stacks them, which is what
         * gives an href room: a prop row puts the label and control side by
         * side, leaving roughly 9rem for a value that is routinely longer
         * than the panel is wide. `PaddingSection` stacks for the same
         * reason, so this is the panel's own idiom rather than a new one.
         */
        <div data-re-inspector-section-body="">
          <label data-re-inspector-label="" htmlFor="link-url">
            URL
          </label>
          {/* `data-re-inspector-number` is the library's generic bordered
              control shell, not a number-specific one — the select and the
              colour control carry the identical rule. It supplies the border,
              radius, 1.6rem height and focus ring, so this field sits flush
              with every other control in the panel rather than as a bare line
              of text: `INSPECTOR_CLASS` strips the user-agent background and
              border from every `[data-re-inspector-input]`, on the assumption
              each one has a shell like this around it. */}
          <span data-re-inspector-number="" data-link-url-control="">
            <input
              data-re-inspector-input=""
              data-link-url=""
              id="link-url"
              type="text"
              value={draft}
              placeholder="https://"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={(event) => commit(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  // Otherwise the keystroke reaches the editor, which is still
                  // focused as far as the focus scope is concerned.
                  event.preventDefault();
                  commit(draft);
                }
              }}
            />
          </span>

          <div data-re-inspector-prop-row="">
            <label data-re-inspector-label="" htmlFor="link-variable">
              Variable
            </label>
            {/* A native select, so there is no portal and nothing leaves the
                panel's focus scope.

                No format choice: a URL wants the raw value, never `money` or
                a formatted date. */}
            <select
              data-re-inspector-select=""
              id="link-variable"
              /* Always blank: this row is an action, not a stored value. An
                 href may hold several expressions, so no single option could
                 represent it. */
              value=""
              disabled={linkable.length === 0}
              onChange={(event) => insertVariable(event.target.value)}
            >
              {linkable.length === 0 ? (
                /* Said rather than hidden: an empty row explains why there is
                   nothing to pick, where a missing one reads as a bug. */
                <option value="">No link variables</option>
              ) : (
                <option value="">Insert a variable</option>
              )}
              {groupVariables(linkable).map(([group, grouped]) => (
                <optgroup key={group} label={group}>
                  {grouped.map((variable) => (
                    <option key={variable.key} value={variable.key}>
                      {variable.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

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

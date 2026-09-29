import {
  Inspector,
  type InspectorNodeContext,
  type InspectorTextContext,
} from '@react-email/editor/ui';
import {
  getSelectionAlignment,
  setTextAlignment,
} from '@react-email/editor/utils';
import { useCurrentEditor, useEditorState } from '@tiptap/react';
import { useState } from 'react';

import { isVariableFormat } from '../../../lib/rendering/variable-format';
import type { EmailTemplateVariable } from '../../lib/types';
import {
  attributesFor,
  FORMAT_LABELS,
  formatsFor,
  groupVariables,
  listVariables,
  scalarVariables,
  variablesAt,
} from '../../lib/variables';
import { ButtonLinkSection } from './link-inspector';

type SectionName =
  | 'attributes'
  | 'link'
  | 'size'
  | 'typography'
  | 'padding'
  | 'columnSpacing'
  | 'background'
  | 'border';

/**
 * Mirrors the library's own `getDefaultLayout`.
 *
 * Passing children to `Inspector.Node` replaces `InspectorNodeDefaults`
 * entirely, and that component is internal — so branching on our node type
 * means supplying the panel for every other type too. Reproduced rather than
 * invented, but it will drift if the library changes its defaults.
 *
 * One deliberate divergence: `link` on `button`. The library's own layout
 * lists a `link` section but its renderer has no case for it and drops it, so
 * a button's href had no home in the panel at all. Ours is first because it is
 * the property a button is most often opened to change.
 *
 * Images can carry an href too, and would take the same section — left out
 * only because nothing has asked for it.
 */
const SECTIONS_BY_NODE: Record<string, readonly SectionName[]> = {
  image: ['attributes', 'size', 'padding', 'border'],
  button: ['link', 'typography', 'size', 'padding', 'border', 'background'],
  section: ['background', 'padding', 'border'],
  div: ['background', 'padding', 'border'],
  codeBlock: ['attributes', 'padding', 'border'],
  footer: ['typography', 'padding', 'background'],
  twoColumns: [
    'columnSpacing',
    'typography',
    'padding',
    'background',
    'border',
  ],
  threeColumns: [
    'columnSpacing',
    'typography',
    'padding',
    'background',
    'border',
  ],
  fourColumns: [
    'columnSpacing',
    'typography',
    'padding',
    'background',
    'border',
  ],
};

const FALLBACK_SECTIONS: readonly SectionName[] = [
  'typography',
  'padding',
  'background',
  'border',
];

const DefaultSections = ({
  context,
  variables,
}: {
  context: InspectorNodeContext;
  variables: EmailTemplateVariable[];
}) => {
  const sections = SECTIONS_BY_NODE[context.nodeType] ?? FALLBACK_SECTIONS;

  /*
   * `Typography` is typed against the text context but the library hands it
   * the node context here too, leaving its mark and alignment props
   * undefined. Matching that behaviour needs the cast; the alternative is
   * dropping a section the panel has always shown.
   */
  const textContext = context as unknown as InspectorTextContext;

  return (
    <>
      {sections.map((section) => {
        switch (section) {
          case 'attributes':
            return <Inspector.Attributes key={section} {...context} />;
          case 'link':
            return (
              <ButtonLinkSection
                key={section}
                {...context}
                variables={variables}
              />
            );
          case 'size':
            return <Inspector.Size key={section} {...context} />;
          case 'typography':
            return <Inspector.Typography key={section} {...textContext} />;
          case 'padding':
            return <Inspector.Padding key={section} {...context} />;
          case 'columnSpacing':
            return <Inspector.ColumnSpacing key={section} {...context} />;
          case 'background':
            return <Inspector.Background key={section} {...context} />;
          case 'border':
            return <Inspector.Border key={section} {...context} />;
          default:
            return null;
        }
      })}
    </>
  );
};

type VariableSectionProps = InspectorNodeContext & {
  variables: EmailTemplateVariable[];
};

/**
 * Which value a pill shows, and how it is displayed.
 *
 * Styling lives in its own section, `VariableTypography`, and stops at type:
 * background, border and padding on an inline value would fight the pill's
 * chrome on the canvas and render unpredictably in mail clients.
 *
 * The markup mirrors the library's own `Section` / `PropRow` / `Label` /
 * `Select` primitives, which are internal — the `Inspector` compound exports
 * whole sections only. Emitting the same `data-re-inspector-*` attributes is
 * what makes this panel inherit the panel's styling rather than reading as a
 * different component: a row per property with the label beside its control,
 * and a select at the shared 1.6rem height. Reproduced rather than invented,
 * so it will drift if the library changes those attributes.
 */
const VariableSection = ({
  getAttr,
  setAttr,
  nodePos,
  variables: declared,
}: VariableSectionProps) => {
  const { editor } = useCurrentEditor();
  // What a pill *here* may show: `item.*` values only inside a Repeat block.
  const variables = editor
    ? variablesAt(editor.state.doc, nodePos.pos, declared)
    : scalarVariables(declared);
  // Matching the library's sections, which are collapsible by their title.
  const [collapsed, setCollapsed] = useState(false);
  const rawKey = getAttr('key');
  const key = typeof rawKey === 'string' ? rawKey : '';
  const rawFormat = getAttr('format');
  const format = isVariableFormat(rawFormat) ? rawFormat : 'text';
  const chosen = variables.find((entry) => entry.key === key);
  const formats = formatsFor(chosen);

  const chooseVariable = (nextKey: string) => {
    const next = variables.find((entry) => entry.key === nextKey);
    const attrs = attributesFor(next);

    // Three writes because `setAttr` takes one attribute at a time. They
    // compose: each re-reads the node from the document before writing.
    setAttr('key', attrs.key);
    setAttr('format', attrs.format);
    setAttr('currencySource', attrs.currencySource);
  };

  return (
    <div data-re-inspector-section="" data-has-title="">
      <div data-re-inspector-section-header="">
        {/* "Attributes" rather than "Variable": it matches what the library
            calls a node's own settings, and the row beneath is already
            labelled Variable. */}
        <button
          type="button"
          data-re-inspector-section-toggle=""
          onClick={() => setCollapsed((value) => !value)}
        >
          Attributes
        </button>
      </div>

      {!collapsed && (
        <div data-re-inspector-section-body="">
          <div data-re-inspector-prop-row="">
            <label data-re-inspector-label="" htmlFor="variable">
              Variable
            </label>
            <select
              data-re-inspector-select=""
              id="variable"
              value={key}
              onChange={(event) => chooseVariable(event.target.value)}
            >
              <option value="">Choose a variable</option>
              {groupVariables(variables).map(([group, grouped]) => (
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

          {/* Only worth showing when the value can be displayed more than one
              way. */}
          {formats.length > 1 && (
            <div data-re-inspector-prop-row="">
              <label data-re-inspector-label="" htmlFor="variable-format">
                Format
              </label>
              <select
                data-re-inspector-select=""
                id="variable-format"
                value={format}
                onChange={(event) => setAttr('format', event.target.value)}
              >
                {formats.map((option) => (
                  <option key={option} value={option}>
                    {FORMAT_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** The marks the Typography section's Format row toggles. */
const FORMAT_MARKS = ['bold', 'italic', 'underline', 'strike', 'code'];

/**
 * The library's Typography section, pointed at the pill.
 *
 * Colour, size and line height come from the node context, whose style
 * helpers write the pill's own `style` — so they style the value alone, not
 * the words around it, and the export wraps just the expression in a span.
 *
 * Format and Align are what the bubble menu offers: marks on the pill, and
 * the alignment of the paragraph it sits in, through the same helpers the
 * stock align buttons use.
 */
const VariableTypography = ({ context }: { context: InspectorNodeContext }) => {
  const { editor } = useCurrentEditor();
  const marks =
    useEditorState({
      editor,
      selector: ({ editor: current }) =>
        Object.fromEntries(
          FORMAT_MARKS.map((mark) => [mark, current?.isActive(mark) ?? false]),
        ),
    }) ?? {};
  const alignment =
    useEditorState({
      editor,
      selector: ({ editor: current }) =>
        current ? getSelectionAlignment(current) : 'left',
    }) ?? 'left';

  if (!editor) {
    return null;
  }

  return (
    <Inspector.Typography
      {...(context as unknown as InspectorTextContext)}
      getStyle={context.getStyle}
      setStyle={context.setStyle}
      marks={marks}
      toggleMark={(mark) => editor.chain().focus().toggleMark(mark).run()}
      alignment={alignment}
      setAlignment={(value) => setTextAlignment(editor, value)}
    />
  );
};

/**
 * Which list a Repeat block repeats over.
 *
 * Deliberately no styling controls: the block is a loop around its content
 * rather than a box of its own, so spacing and colour belong to the content
 * inside it, where the usual sections apply.
 *
 * The same `data-re-inspector-*` markup as `VariableSection`.
 */
const RepeatSection = ({
  getAttr,
  setAttr,
  variables,
}: VariableSectionProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const rawSource = getAttr('source');
  const source = typeof rawSource === 'string' ? rawSource : '';
  const lists = listVariables(variables);

  return (
    <div data-re-inspector-section="" data-has-title="">
      <div data-re-inspector-section-header="">
        <button
          type="button"
          data-re-inspector-section-toggle=""
          onClick={() => setCollapsed((value) => !value)}
        >
          Attributes
        </button>
      </div>

      {!collapsed && (
        <div data-re-inspector-section-body="">
          <div data-re-inspector-prop-row="">
            <label data-re-inspector-label="" htmlFor="repeat-source">
              Repeat for each
            </label>
            <select
              data-re-inspector-select=""
              id="repeat-source"
              value={source}
              onChange={(event) => setAttr('source', event.target.value)}
            >
              <option value="">Choose a list</option>
              {/* Kept selectable when the event no longer declares it, so the
                  select shows what the block actually holds. */}
              {source && !lists.some((list) => list.key === source) && (
                <option value={source}>{source}</option>
              )}
              {lists.map((list) => (
                <option key={list.key} value={list.key}>
                  {list.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

/** Drop-in replacement for `Inspector.Node` that knows about variables. */
export const VariableInspector = ({
  variables,
}: {
  variables: EmailTemplateVariable[];
}) => (
  <Inspector.Node>
    {(context) =>
      context.nodeType === 'variable' ? (
        <>
          <VariableSection {...context} variables={variables} />
          <VariableTypography context={context} />
        </>
      ) : context.nodeType === 'repeat' ? (
        <RepeatSection {...context} variables={variables} />
      ) : (
        <DefaultSections context={context} variables={variables} />
      )
    }
  </Inspector.Node>
);

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
 * Mirrors the library's internal `getDefaultLayout`. Custom children replace
 * `Inspector.Node`'s defaults entirely, so every node type's sections must be
 * supplied here. Will drift if the library changes its defaults.
 *
 * One divergence: `button` gets a working `link` section, first. The
 * library lists one but never renders it. (Images could use it too; not yet
 * needed.)
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

  // `Typography` is typed for the text context, but the library passes it the
  // node context too (marks and alignment undefined). The cast matches that.
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

const VariableSection = ({
  getAttr,
  setAttr,
  nodePos,
  variables: declared,
}: VariableSectionProps) => {
  const { editor } = useCurrentEditor();
  const variables = editor
    ? variablesAt(editor.state.doc, nodePos.pos, declared)
    : scalarVariables(declared);
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

    setAttr('key', attrs.key);
    setAttr('format', attrs.format);
    setAttr('currencySource', attrs.currencySource);
  };

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

const FORMAT_MARKS = ['bold', 'italic', 'underline', 'strike', 'code'];

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

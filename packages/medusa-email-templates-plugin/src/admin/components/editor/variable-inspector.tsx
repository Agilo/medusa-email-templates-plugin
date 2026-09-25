import {
  Inspector,
  type InspectorNodeContext,
  type InspectorTextContext,
} from '@react-email/editor/ui';
import { useState } from 'react';

import { isVariableFormat } from '../../../lib/rendering/variable-format';
import type { EmailTemplateVariable } from '../../lib/types';
import {
  attributesFor,
  FORMAT_LABELS,
  formatsFor,
  groupVariables,
} from '../../lib/variables';

type SectionName =
  | 'attributes'
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
 * `link` is deliberately absent: the layout lists it, but the renderer's
 * switch has no case for it and drops it.
 */
const SECTIONS_BY_NODE: Record<string, readonly SectionName[]> = {
  image: ['attributes', 'size', 'padding', 'border'],
  button: ['typography', 'size', 'padding', 'border', 'background'],
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

const DefaultSections = ({ context }: { context: InspectorNodeContext }) => {
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
 * Deliberately no styling controls: a variable has no `style` attribute, so
 * background, border and padding would render controls that silently write
 * nowhere.
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
  variables,
}: VariableSectionProps) => {
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

/** Drop-in replacement for `Inspector.Node` that knows about variables. */
export const VariableInspector = ({
  variables,
}: {
  variables: EmailTemplateVariable[];
}) => (
  <Inspector.Node>
    {(context) =>
      context.nodeType === 'variable' ? (
        <VariableSection {...context} variables={variables} />
      ) : (
        <DefaultSections context={context} />
      )
    }
  </Inspector.Node>
);

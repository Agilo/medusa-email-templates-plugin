import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

import {
  LOOP_ITEM,
  type VariableFormat,
} from '../../lib/rendering/variable-format';
import type { EmailTemplateVariable } from './types';

/**
 * Variables that print as a value: everything but lists, which would render
 * as "[object Object]" and are only offered as Repeat block sources.
 */
export const scalarVariables = (
  variables: EmailTemplateVariable[],
): EmailTemplateVariable[] =>
  variables.filter((variable) => variable.type !== 'list');

/** The lists a Repeat block may repeat over. */
export const listVariables = (
  variables: EmailTemplateVariable[],
): EmailTemplateVariable[] =>
  variables.filter((variable) => variable.type === 'list');

/**
 * A list's fields as variables inside its block (`title` → `item.title`),
 * grouped under the list's label.
 */
export const itemVariables = (
  list: EmailTemplateVariable,
): EmailTemplateVariable[] =>
  (list.fields ?? []).map((field) => ({
    ...field,
    key: `${LOOP_ITEM}.${field.key}`,
    group: list.label,
  }));

/**
 * The variables a pill at `pos` may use: the event's scalars, plus `item.*`
 * inside a Repeat block. Read from the document, so an `item.*` pill dragged
 * out of its block becomes stale — exactly when it would send empty text.
 */
export const variablesAt = (
  doc: ProseMirrorNode,
  pos: number | undefined,
  variables: EmailTemplateVariable[],
): EmailTemplateVariable[] => {
  const scalars = scalarVariables(variables);

  if (typeof pos !== 'number' || pos < 0 || pos > doc.content.size) {
    return scalars;
  }

  const $pos = doc.resolve(pos);

  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);

    if (node.type.name === 'repeat') {
      const list = listVariables(variables).find(
        (entry) => entry.key === node.attrs.source,
      );

      return list ? [...scalars, ...itemVariables(list)] : scalars;
    }
  }

  return scalars;
};

/** Variables arrive flat; every picker shows them under their group. */
export const groupVariables = (
  variables: EmailTemplateVariable[],
): [string, EmailTemplateVariable[]][] => {
  const groups = new Map<string, EmailTemplateVariable[]>();

  variables.forEach((variable) => {
    const group = variable.group ?? 'Other';

    groups.set(group, [...(groups.get(group) ?? []), variable]);
  });

  return [...groups.entries()];
};

/**
 * The variables a link or button href may use: only those typed `url`.
 * Anything else (e.g. `{{ order.total }}`) would produce a broken link that
 * nothing catches until a recipient clicks it.
 *
 * Host URL variables must be marked `type: 'url'`; guessing from names like
 * `invite_url` would fail for other naming schemes.
 */
export const urlVariables = (
  variables: EmailTemplateVariable[],
): EmailTemplateVariable[] =>
  variables.filter((variable) => variable.type === 'url');

export const FORMAT_LABELS: Record<VariableFormat, string> = {
  text: 'Text',
  money: 'Money',
  date_long: 'Long date',
  date_short: 'Short date',
  date_time: 'Date and time',
};

/**
 * Formats an admin may choose for a variable. Plain text always; the rest
 * only for the matching type, since e.g. `money` on a name renders empty.
 */
export const formatsFor = (
  variable: EmailTemplateVariable | undefined,
): VariableFormat[] => {
  switch (variable?.type) {
    case 'money':
      return ['text', 'money'];
    case 'date':
      return ['text', 'date_long', 'date_short', 'date_time'];
    default:
      return ['text'];
  }
};

/** What a variable should be formatted as the moment it is chosen. */
export const defaultFormatFor = (
  variable: EmailTemplateVariable | undefined,
): VariableFormat => {
  switch (variable?.type) {
    case 'money':
      return 'money';
    case 'date':
      return 'date_long';
    default:
      return 'text';
  }
};

/** Attributes for a variable pill, derived from the chosen variable. */
export const attributesFor = (
  variable: EmailTemplateVariable | undefined,
  /** Overrides the type's default, for picking a format at insertion time. */
  format?: VariableFormat,
): { key: string; format: VariableFormat; currencySource: string | null } => ({
  key: variable?.key ?? '',
  format: format ?? defaultFormatFor(variable),
  currencySource: variable?.currencyKey ?? null,
});

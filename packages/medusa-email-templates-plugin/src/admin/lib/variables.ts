import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

import {
  LOOP_ITEM,
  type VariableFormat,
} from '../../lib/rendering/variable-format';
import type { EmailTemplateVariable } from './types';

/**
 * Variables that print as a value — everything but lists.
 *
 * A list is an array: printed as a pill it sends "[object Object]", so it is
 * only ever offered as a Repeat block's source.
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
 * A list's fields as the variables they are inside its block: `title`
 * becomes `item.title`, grouped under the list so the picker says where it
 * comes from.
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
 * What a pill at `pos` may show.
 *
 * The event's own values everywhere, plus one entry's values inside a Repeat
 * block. Scope is structural, so it is read from the document rather than
 * stored on the pill: drag an `item.title` pill out of its block and it stops
 * resolving, which is exactly when it would start sending empty text.
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
 * The variables a link or button href may be set to.
 *
 * Only those declared `url`. An href is not body text: dropping
 * `{{ order.total }}` into one produces a link to "€42.00", which is broken in
 * a way nothing downstream can catch — the Liquid renders, the anchor is
 * emitted, and it fails only when a recipient clicks it. Offering every
 * variable made that the easiest mistake in the editor to make.
 *
 * The consequence is that a host application's own URL variable has to be
 * marked `type: 'url'` to appear here. That is deliberate: guessing from key
 * names like `invite_url` would work for the built-in events and quietly fail
 * for anyone whose naming differs.
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
 * Formats an admin may choose for a variable.
 *
 * Plain text is always available — showing a raw value is a legitimate
 * choice. The rest are gated on the declared type, because applying `money`
 * to a name renders an empty string rather than failing loudly.
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

import type { VariableFormat } from '../../lib/rendering/variable-format';
import type { EmailTemplateVariable } from './types';

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

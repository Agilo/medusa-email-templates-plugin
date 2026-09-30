import { VARIABLE_KEY_PATTERN } from '../rendering/variable-format';
import type { EmailEventDefinition, EmailTemplateVariable } from './types';

const definitions: EmailEventDefinition<never>[] = [];

/**
 * Every key the editor would write into Liquid: each variable's key and
 * currency key, including list fields.
 */
const declaredKeys = (
  variables: EmailTemplateVariable[],
  prefix = '',
): { key: string; field: string }[] =>
  variables.flatMap((variable) => [
    { key: variable.key, field: `${prefix}key` },
    ...(variable.currencyKey !== undefined
      ? [{ key: variable.currencyKey, field: `${prefix}currencyKey` }]
      : []),
    ...declaredKeys(variable.fields ?? [], `${variable.key} fields › `),
  ]);

/**
 * Rejects keys the editor can't emit, at startup rather than when an admin
 * uses them. `toLiquidExpression` accepts only lowercase dotted identifiers
 * (keeping quotes out of templates), so a key like `order.displayId` or
 * `customer-name` would otherwise appear in pickers and then fail.
 */
const assertEditableKeys = (definition: EmailEventDefinition<never>): void => {
  const invalid = declaredKeys(definition.variables).filter(
    ({ key }) => !VARIABLE_KEY_PATTERN.test(key),
  );

  if (invalid.length) {
    throw new Error(
      `Email template "${definition.templateKey}" declares ${
        invalid.length === 1 ? 'a variable key' : 'variable keys'
      } the editor cannot use: ${invalid
        .map(({ key, field }) => `${JSON.stringify(key)} (${field})`)
        .join(
          ', ',
        )}. Keys must be lowercase letters, digits and underscores, separated by dots — for example "order.display_id".`,
    );
  }
};

const asInternal = <TData>(definition: EmailEventDefinition<TData>) =>
  definition as unknown as EmailEventDefinition<never>;

/**
 * Registers an email event definition. Template keys must be unique; an event
 * may have several definitions only if each has a `matches` predicate.
 */
export const registerEmailEvent = <TData>(
  definition: EmailEventDefinition<TData>,
): EmailEventDefinition<TData> => {
  if (definitions.some((it) => it.templateKey === definition.templateKey)) {
    throw new Error(
      `An email template with key "${definition.templateKey}" is already registered.`,
    );
  }

  assertEditableKeys(asInternal(definition));

  const sameEvent = definitions.filter((it) => it.event === definition.event);

  if (
    sameEvent.length &&
    (!definition.matches || sameEvent.some((it) => !it.matches))
  ) {
    throw new Error(
      `Event "${definition.event}" already has an email template. Give every definition for this event a "matches" predicate.`,
    );
  }

  definitions.push(asInternal(definition));

  return definition;
};

export const listEmailEventDefinitions = (): EmailEventDefinition<never>[] => [
  ...definitions,
];

export const getEmailEventDefinitionByTemplateKey = (
  templateKey: string,
): EmailEventDefinition<never> | undefined =>
  definitions.find((definition) => definition.templateKey === templateKey);

/** Finds the definition handling a payload, honouring `matches`. */
export const getEmailEventDefinitionForPayload = <TData>(
  event: string,
  data: TData,
): EmailEventDefinition<never> | undefined =>
  definitions.find(
    (definition) =>
      definition.event === event &&
      (!definition.matches || definition.matches(data as unknown as never)),
  );

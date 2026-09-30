import { VARIABLE_KEY_PATTERN } from '../rendering/variable-format';
import type { EmailEventDefinition, EmailTemplateVariable } from './types';

const definitions: EmailEventDefinition<never>[] = [];

/**
 * Every key a definition declares that the editor would turn into Liquid:
 * each variable's key and currency key, and a list's field keys and theirs.
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
 * Rejects a key the editor cannot emit, at registration rather than at save.
 *
 * The editor writes each key into Liquid through `toLiquidExpression`, which
 * accepts only lowercase dotted identifiers — that restriction is what keeps
 * a quote out of the exported template. A key like `order.displayId` or
 * `customer-name` was accepted here, offered in every picker, and could be
 * inserted; it failed only when the template was saved, and in the subject
 * that failure escaped as an unhandled rejection with nothing saved and no
 * message. Failing here names the event and the key at startup instead.
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
 * Registers an email event definition. Template keys are unique, and an event
 * may have several definitions only when each one has a `matches` predicate.
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

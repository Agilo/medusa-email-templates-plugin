import type { EmailEventDefinition } from './types';

const definitions: EmailEventDefinition<never>[] = [];

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

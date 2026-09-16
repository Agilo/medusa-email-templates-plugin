import { registerEmailEvent } from './registry';
import type { EmailEventDefinition } from './types';

/**
 * Registers an email event definition and returns it. Host applications call
 * this from a subscriber file, which Medusa loads at startup.
 */
export const defineEmailEvent = <TData>(
  definition: EmailEventDefinition<TData>,
): EmailEventDefinition<TData> => registerEmailEvent(definition);

import { describe, expect, it } from 'vitest';

import {
  getEmailEventDefinitionByTemplateKey,
  getEmailEventDefinitionForPayload,
  listEmailEventDefinitions,
  registerEmailEvent,
} from '../index';
import type { EmailEventDefinition } from '../types';

const definition = (
  overrides: Partial<EmailEventDefinition<{ actor: string }>> = {},
): EmailEventDefinition<{ actor: string }> => ({
  event: 'test.event',
  templateKey: 'test-template',
  label: 'Test',
  defaultTemplate: { subject: 'Hi', html: '<p>Hi</p>' },
  getRecipient: async () => 'customer@example.com',
  getContext: async () => ({}),
  variables: [],
  ...overrides,
});

describe('email event registry', () => {
  it('registers the built-in order-placed definition', () => {
    const orderPlaced = getEmailEventDefinitionByTemplateKey('order-placed');

    expect(orderPlaced?.event).toBe('order.placed');
    expect(listEmailEventDefinitions().length).toBeGreaterThan(0);
  });

  it('finds the definition handling a payload', () => {
    expect(
      getEmailEventDefinitionForPayload('order.placed', { id: 'order_1' })
        ?.templateKey,
    ).toBe('order-placed');
    expect(
      getEmailEventDefinitionForPayload('unknown.event', {}),
    ).toBeUndefined();
  });

  it.each([
    ['camel case', { key: 'order.displayId', label: 'Order', example: 1 }],
    ['a dash', { key: 'customer-name', label: 'Name', example: 'Jane' }],
    [
      'a bad currency key',
      {
        key: 'order.total',
        label: 'Total',
        example: 1,
        type: 'money' as const,
        currencyKey: 'order.currencyCode',
      },
    ],
    [
      'a bad list field',
      {
        key: 'order.items',
        label: 'Items',
        example: [],
        type: 'list' as const,
        fields: [{ key: 'unitPrice', label: 'Price', example: 1 }],
      },
    ],
  ])('rejects a variable key with %s, naming it', (_, variable) => {
    expect(() =>
      registerEmailEvent(
        definition({
          templateKey: `bad-key-${variable.key}`,
          event: `bad.${variable.key}`,
          variables: [variable],
        }),
      ),
    ).toThrow(/variable key.*the editor cannot use/);
  });

  it('names every bad key and where it was declared', () => {
    expect(() =>
      registerEmailEvent(
        definition({
          templateKey: 'bad-keys',
          event: 'bad.keys',
          variables: [
            { key: 'order.displayId', label: 'Order', example: 1 },
            {
              key: 'order.items',
              label: 'Items',
              example: [],
              type: 'list',
              fields: [{ key: 'unitPrice', label: 'Price', example: 1 }],
            },
          ],
        }),
      ),
    ).toThrow(
      /"order\.displayId" \(key\), "unitPrice" \(order\.items fields › key\)/,
    );
  });

  it('accepts every built-in event', () => {
    listEmailEventDefinitions().forEach((registered) => {
      expect(registered.variables.length).toBeGreaterThan(0);
    });
  });

  it('rejects a duplicate template key', () => {
    registerEmailEvent(definition({ templateKey: 'duplicate-key' }));

    expect(() =>
      registerEmailEvent(
        definition({ templateKey: 'duplicate-key', event: 'other.event' }),
      ),
    ).toThrow('already registered');
  });

  it('requires a matches predicate when an event has several templates', () => {
    registerEmailEvent(
      definition({ event: 'shared.event', templateKey: 'shared-a' }),
    );

    expect(() =>
      registerEmailEvent(
        definition({ event: 'shared.event', templateKey: 'shared-b' }),
      ),
    ).toThrow('matches');
  });

  it('selects between definitions of one event using matches', () => {
    registerEmailEvent(
      definition({
        event: 'actor.event',
        templateKey: 'actor-user',
        matches: (data) => data.actor === 'user',
      }),
    );
    registerEmailEvent(
      definition({
        event: 'actor.event',
        templateKey: 'actor-customer',
        matches: (data) => data.actor === 'customer',
      }),
    );

    expect(
      getEmailEventDefinitionForPayload('actor.event', { actor: 'customer' })
        ?.templateKey,
    ).toBe('actor-customer');
    expect(
      getEmailEventDefinitionForPayload('actor.event', { actor: 'nobody' }),
    ).toBeUndefined();
  });
});

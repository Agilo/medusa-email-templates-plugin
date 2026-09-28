import { describe, expect, it } from 'vitest';

import type { EmailTemplateVariable } from '../../../lib/types';
import { addressWarning, chosenVariableKey } from '../link-inspector';

const variables: EmailTemplateVariable[] = [
  {
    key: 'invite_url',
    label: 'Accept link',
    example: 'https://admin.example.com/app/invite?token=abc',
    type: 'url',
  },
  { key: 'store.name', label: 'Store name', example: 'Medusa Store' },
  { key: 'order.total', label: 'Total', example: 4200, type: 'money' },
];

/*
 * Which of the two the Link section opens in. A null means the address is
 * shown as text in the custom field, so everything this rejects is something
 * the admin gets to see and correct rather than something presented back as a
 * chosen variable.
 */
describe('chosenVariableKey', () => {
  it('recognises an address set to a link variable', () => {
    expect(chosenVariableKey('{{ invite_url }}', variables)).toBe('invite_url');
  });

  it('does not recognise a mistyped key', () => {
    expect(chosenVariableKey('{{ invte_url }}', variables)).toBeNull();
  });

  it('does not recognise a variable that is not a link address', () => {
    expect(chosenVariableKey('{{ store.name }}', variables)).toBeNull();
  });

  it('does not recognise a typed address, or an empty one', () => {
    expect(chosenVariableKey('https://example.com', variables)).toBeNull();
    expect(chosenVariableKey('', variables)).toBeNull();
  });

  // Only the whole value is a chosen variable; anything around it makes the
  // address something the admin composed, which belongs in the text field.
  it('does not recognise an expression inside a longer address', () => {
    expect(
      chosenVariableKey('https://shop.test/orders/{{ order.id }}', variables),
    ).toBeNull();
  });
});

describe('addressWarning', () => {
  it('says nothing about a variable declared as a URL', () => {
    expect(addressWarning('{{ invite_url }}', variables)).toBeNull();
  });

  /*
   * The case that ships broken email. Liquid runs without `strictVariables`,
   * so a mistyped key renders to an empty string and the send goes out with
   * `<a href="">` — nothing downstream notices, which is why it has to be
   * caught here.
   */
  it('names a key the template does not declare', () => {
    expect(addressWarning('{{ invte_url }}', variables)).toBe(
      'invte_url is not a variable in this template.',
    );
  });

  it('names a variable that is not meant to be an address', () => {
    expect(addressWarning('{{ store.name }}', variables)).toBe(
      'Store name is not marked as a link address.',
    );
  });

  it('looks through a filter to the key behind it', () => {
    expect(
      addressWarning(
        '{{ order.total | money: order.currency_code }}',
        variables,
      ),
    ).toBe('Total is not marked as a link address.');
  });

  /*
   * An expression inside a longer address is a path segment, and a path
   * segment is legitimately not a URL variable — warning about it would be
   * wrong, not merely noisy.
   */
  it('says nothing about an expression embedded in an address', () => {
    expect(
      addressWarning('https://shop.test/orders/{{ order.id }}', variables),
    ).toBeNull();
  });

  it('says nothing about an ordinary address, or nothing at all', () => {
    expect(addressWarning('https://example.com', variables)).toBeNull();
    expect(addressWarning('', variables)).toBeNull();
  });

  // Half-typed braces are not an expression yet, so the line stays away until
  // there is something to say about.
  it('says nothing until the expression is closed', () => {
    expect(addressWarning('{{ invte_url', variables)).toBeNull();
  });
});

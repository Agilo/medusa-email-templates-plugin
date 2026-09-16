import { describe, expect, it } from 'vitest';

import { hasSubject, isRenderedContent } from '../content';
import { redactSecrets } from '../redact';

describe('isRenderedContent', () => {
  it.each([
    [{ subject: 'Hi', html: '<p>Hi</p>' }, true],
    [{ subject: 'Hi', text: 'Hi' }, true],
    [{ html: '<p>No subject</p>' }, true],
    [{ subject: 'Only a subject' }, false],
    [{ subject: 'Hi', html: '   ', text: '' }, false],
    [{}, false],
    [null, false],
    [undefined, false],
  ])('returns the expected result for %j', (content, expected) => {
    expect(isRenderedContent(content)).toBe(expected);
  });

  it('requires a non-empty subject', () => {
    expect(hasSubject({ subject: 'Hi', html: '<p>Hi</p>' })).toBe(true);
    expect(hasSubject({ subject: ' ', html: '<p>Hi</p>' })).toBe(false);
    expect(hasSubject({ html: '<p>Hi</p>' })).toBe(false);
  });
});

describe('redactSecrets', () => {
  it('replaces every occurrence of each secret', () => {
    expect(
      redactSecrets('key re_abc123 rejected (re_abc123)', ['re_abc123']),
    ).toBe('key [redacted] rejected ([redacted])');
  });

  it('ignores empty and very short secrets', () => {
    expect(redactSecrets('a b c', [null, undefined, '', 'a'])).toBe('a b c');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { claimLinkShortcut } from '../search-shortcut';

const pressInEditor = (init: KeyboardEventInit) => {
  const editor = document.createElement('div');
  const onDocument = vi.fn();

  document.body.append(editor);
  document.addEventListener('keydown', onDocument);
  editor.addEventListener('keydown', (event) => {
    claimLinkShortcut(null, event);
  });

  editor.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, ...init }),
  );
  document.removeEventListener('keydown', onDocument);

  return onDocument;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('claimLinkShortcut', () => {
  it('keeps Cmd-K from reaching the dashboard', () => {
    expect(pressInEditor({ key: 'k', metaKey: true })).not.toHaveBeenCalled();
  });

  it('keeps Ctrl-K from reaching it either', () => {
    expect(pressInEditor({ key: 'k', ctrlKey: true })).not.toHaveBeenCalled();
  });

  it('lets an unmodified k through', () => {
    expect(pressInEditor({ key: 'k' })).toHaveBeenCalled();
  });

  it('lets other shortcuts through', () => {
    expect(pressInEditor({ key: 'j', metaKey: true })).toHaveBeenCalled();
  });

  it('lets Shift-Cmd-K through', () => {
    expect(
      pressInEditor({ key: 'K', metaKey: true, shiftKey: true }),
    ).toHaveBeenCalled();
  });

  /*
   * False, always. ProseMirror reads a truthy return as "handled" and would
   * stop before the keymap that actually makes the link.
   */
  it('never claims to have handled the key', () => {
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });

    expect(claimLinkShortcut(null, event)).toBe(false);
  });
});

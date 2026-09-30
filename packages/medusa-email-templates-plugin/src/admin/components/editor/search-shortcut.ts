/**
 * Keeps Cmd/Ctrl-K inside the editor.
 *
 * Both the editor (make a link) and the dashboard (open search, via a
 * `document` keydown listener) bind it. ProseMirror doesn't stop propagation,
 * so both used to fire. Cmd-K is the standard link shortcut, so the editor
 * keeps it while focused; elsewhere the search still opens.
 *
 * Used as `handleDOMEvents.keydown`, which runs on the editor element before
 * ProseMirror's keymap. Returning false lets the keymap still make the link;
 * only the bubble to `document` is stopped.
 *
 * Matches the dashboard's check: with Shift the key is `K`, which neither
 * handles.
 */
export const claimLinkShortcut = (
  _view: unknown,
  event: KeyboardEvent,
): boolean => {
  if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
    event.stopPropagation();
  }

  return false;
};

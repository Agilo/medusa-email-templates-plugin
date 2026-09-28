/**
 * Keeps Cmd/Ctrl-K inside the editor.
 *
 * The combination is bound twice over, and both bindings used to fire. The
 * dashboard opens its search palette from an unconditional keydown listener on
 * `document` — no check for where the key was pressed, and no
 * `preventDefault`. The editor binds the same combination to "make this a
 * link". ProseMirror does call `preventDefault` when its keymap handles a key,
 * but it never stops the event bubbling, so the link was created and the
 * palette opened on top of it.
 *
 * Stopping the event rather than rebinding the editor: Cmd-K is *the* link
 * shortcut, and owning it while focused is what every other editor does.
 * Outside the canvas the palette still answers.
 *
 * Passed as ProseMirror's `handleDOMEvents.keydown`, which is the right hook
 * on two counts: it is consulted before ProseMirror's own key handling, and it
 * listens on the editor element, which is far below `document`. Returning
 * false leaves the event unhandled as far as ProseMirror is concerned, so the
 * keymap still runs and still makes the link — only the trip up to `document`
 * is cut.
 *
 * The comparison matches the dashboard's own: with Shift held the key is `K`,
 * which neither side acts on.
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

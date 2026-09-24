// Shared by the context bar and the editors that feed its undo history.
//
// Every `context-edited` event is a patch to save, but not every one is an
// action the user took and can undo. A rich text editor on the page saves
// what was typed about once a second, and records the typing itself, step by
// step, with `context-history-record`; those saves must reach the server
// without landing on the undo stack as well, or one keystroke would be
// undone twice. A layout widget provisions its own columns the moment it is
// created; taking those back is not an edit of the user's to undo either.
//
// Such code wraps the change in `withoutHistory()`. The chain from there to
// the context bar is synchronous, so the context bar can ask
// `isWithoutHistory()` while it handles the event.

let depth = 0;

export function withoutHistory(fn) {
  depth++;
  try {
    return fn();
  } finally {
    depth--;
  }
}

export function isWithoutHistory() {
  return depth > 0;
}

// Shared by the context bar and the editors that feed its undo history.
//
// Every `context-edited` event is a patch to save, but not every one is an
// action to undo. A rich text editor on the page saves what the user typed
// about once a second, and records the typing itself, step by step, with
// `context-history-record`. Its saves must reach the server without also
// landing on the undo stack, or one keystroke would be undone twice.
//
// An editor wraps the code that emits such a save in `autosave()`. The chain
// from there to the context bar is synchronous, so the context bar can ask
// `isAutosaving()` while it handles the event.

let depth = 0;

export function autosave(fn) {
  depth++;
  try {
    return fn();
  } finally {
    depth--;
  }
}

export function isAutosaving() {
  return depth > 0;
}

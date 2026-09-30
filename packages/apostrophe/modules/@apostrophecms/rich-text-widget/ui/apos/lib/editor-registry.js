// The rich text editors currently live on the page, for the benefit of the
// context bar's undo history, which has to reach into an editor to reverse
// typing in it.
//
// Keyed by an id unique to each editor instance. `target` says what the
// editor edits (the `@id.content` of a widget, or the patch key of a field),
// so that an editor recreated after a refresh, or after the widget was
// removed and restored, can be found again.
//
// A plain Map, deliberately outside any store: a reactive wrapper would proxy
// the tiptap editor, which does not survive being proxied.

const editors = new Map();

export function register(instanceKey, api) {
  editors.set(instanceKey, api);
}

export function unregister(instanceKey) {
  editors.delete(instanceKey);
}

// The editor that recorded the history if it is still here, otherwise any
// editor now editing the same thing
export function find(instanceKey, target) {
  const editor = editors.get(instanceKey);
  if (editor) {
    return editor;
  }
  for (const candidate of editors.values()) {
    if (candidate.target === target) {
      return candidate;
    }
  }
  return null;
}

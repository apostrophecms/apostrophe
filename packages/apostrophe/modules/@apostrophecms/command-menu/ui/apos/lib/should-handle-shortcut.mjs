// Returns false when a shortcut must not be seized, so the browser
// (or another listener) can handle it instead.
export function shouldHandleShortcut(action, { modalStackLength = 0 } = {}) {
  if (action.skipInModal && modalStackLength > 0) {
    return false;
  }
  return true;
}

// The browser tab's id. Session storage keeps it across reloads and
// navigation, since session storage belongs to one browser tab. Duplicating
// a browser tab copies its session storage, id included, so the page also
// stores a "loaded" marker holding the id while it is alive: set when the id
// is first read, removed on `pagehide`. A copy made while the original page
// is alive arrives with the marker set, and takes an id of its own.

import { createId } from 'apostrophe/lib/beneath.js';

const ID_KEY = 'aposTabId';
const LOADED_KEY = 'aposTabLoaded';

let tabId = null;

export function getTabId() {
  if (tabId) {
    return tabId;
  }
  const stored = sessionStorage.getItem(ID_KEY);
  const copied = Boolean(stored) && sessionStorage.getItem(LOADED_KEY) === stored;
  tabId = (stored && !copied) ? stored : createId();
  sessionStorage.setItem(ID_KEY, tabId);
  sessionStorage.setItem(LOADED_KEY, tabId);
  window.addEventListener('pagehide', () => {
    sessionStorage.removeItem(LOADED_KEY);
  });
  // A page restored from the back-forward cache is alive again
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      sessionStorage.setItem(LOADED_KEY, tabId);
    }
  });
  return tabId;
}

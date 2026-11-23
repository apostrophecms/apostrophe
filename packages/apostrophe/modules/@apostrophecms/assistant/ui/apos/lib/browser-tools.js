// The browser half of browser tools: the registry of executors, and the
// assistant's own (see the server's lib/standard-browser-tools.js, which
// checks each call and hands its arguments here).
//
// An executor is `async (args, { screen, request, ask, release, stopped })
// => result`: `args` as the server's tool prepared them, `screen` as the
// editor sees it now, `request` and `ask` the records being answered, and
// `stopped()` whether the editor stopped the request since: an executor
// that waits checks it before it acts again. It acts on the live
// page and returns `{ executed, reason?, ...its own fields }`; `null` leaves
// the ask to the page that loads next. Executors act one at a time: one that
// is done acting and only waits on the editor (to close an editor it
// opened, say) calls `release(status)` first, so the next one may act, and
// the chat reads `status`, an i18n key, meanwhile. Executors wait on the
// page's own state, bounded, never on time passing.

import { watch } from 'vue';
import { pinia } from 'Modules/@apostrophecms/ui/lib/vue';
import { getTabId } from 'Modules/@apostrophecms/ui/utils';
import { isWindow, getScreenWindow } from 'Modules/@apostrophecms/ui/composables/useScreen.js';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';
import { liftToCommonParent } from 'Modules/@apostrophecms/area/lib/widget-selection.js';
import {
  widgetElement,
  widgetContext,
  parentWidgetId,
  isLayoutColumn
} from 'Modules/@apostrophecms/area/lib/widget-selection-dom.js';

// How long the page may take to show what an executor waits for
const WAIT_LIMIT = 10000;
const STOPPED = {
  executed: false,
  reason: 'the user stopped the request'
};
// The navigation in flight, in this browser tab: the page that loads next
// answers it
const NAVIGATION_KEY = 'aposAssistantNavigation';
// The keys an `edit_open_document` call left busy for the later calls of its
// turn: `{ requestId, outside, keys }`
let held = null;

// The executors by browser tool name, the assistant's own in it from the
// moment this module is evaluated: nothing here depends on the order
// scripts load or apps run in. Last registration wins
const executors = new Map([
  [ 'read_screen', readScreen ],
  [ 'navigate', navigate ],
  [ 'open_editor', openEditor ],
  [ 'show_widgets', showWidgets ],
  [ 'edit_open_document', editOpenDocument ]
]);

export const browserTools = {
  /**
   * @param {string} name The browser tool's name on the server.
   * @param {Function} executor
   */
  add(name, executor) {
    executors.set(name, executor);
  },
  get(name) {
    return executors.get(name) || null;
  }
};

function readScreen() {
  return { executed: true };
}

// A page that unloads answers nothing: `null` leaves the ask to the page
// that loads next, which finds the marker. Arrived, it answers; landed
// elsewhere (a redirect), it says so instead of going again
function navigate({ url }, { ask }) {
  const target = new URL(url, window.location.href);
  const marker = readNavigation();
  clearNavigation();
  if (target.origin !== window.location.origin) {
    return {
      executed: false,
      reason: 'the address is on another site'
    };
  }
  if (isCurrentPage(target)) {
    return { executed: true };
  }
  if (marker?.callId === ask.callId) {
    return {
      executed: false,
      reason: `the browser went to ${target.pathname} and landed on ${window.location.pathname}`
    };
  }
  writeNavigation({
    callId: ask.callId,
    panel: isPanelOpen()
  });
  window.location.assign(target.href);
  return null;
}

async function openEditor({
  _id, type, widgetId, until
}, { release }) {
  if (widgetId) {
    return openWidgetEditor({
      _id,
      widgetId,
      until
    }, release);
  }
  const standalone = useModalStore(pinia).getStandaloneEditor(type);
  if (standalone) {
    return openStandaloneEditor({
      _id,
      until
    }, standalone, release);
  }
  const opened = await open(
    item => item.props?.docId === _id,
    () => apos.doc.edit({
      type,
      _id
    })
  );
  return finish(opened, until, release);
}

// Edit mode, then the widgets the page holds selected by the multi-select
// rule (siblings in one area, else the area holding them all) and scrolled
// to, focus left where it is
async function showWidgets({ _id, widgetIds }) {
  if (!window.apos.adminBar?.contextId) {
    return {
      executed: false,
      reason: 'the page shown has no document to edit'
    };
  }
  if (!window.apos.adminBar.editMode &&
    !(await window.apos.adminBar.setEditMode?.(true))) {
    return {
      executed: false,
      reason: 'the page could not enter edit mode'
    };
  }
  const isHere = widgetId => isOfDocument(widgetElement(widgetId, document), _id);
  await waitFor(() => widgetIds.every(isHere));
  const present = widgetIds.filter(isHere);
  if (!present.length) {
    return {
      executed: false,
      reason: 'the widgets are not on the page shown'
    };
  }
  const selected = liftToCommonParent(present, {
    parentOf: id => parentWidgetId(id, document),
    areaOf: id => widgetContext(id, document),
    isColumn: id => isLayoutColumn(id, document)
  });
  if (!selected?.length) {
    return {
      executed: false,
      reason: 'the widgets have no area in common; show them one group at a time'
    };
  }
  const store = useWidgetStore(pinia);
  const primaryId = selected.at(-1);
  store.setWidgetSelection({
    selectedWidgetIds: selected,
    selectionAnchorId: primaryId,
    pinnedWidgetIds: [ ...selected ]
  }, {
    primaryId,
    areaId: widgetContext(primaryId, document)?.areaId || null,
    graphKey: window.apos.adminBar.contextId,
    scope: document
  });
  const first = widgetElement(selected[0], document);
  if (!store.isElementInView(first)) {
    store.scrollToElement(first);
  }
  return {
    executed: true,
    selected
  };
}

// What the editor on top holds, read or changed: the server reads it or
// builds the change on it, and the change lands through the editor's
// `outside` handle, the keys it names busy meanwhile, then marked. The keys
// of the turn's later calls (`ahead` on the ask) go busy with them and stay
// busy for those calls. With no modal open, the editor on top is the
// screen's window
async function editOpenDocument(args, {
  request, ask, stopped
}) {
  const store = useModalStore(pinia);
  const entry = store.stack.filter(entry => !isWindow(entry)).at(-1) ||
    getScreenWindow(store);
  const outside = entry?.outside;
  if (!outside) {
    releaseAhead();
    return {
      executed: false,
      reason: 'no editor is on top of the screen'
    };
  }
  const root = outside.read();
  if (!root) {
    releaseAhead();
    return {
      executed: false,
      reason: 'the editor is still loading'
    };
  }
  const keys = getArgumentKeys(args);
  const ahead = (ask.payload.ahead || []).filter(key => !keys.includes(key));
  if ((held?.outside !== outside) || (held.requestId !== request._id)) {
    releaseAhead();
  } else {
    outside.release(held.keys.filter(key => !keys.includes(key) && !ahead.includes(key)));
  }
  if (stopped()) {
    releaseAhead();
    return STOPPED;
  }
  const busy = outside.busy([ ...keys, ...ahead ]);
  try {
    const change = await apos.http.post(
      `${apos.modules['@apostrophecms/assistant'].action}/chat/${request.chatId}/open-editor`,
      {
        body: {
          tabId: getTabId(),
          callId: ask.callId,
          root
        }
      }
    );
    const names = Object.keys(change.values || {});
    if (!change.executed || !names.length) {
      return change.executed
        ? { executed: true }
        : change;
    }
    // A change computed before the stop is not applied
    if (stopped()) {
      return STOPPED;
    }
    // Every field the change reaches takes it, or none does
    const taken = outside.busy(names);
    if (taken.length < names.length) {
      return {
        executed: false,
        reason: `the editor can't take ${
          names.filter(name => !taken.includes(name)).join(', ')
        } now`
      };
    }
    const { refused } = await outside.apply(change.values, {
      marker: { requestId: request._id },
      touched: change.touched,
      removed: change.removed
    });
    return refused.length
      ? {
        executed: false,
        reason: `the editor did not take ${refused.map(({ name }) => name).join(', ')}`
      }
      : { executed: true };
  } catch (e) {
    report(e);
    return {
      executed: false,
      reason: e.body?.message || 'the editor\'s content could not be read'
    };
  } finally {
    outside.release(busy.filter(key => !ahead.includes(key)));
    // Applying frees what was busy in the fields it wrote
    const kept = outside.busy(busy.filter(key => ahead.includes(key)));
    held = kept.length
      ? {
        requestId: request._id,
        outside,
        keys: kept
      }
      : null;
  }
}

// The keys a call names, relative to the editor's root: the keys of its
// values, its area, the widgets it names by id. A read names none
function getArgumentKeys({
  values, area, widgets
}) {
  return [
    ...Object.keys(values || {}),
    ...(area ? [ area ] : []),
    ...(widgets || [])
      .filter(widget => typeof widget === 'string')
      .map(_id => `@${_id}`)
  ];
}

/**
 * Frees the keys kept busy for the later calls of a request's turn, those
 * of any request when `requestId` is not given. The request that ends
 * frees what its calls did not reach.
 *
 * @param {string} [requestId]
 */
export function releaseAhead(requestId) {
  if (held && (!requestId || (held.requestId === requestId))) {
    held.outside.release(held.keys);
    held = null;
  }
}

/**
 * Resolves `true` once `check()` holds, checked again on every change to
 * the page and to the reactive state it reads, or `false` after `limit`
 * milliseconds.
 *
 * @param {() => boolean} check
 * @param {number} [limit]
 * @returns {Promise<boolean>}
 */
function waitFor(check, limit = WAIT_LIMIT) {
  if (check()) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const recheck = () => {
      if (check()) {
        done(true);
      }
    };
    const observer = new MutationObserver(recheck);
    const stop = watch(check, recheck);
    const timer = setTimeout(() => done(false), limit);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
    function done(value) {
      observer.disconnect();
      stop();
      clearTimeout(timer);
      resolve(value);
    }
  });
}

export function readNavigation() {
  try {
    return JSON.parse(window.sessionStorage.getItem(NAVIGATION_KEY));
  } catch (e) {
    return null;
  }
}

function writeNavigation(marker) {
  try {
    window.sessionStorage.setItem(NAVIGATION_KEY, JSON.stringify(marker));
  } catch (e) {
    // Without storage the next page goes again only if a redirect keeps
    // it away
  }
}

function clearNavigation() {
  try {
    window.sessionStorage.removeItem(NAVIGATION_KEY);
  } catch (e) {
    // Nothing was stored
  }
}

function isCurrentPage(target) {
  return (target.pathname === window.location.pathname) &&
    (target.search === window.location.search);
}

function isPanelOpen() {
  return useModalStore(pinia).stack.some(item => item.componentName === 'AposAssistant');
}

// A widget of the document, rendered on the page: its area names the
// document, in any of its modes and locales
function isOfDocument(el, _id) {
  const docId = el?.closest('[data-doc-id]')?.getAttribute('data-doc-id');
  return Boolean(docId) && (docId.split(':')[0] === _id.split(':')[0]);
}

// The widget selected alone, then its editor opened by its area
async function openWidgetEditor({
  _id, widgetId, until
}, release) {
  const shown = await showWidgets({
    _id,
    widgetIds: [ widgetId ]
  });
  if (!shown.executed) {
    return shown;
  }
  if (shown.selected[0] !== widgetId) {
    return {
      executed: false,
      reason: 'the widget is not on the page shown'
    };
  }
  const type = widgetElement(widgetId, document).getAttribute('data-apos-widget-type');
  if (window.apos.area.widgetIsContextual?.[type]) {
    return {
      executed: false,
      reason: 'this widget is edited on the page itself and has no editor; it is selected'
    };
  }
  const opened = await open(
    item => item.props?.modelValue?._id === widgetId,
    () => apos.bus.$emit('widget-edit', { widgetId })
  );
  return finish(opened, until, release);
}

// A document type edited in a window of its own, outside the modal stack:
// opened through what the type registered, answered once the window is on
// the screen, or with `until: 'closed'` once it closes, saying whether it
// was saved
async function openStandaloneEditor({ _id, until }, open, release) {
  const store = useModalStore(pinia);
  const { id, reason } = (await open({ _id })) || {};
  const shown = () => store.standaloneWindows.some(entry => entry.id === id);
  if (!id || !(await waitFor(shown))) {
    return {
      executed: false,
      reason: reason || 'the editor did not open'
    };
  }
  if (until !== 'closed') {
    return { executed: true };
  }
  release('apostrophe:assistantWaitingEditor');
  const result = await new Promise((resolve) => {
    const onClosed = (closed) => {
      if (closed.id === id) {
        apos.bus.$off('standalone-window-closed', onClosed);
        resolve(closed.result);
      }
    };
    apos.bus.$on('standalone-window-closed', onClosed);
  });
  return {
    executed: true,
    saved: Boolean(result)
  };
}

// Opens a modal with `launch` and resolves the stack item `match` picks
// once its modal is on the page, else `null`
async function open(match, launch) {
  let item = null;
  const onLaunched = (launched) => {
    if (!item && match(launched)) {
      item = launched;
    }
  };
  apos.bus.$on('modal-launched', onLaunched);
  try {
    // What the modal resolves comes with `modal-resolved` (see `finish`)
    Promise.resolve(launch()).catch(report);
    const store = useModalStore(pinia);
    const mounted = () => Boolean(item && store.get(item.id)?.modalEl);
    return (await waitFor(mounted)) ? store.get(item.id) : null;
  } finally {
    apos.bus.$off('modal-launched', onLaunched);
  }
}

function report(e) {
  // eslint-disable-next-line no-console
  console.error(e);
}

// Answers once the modal is open, or with `until: 'closed'` once it is
// closed, saying whether it was saved
async function finish(item, until, release) {
  if (!item) {
    return {
      executed: false,
      reason: 'the editor did not open'
    };
  }
  if (until !== 'closed') {
    return { executed: true };
  }
  release('apostrophe:assistantWaitingEditor');
  const result = await new Promise((resolve) => {
    const onResolved = (modal) => {
      if (modal.id === item.id) {
        apos.bus.$off('modal-resolved', onResolved);
        resolve(modal.result);
      }
    };
    apos.bus.$on('modal-resolved', onResolved);
  });
  return {
    executed: true,
    saved: Boolean(result)
  };
}

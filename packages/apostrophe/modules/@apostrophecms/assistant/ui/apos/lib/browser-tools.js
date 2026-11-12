// The browser half of browser tools: the registry of executors, and the
// assistant's own (see the server's lib/standard-browser-tools.js, which
// checks each call and hands its arguments here).
//
// An executor is `async (args, { screen, request, ask }) => result`: `args`
// as the server's tool prepared them, `screen` as the editor sees it now,
// `request` and `ask` the records being answered. It acts on the live page
// and returns `{ executed, reason?, ...its own fields }`; `null` leaves the
// ask to the page that loads next. Executors wait on the page's own state,
// bounded, never on time passing.

import { watch } from 'vue';
import { pinia } from 'Modules/@apostrophecms/ui/lib/vue';
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
// The navigation in flight, in this browser tab: the page that loads next
// answers it
const NAVIGATION_KEY = 'aposAssistantNavigation';

// The executors by browser tool name, the assistant's own in it from the
// moment this module is evaluated: nothing here depends on the order
// scripts load or apps run in. Last registration wins
const executors = new Map([
  [ 'read_screen', readScreen ],
  [ 'navigate', navigate ],
  [ 'open_editor', openEditor ],
  [ 'show_widgets', showWidgets ]
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
}) {
  if (widgetId) {
    return openWidgetEditor({
      _id,
      widgetId,
      until
    });
  }
  const opened = await open(
    item => item.props?.docId === _id,
    () => apos.doc.edit({
      type,
      _id
    })
  );
  return finish(opened, until);
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
}) {
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
  return finish(opened, until);
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
async function finish(item, until) {
  if (!item) {
    return {
      executed: false,
      reason: 'the editor did not open'
    };
  }
  if (until !== 'closed') {
    return { executed: true };
  }
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

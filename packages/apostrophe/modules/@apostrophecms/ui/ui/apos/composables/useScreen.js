// What the editor is looking at: the page and its document, the modals open
// over it from bottom to top, the widgets selected and the field being
// edited inline. Ids, types and names only, never a document's content.
//
// Each modal reports its own part, its kind included, through `AposModal`'s
// `screen` prop, since only the modal knows what it is and where it holds
// its ids; a modal that reports nothing is `other`. A widget or array editor
// that names no document works on the document of the editor below it.
// Windows are not modals of the screen: they sit beside what the editor is
// looking at.
//
// `getScreen()` reads it when it is needed, as part of it lives outside any
// reactive store (the admin bar's context).

import { useModalStore } from '../stores/modal';
import { useWidgetStore } from '../stores/widget';
import { getTabId } from '../utils';

const KEYS = [ 'docId', 'docType', 'widgetId', 'field', 'itemId', 'selection', 'filters' ];
// Kinds that edit part of a document they are never told about
const NESTED_KINDS = [ 'widgetEditor', 'arrayEditor' ];
const MANAGER_KINDS = [ 'manager', 'pageTree', 'mediaManager', 'recentlyEdited', 'chooser' ];

export function useScreen() {
  const modalStore = useModalStore();
  const widgetStore = useWidgetStore();

  return { getScreen };

  function getScreen() {
    const adminBar = window.apos.adminBar;
    const context = adminBar?.context;
    const entries = modalStore.stack.filter(entry => !isWindow(entry));
    const modals = getModals(entries);
    return {
      tabId: getTabId(),
      visible: document.visibilityState !== 'hidden',
      url: `${window.location.pathname}${window.location.search}`,
      locale: modalStore.getActiveLocale(),
      mode: context?.aposMode || null,
      editing: adminBar?.editMode === true,
      view: getView(modals, adminBar),
      document: context?._id
        ? {
          _id: context._id,
          type: context.type,
          title: context.title
        }
        : null,
      modals,
      selection: getSelection(entries, modals),
      field: getField(modals)
    };
  }

  function getModals(entries) {
    let owner = null;
    return entries.map(entry => {
      const kind = entry.screen?.kind || 'other';
      const modal = { kind };
      for (const key of KEYS) {
        const value = entry.screen?.[key];
        if ((value !== null) && (value !== undefined)) {
          modal[key] = value;
        }
      }
      if (!modal.docId && owner && NESTED_KINDS.includes(kind)) {
        modal.docId = owner.docId;
        modal.docType = owner.docType;
      }
      if (modal.docId) {
        owner = modal;
      }
      return modal;
    });
  }

  // A manager or the versions in front, else the page, in See Changes or not
  function getView(modals, adminBar) {
    const top = modals.at(-1);
    if (MANAGER_KINDS.includes(top?.kind)) {
      return 'manager';
    }
    if (top?.kind === 'versions') {
      return 'versions';
    }
    return (adminBar?.seeChanges === true) ? 'seeChanges' : 'page';
  }

  // The selected widgets, siblings in one area. Their document is the
  // modal's they were selected in, else the one the page area names. The
  // area itself is named by the server from the document: the store's
  // `focusedArea` is the area editor's own id, not the area's
  function getSelection(entries, modals) {
    const widgetIds = [ ...widgetStore.selectedWidgetIds ];
    const editorId = widgetStore.focusedArea;
    if (!widgetIds.length || !editorId) {
      return null;
    }
    const areaEl = document.querySelector(`[data-apos-area="${CSS.escape(editorId)}"]`);
    const modalEl = areaEl?.closest('[data-apos-modal]');
    const docId = modalEl
      ? modals[entries.findIndex(entry => entry.modalEl === modalEl)]?.docId
      : areaEl?.closest('[data-doc-id]')?.getAttribute('data-doc-id');
    return docId
      ? {
        docId,
        widgetIds
      }
      : null;
  }

  // The field edited inline. In a modal it names no document: it is the
  // topmost modal's
  function getField(modals) {
    const target = widgetStore.focusedField && widgetStore.focusedFieldTarget;
    if (!target?.name) {
      return null;
    }
    const docId = target.docId || modals.findLast(modal => modal.docId)?.docId;
    return docId
      ? {
        docId,
        name: target.name
      }
      : null;
  }
}

function isWindow(entry) {
  return (entry.stacking === 'top') || (entry.overlay === 'none');
}

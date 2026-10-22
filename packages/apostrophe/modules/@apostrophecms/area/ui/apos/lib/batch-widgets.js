import { nextTick } from 'vue';
import { pinia } from 'Modules/@apostrophecms/ui/lib/vue';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';
import { outermostIds, selectionWithout } from './widget-selection.js';
import { widgetContext, widgetElement } from './widget-selection-dom.js';

// One batch edit, coordinated from the toolbar or a keyboard shortcut.
// Area editors answer `widget-selection-collect` with the selected widgets
// they own, then `widget-selection-mutate` for the change itself. Copy and
// cut write the clipboard here so each editor does not overwrite the others.
export function runWidgetBatch(name, { hasAncestor } = {}) {
  const bag = { entries: [] };
  apos.bus.$emit('widget-selection-collect', bag);
  const ids = bag.entries.map((entry) => entry.widget._id);
  const kept = new Set(outermostIds(ids, (id, ancestorId) => {
    return hasAncestor ? hasAncestor(id, ancestorId) : false;
  }));
  const scope = useWidgetStore(pinia).selectionScope || document;
  const entries = bag.entries
    .filter((entry) => kept.has(entry.widget._id))
    .sort((a, b) => byDocumentOrder(a, b, scope));
  if (!entries.length) {
    return;
  }
  const entryIds = entries.map((entry) => entry.widget._id);
  if (name === 'copy' || name === 'cut') {
    apos.area.widgetClipboard.setMany(entries.map((entry) => entry.widget));
    notifyClipboard(name, entries.length);
    if (name === 'cut') {
      removeSelection(entryIds, hasAncestor);
    }
    return;
  }
  if (name === 'remove') {
    removeSelection(entryIds, hasAncestor);
    return;
  }
  if (name === 'clone') {
    duplicateSelection(entryIds);
    return;
  }
  apos.bus.$emit('widget-selection-mutate', {
    name,
    ids: entryIds
  });
  useWidgetStore(pinia).bumpSelectionRevision();
}

// The area that holds the selection hands back its edit rather than
// reporting it, so the history entry can also say what to select when it
// is undone (`selection.undo`) or redone (`selection.redo`).
function report([ edit ], selection) {
  if (edit) {
    apos.bus.$emit('context-edited', {
      ...edit,
      target: {
        ...edit.target,
        selection
      }
    });
  }
}

// Undo puts the whole selection back, not just the first widget.
function removeSelection(ids, hasAncestor) {
  const changes = [];
  apos.bus.$emit('widget-selection-mutate', {
    name: 'remove',
    ids,
    changes
  });
  report(changes, { undo: ids });
  dropRemoved(ids, hasAncestor);
}

// The copies become the selection. Undo selects the originals again, and
// redo the copies.
async function duplicateSelection(ids) {
  const changes = [];
  const clones = [];
  apos.bus.$emit('widget-selection-mutate', {
    name: 'clone',
    ids,
    changes,
    clones
  });
  report(changes, {
    undo: ids,
    redo: clones
  });
  if (!clones.length) {
    return;
  }
  const store = useWidgetStore(pinia);
  const scope = store.selectionScope || document;
  await nextTick();
  const primaryId = clones[clones.length - 1];
  store.setWidgetSelection({
    selectedWidgetIds: clones,
    selectionAnchorId: clones[0],
    pinnedWidgetIds: [ ...clones ]
  }, {
    primaryId,
    areaId: widgetContext(primaryId, scope)?.areaId || store.focusedArea,
    graphKey: store.selectionGraphKey,
    scope
  });
}

export function notifyClipboard(name, count) {
  apos.notify(
    name === 'cut'
      ? 'apostrophe:widgetsCutToClipboard'
      : 'apostrophe:widgetsCopiedToClipboard',
    {
      type: 'success',
      icon: name === 'cut' ? 'content-cut-icon' : 'content-copy-icon',
      dismiss: true,
      interpolate: {
        count
      }
    }
  );
}

function dropRemoved(removedIds, hasAncestor) {
  const store = useWidgetStore(pinia);
  const next = selectionWithout(
    {
      selectedWidgetIds: store.selectedWidgetIds,
      selectionAnchorId: store.selectionAnchorId,
      pinnedWidgetIds: store.pinnedWidgetIds
    },
    removedIds,
    (id) => {
      return removedIds.some((ancestorId) => {
        return hasAncestor ? hasAncestor(id, ancestorId) : false;
      });
    }
  );
  if (!next.selectedWidgetIds.length) {
    store.setFocusedWidget(null, null);
    return;
  }
  const primaryId = next.selectedWidgetIds.includes(store.focusedWidget)
    ? store.focusedWidget
    : next.selectedWidgetIds[next.selectedWidgetIds.length - 1];
  store.setWidgetSelection(next, {
    primaryId,
    areaId: widgetContext(primaryId, store.selectionScope || document)?.areaId ||
      store.focusedArea,
    graphKey: store.selectionGraphKey
  });
}

function byDocumentOrder(a, b, scope) {
  if (typeof document === 'undefined') {
    return a.index - b.index;
  }
  const aEl = widgetElement(a.widget._id, scope);
  const bEl = widgetElement(b.widget._id, scope);
  if (!aEl || !bEl || aEl === bEl) {
    return a.index - b.index;
  }
  const position = aEl.compareDocumentPosition(bEl);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }
  return 0;
}

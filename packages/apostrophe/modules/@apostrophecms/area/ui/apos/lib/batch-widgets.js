import { pinia } from 'Modules/@apostrophecms/ui/lib/vue';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget';
import {
  combineContextEdits, outermostIds, selectionWithout
} from './widget-selection.js';
import { widgetContext, widgetSelector } from './widget-selection-dom.js';

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
  const entries = bag.entries
    .filter((entry) => kept.has(entry.widget._id))
    .sort(byDocumentOrder);
  if (!entries.length) {
    return;
  }
  const entryIds = entries.map((entry) => entry.widget._id);
  if (name === 'copy' || name === 'cut') {
    apos.area.widgetClipboard.setMany(entries.map((entry) => entry.widget));
    apos.notify(
      name === 'cut' ? 'Widgets cut to clipboard' : 'Widgets copied to clipboard',
      {
        type: 'success',
        icon: name === 'cut' ? 'content-cut-icon' : 'content-copy-icon',
        dismiss: true
      }
    );
    if (name === 'cut') {
      removeSelection(entryIds, hasAncestor);
    }
    return;
  }
  if (name === 'remove') {
    removeSelection(entryIds, hasAncestor);
    return;
  }
  apos.bus.$emit('widget-selection-mutate', {
    name,
    ids: entryIds
  });
  useWidgetStore(pinia).bumpSelectionRevision();
}

// One history entry for every area the removal touched, so Undo puts a
// widget back in each column of a layout with a single command. Each area
// still updates its own items; only the recorded edit is shared.
function removeSelection(ids, hasAncestor) {
  const changes = [];
  apos.bus.$emit('widget-selection-mutate', {
    name: 'remove',
    ids,
    changes
  });
  const edit = combineContextEdits(changes);
  if (edit) {
    apos.bus.$emit('context-edited', edit);
  }
  dropRemoved(ids, hasAncestor);
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
    areaId: widgetContext(primaryId)?.areaId || store.focusedArea,
    graphKey: store.selectionGraphKey
  });
}

function byDocumentOrder(a, b) {
  if (typeof document === 'undefined') {
    return a.index - b.index;
  }
  const aEl = document.querySelector(widgetSelector(a.widget._id));
  const bEl = document.querySelector(widgetSelector(b.widget._id));
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

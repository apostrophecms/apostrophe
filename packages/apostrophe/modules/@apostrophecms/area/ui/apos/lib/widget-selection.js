// Finder-style widget selection, with no DOM and no Vue. A plain click
// replaces the selection. Meta-click or ctrl-click toggles one widget.
// Shift-click selects the siblings between the anchor and the target in
// one area, and leaves pinned widgets that live in other areas alone.

export function emptySelection() {
  return {
    selectedWidgetIds: [],
    selectionAnchorId: null,
    pinnedWidgetIds: []
  };
}

export function selectionGesture(event) {
  if (!event) {
    return 'plain';
  }
  if (event.metaKey || event.ctrlKey) {
    return 'toggle';
  }
  if (event.shiftKey) {
    return 'range';
  }
  return 'plain';
}

export function applyWidgetSelection({
  state = emptySelection(),
  gesture = 'plain',
  widgetId = null,
  areaId = null,
  anchorAreaId = null,
  areaItemIds = []
} = {}) {
  if (!widgetId) {
    return emptySelection();
  }
  if (gesture === 'toggle') {
    return toggleWidget(state, widgetId);
  }
  if (
    gesture === 'range' &&
    state.selectionAnchorId &&
    areaId &&
    areaId === anchorAreaId
  ) {
    return rangeInArea(state, widgetId, areaItemIds);
  }
  return replaceSelection(widgetId);
}

// Drop removed widgets, and anything isDescendant says was inside one of
// them. The parent already contains those children.
export function selectionWithout(state, removedIds = [], isDescendant = null) {
  const removed = new Set(removedIds);
  const keep = (id) => {
    if (removed.has(id)) {
      return false;
    }
    return !(isDescendant && isDescendant(id));
  };
  const selectedWidgetIds = state.selectedWidgetIds.filter(keep);
  const pinnedWidgetIds = state.pinnedWidgetIds.filter(keep);
  const selectionAnchorId = selectedWidgetIds.includes(state.selectionAnchorId)
    ? state.selectionAnchorId
    : (selectedWidgetIds[selectedWidgetIds.length - 1] || null);
  return {
    selectedWidgetIds,
    selectionAnchorId,
    pinnedWidgetIds
  };
}

// `isAncestor(id, ancestorId)` is true when ancestorId contains id.
export function outermostIds(ids, isAncestor) {
  return ids.filter((id) => {
    return !ids.some((other) => {
      return other !== id && isAncestor(id, other);
    });
  });
}

// Indexes of `selectedIds` in `areaItemIds` when they are one contiguous
// run of that area, otherwise null.
export function contiguousRange(areaItemIds, selectedIds) {
  if (!selectedIds.length) {
    return null;
  }
  const indexes = selectedIds
    .map((id) => areaItemIds.indexOf(id))
    .sort((a, b) => a - b);
  if (indexes.some((index) => index === -1)) {
    return null;
  }
  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] !== indexes[i - 1] + 1) {
      return null;
    }
  }
  return {
    first: indexes[0],
    last: indexes[indexes.length - 1]
  };
}

// Operations offered for a multi-selection: on the allowlist, present on
// every selected widget, and not a modal. `modal` operations stay off this
// toolbar until a batch strategy exists.
// Several areas each report their own patch. Undo is one step when those
// patches are one edit: `$pullAllById` and `$push` already take one entry
// per area.
export function combineContextEdits(edits) {
  const list = (edits || []).filter((edit) => edit?.patch);
  if (!list.length) {
    return null;
  }
  if (list.length === 1) {
    return list[0];
  }
  return {
    patch: mergePatchOperators(list.map((edit) => edit.patch)),
    inverse: mergePatchOperators(list.map((edit) => edit.inverse)),
    target: list[0].target
  };
}

function mergePatchOperators(patches) {
  const merged = {};
  for (const patch of patches) {
    if (!patch) {
      continue;
    }
    for (const [ key, value ] of Object.entries(patch)) {
      if (
        key.startsWith('$') &&
        value &&
        (typeof value === 'object') &&
        !Array.isArray(value)
      ) {
        merged[key] = {
          ...merged[key],
          ...value
        };
      } else {
        merged[key] = value;
      }
    }
  }
  return merged;
}

export function commonBatchOperations(operationLists, allowlist) {
  if (!operationLists.length) {
    return [];
  }
  return allowlist.map((name) => {
    const matches = operationLists.map((list) => {
      return (list || []).find((operation) => {
        return operation.nativeAction === name || operation.name === name;
      });
    });
    if (matches.some((operation) => !operation || operation.modal)) {
      return null;
    }
    return matches[0];
  }).filter(Boolean);
}

function replaceSelection(widgetId) {
  return {
    selectedWidgetIds: [ widgetId ],
    selectionAnchorId: widgetId,
    pinnedWidgetIds: [ widgetId ]
  };
}

function toggleWidget(state, widgetId) {
  const removing = state.selectedWidgetIds.includes(widgetId);
  const selectedWidgetIds = removing
    ? state.selectedWidgetIds.filter((id) => id !== widgetId)
    : [ ...state.selectedWidgetIds, widgetId ];
  // Turning a widget off leaves the anchor on a widget that is still
  // selected. The store keeps the same rule, so a following shift-click
  // ranges from something the user can still see.
  const selectionAnchorId = !selectedWidgetIds.length
    ? null
    : (removing ? selectedWidgetIds[selectedWidgetIds.length - 1] : widgetId);
  return {
    selectedWidgetIds,
    selectionAnchorId,
    pinnedWidgetIds: [ ...selectedWidgetIds ]
  };
}

function rangeInArea(state, widgetId, areaItemIds) {
  const anchorIndex = areaItemIds.indexOf(state.selectionAnchorId);
  const targetIndex = areaItemIds.indexOf(widgetId);
  if (anchorIndex === -1 || targetIndex === -1) {
    return replaceSelection(widgetId);
  }
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  const range = areaItemIds.slice(start, end + 1);
  const inArea = new Set(areaItemIds);
  const outside = state.pinnedWidgetIds.filter((id) => !inArea.has(id));
  return {
    selectedWidgetIds: unique([ ...outside, ...range ]),
    selectionAnchorId: state.selectionAnchorId,
    pinnedWidgetIds: [ ...state.pinnedWidgetIds ]
  };
}

// A meta-drag adds the widgets inside the rectangle. Ids already selected
// stay selected. A drag whose rectangle hits a single widget selects that
// widget, even when the layout around it also overlaps the rectangle.
// When the rectangle hits more than one widget, an ancestor wins over the
// widgets inside it, walking up until the outermost selected widget
// remains. The anchor is the last captured widget that is still selected,
// and the pins become the whole set.
export function addCapturedWidgets(
  state = emptySelection(),
  ids = [],
  { parentOf } = {}
) {
  const captured = unique((ids || []).filter(Boolean));
  const selectedWidgetIds = [ ...(state?.selectedWidgetIds || []) ];
  const pinnedWidgetIds = [ ...(state?.pinnedWidgetIds || []) ];
  if (!captured.length) {
    return {
      selectedWidgetIds,
      selectionAnchorId: state?.selectionAnchorId ?? null,
      pinnedWidgetIds
    };
  }
  const leaves = leavesOf(captured, parentOf);
  const single = leaves.length === 1;
  const chosen = single ? leaves : keepOutermost(captured, parentOf);
  const merged = unique([ ...selectedWidgetIds, ...chosen ]);
  const nextIds = single
    ? preferWidget(merged, leaves[0], parentOf)
    : keepOutermost(merged, parentOf);
  const surviving = chosen.filter((id) => nextIds.includes(id));
  return {
    selectedWidgetIds: nextIds,
    selectionAnchorId: surviving.length
      ? surviving[surviving.length - 1]
      : (state?.selectionAnchorId ?? null),
    pinnedWidgetIds: [ ...nextIds ]
  };
}

// Captured widgets that do not contain another captured widget.
function leavesOf(ids, parentOf) {
  if (typeof parentOf !== 'function') {
    return ids;
  }
  return ids.filter((id) => {
    return !ids.some((other) => {
      return other !== id && isAncestor(id, other, parentOf);
    });
  });
}

// Keep `widget` and drop anything above or inside it, so a one-widget drag
// is that widget rather than the layout that contains it.
function preferWidget(ids, widget, parentOf) {
  if (typeof parentOf !== 'function') {
    return ids;
  }
  return ids.filter((id) => {
    if (id === widget) {
      return true;
    }
    return !isAncestor(id, widget, parentOf) &&
      !isAncestor(widget, id, parentOf);
  });
}

function isAncestor(ancestorId, id, parentOf) {
  const seen = new Set([ id ]);
  let parent = parentOf(id);
  while (parent && !seen.has(parent)) {
    if (parent === ancestorId) {
      return true;
    }
    seen.add(parent);
    parent = parentOf(parent);
  }
  return false;
}

// Drop a widget when an ancestor is also selected. `parentOf` returns the
// parent widget id, or null at the top of the tree.
export function keepOutermost(ids, parentOf) {
  if (typeof parentOf !== 'function') {
    return ids;
  }
  const selected = new Set(ids);
  return ids.filter((id) => {
    const seen = new Set([ id ]);
    let parent = parentOf(id);
    while (parent && !seen.has(parent)) {
      if (selected.has(parent)) {
        return false;
      }
      seen.add(parent);
      parent = parentOf(parent);
    }
    return true;
  });
}

function unique(ids) {
  return [ ...new Set(ids) ];
}

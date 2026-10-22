// Finder-style widget selection, with no DOM and no Vue. A plain click
// replaces the selection. Meta-click or ctrl-click toggles one widget.
// Shift-click adds a widget to the selection held at the last click that
// was not a shift-click, then fills the gaps between siblings.
//
// Selected widgets are always siblings in one area, the one place a cut,
// paste or duplicate can put them. When a click reaches into another part
// of the tree, such as a column of a layout or the other area of a hero,
// the selection is lifted to the nearest common ancestor area: it becomes
// the widgets of that area that are, or contain, a selected widget.
//
// Widgets with no common ancestor area, such as a widget in the main area
// and one in the footer, cannot be selected together. A meta-click or
// shift-click that would combine them is ignored, and returns `state`
// itself.
//
// Layout columns are part of their layout, never selected on their own.
// When a selection would be made of columns, it is the layout instead.
//
// `parentOf(id)` returns the parent widget id, or null at the top of the
// tree. `areaOf(id)` returns `{ areaId, itemIds }` for the area that holds
// the widget, or null. `isColumn(id)` is true for a layout column. Without
// them every widget is treated as a selectable sibling.

export function emptySelection() {
  return {
    selectedWidgetIds: [],
    selectionAnchorId: null,
    pinnedWidgetIds: []
  };
}

// How far the pointer may move, in pixels, before a press is a drag
// rather than a click.
export const DRAG_THRESHOLD = 4;

export function isDrag(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return (dx * dx) + (dy * dy) > DRAG_THRESHOLD * DRAG_THRESHOLD;
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
  parentOf = null,
  areaOf = null,
  isColumn = null
} = {}) {
  if (!widgetId) {
    return emptySelection();
  }
  const tree = {
    parentOf,
    areaOf,
    isColumn
  };
  if (gesture === 'toggle') {
    return toggleWidget(state, widgetId, tree);
  }
  if (gesture === 'range' && state.pinnedWidgetIds.length) {
    return rangeTo(state, widgetId, tree);
  }
  return replaceSelection(widgetId);
}

// The widgets of the nearest common ancestor area of `ids` that are, or
// contain, one of `ids`. `removeId` is one of `ids` the user is turning
// off: its widget in the common area is dropped, unless another of `ids`
// outside the path to `removeId` also lives in that widget. Null when
// `ids` have no common ancestor area.
export function liftToCommonParent(ids, {
  parentOf = null,
  areaOf = null,
  isColumn = null,
  removeId = null
} = {}) {
  const list = unique(ids.filter(Boolean));
  if (typeof parentOf !== 'function') {
    return list.filter((id) => id !== removeId);
  }
  // From the top down, alternating: the area holding a widget, then the
  // widget, ending with the id itself.
  const paths = list.map((id) => {
    return pathOf(id, parentOf).flatMap((widgetId) => {
      return [ areaOf?.(widgetId)?.areaId ?? null, widgetId ];
    });
  });
  let shared = 0;
  while (paths.every((path) => {
    return path.length > shared && path[shared] === paths[0][shared];
  })) {
    shared++;
  }
  if (!shared) {
    return null;
  }
  // The last shared entry may be a widget, when one id holds another or
  // they sit in different areas of one widget. Either way the common
  // area is the one that holds it.
  let area = (shared - 1) - ((shared - 1) % 2);
  if (typeof isColumn === 'function') {
    while (area > 0 && paths.some((path) => isColumn(path[area + 1]))) {
      area -= 2;
    }
  }
  const children = paths.map((path) => path[area + 1]);
  if (!removeId) {
    return unique(children);
  }
  const removePath = paths[list.indexOf(removeId)];
  const removeChild = removePath[area + 1];
  const kept = paths.some((path, i) => {
    return children[i] === removeChild && !removePath.includes(list[i]);
  });
  return unique(children).filter((id) => kept || id !== removeChild);
}

// Fill the gaps between selected widgets, which share an area, so a
// shift-click selects everything between the widgets it spans.
export function fillGaps(ids, areaOf) {
  const itemIds = (ids.length && areaOf?.(ids[0])?.itemIds) || [];
  const indexes = ids.map((id) => itemIds.indexOf(id));
  if (!indexes.length || indexes.includes(-1)) {
    return ids;
  }
  return itemIds.slice(Math.min(...indexes), Math.max(...indexes) + 1);
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

// After an undo or redo. `widgetIds` are the widgets the edit selects in
// that direction: those on the page become the selection. Otherwise any
// selected widget the change took off the page is dropped.
// `isPresent(id)` is true for a widget on the page.
export function selectionAfterHistory(state, widgetIds = [], isPresent) {
  const restored = widgetIds.filter(isPresent);
  if (restored.length) {
    return {
      selectedWidgetIds: restored,
      selectionAnchorId: restored[0],
      pinnedWidgetIds: [ ...restored ]
    };
  }
  return selectionWithout(
    state,
    state.selectedWidgetIds.filter((id) => !isPresent(id))
  );
}

// `isAncestor(id, ancestorId)` is true when ancestorId contains id.
export function outermostIds(ids, isAncestor) {
  return ids.filter((id) => {
    return !ids.some((other) => {
      return other !== id && isAncestor(id, other);
    });
  });
}

// The `$push` operations that put widgets removed from `items` back where
// they were, one for each contiguous run of them. Each run is placed beside
// a neighbor that was not removed, so they can be applied in any order.
// `items` is the area as it was before the removal.
export function restorePushes(items, removedIds) {
  const removed = new Set(removedIds);
  const pushes = [];
  let run = null;
  items.forEach((item, index) => {
    if (!removed.has(item._id)) {
      run = null;
      return;
    }
    if (!run) {
      run = {
        $each: [],
        first: index
      };
      pushes.push(run);
    }
    run.$each.push(item);
    run.last = index;
  });
  return pushes.map(({
    $each, first, last
  }) => {
    const before = items[last + 1]?._id;
    const after = items[first - 1]?._id;
    return {
      $each,
      ...before
        ? { $before: before }
        : (after ? { $after: after } : {})
    };
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

// Operations offered for a multi-selection. `entries` has one
// `{ operations, widget }` per selected widget. An operation is offered when
// every widget has one by that name with `multiple: true` and, when it has
// an `if`, `checkIf(widget, operation.if)` passes for that widget. They come
// in the first widget's order.
export function multipleOperations(entries, checkIf) {
  if (!entries.length) {
    return [];
  }
  const qualifies = (operation, widget) => {
    return operation?.multiple === true &&
      (!operation.if || checkIf(widget, operation.if));
  };
  return entries[0].operations.filter((operation) => {
    return entries.every(({ operations, widget }) => {
      return qualifies(
        operations.find(({ name }) => name === operation.name),
        widget
      );
    });
  });
}

function replaceSelection(widgetId) {
  return {
    selectedWidgetIds: [ widgetId ],
    selectionAnchorId: widgetId,
    pinnedWidgetIds: [ widgetId ]
  };
}

// Turning a widget off, or a widget inside one that is already selected,
// is a removal. Anything else adds it.
function toggleWidget(state, widgetId, tree) {
  const { parentOf } = tree;
  const path = typeof parentOf === 'function'
    ? pathOf(widgetId, parentOf)
    : [ widgetId ];
  const removing = path.some((id) => state.selectedWidgetIds.includes(id));
  const selectedWidgetIds = liftToCommonParent(
    [ ...state.selectedWidgetIds, widgetId ],
    {
      ...tree,
      removeId: removing ? widgetId : null
    }
  );
  if (!selectedWidgetIds) {
    return state;
  }
  // Turning a widget off leaves the anchor on a widget that is still
  // selected, so a following shift-click ranges from something the user
  // can still see.
  const containing = selectedWidgetIds.find((id) => path.includes(id));
  const selectionAnchorId = (!removing && containing) ||
    selectedWidgetIds[selectedWidgetIds.length - 1] ||
    null;
  return {
    selectedWidgetIds,
    selectionAnchorId,
    pinnedWidgetIds: [ ...selectedWidgetIds ]
  };
}

// The pins stay as they are, so a shorter shift-click shrinks the range.
function rangeTo(state, widgetId, tree) {
  const { parentOf, areaOf } = tree;
  const lifted = liftToCommonParent(
    [ ...state.pinnedWidgetIds, widgetId ],
    tree
  );
  if (!lifted) {
    return state;
  }
  const selectedWidgetIds = fillGaps(lifted, areaOf);
  const path = typeof parentOf === 'function'
    ? pathOf(widgetId, parentOf)
    : [ widgetId ];
  const selectionAnchorId = selectedWidgetIds.includes(state.selectionAnchorId)
    ? state.selectionAnchorId
    : (selectedWidgetIds.find((id) => path.includes(id)) || null);
  return {
    selectedWidgetIds,
    selectionAnchorId,
    pinnedWidgetIds: [ ...state.pinnedWidgetIds ]
  };
}

// The top-level area that `id` descends from.
function rootAreaOf(id, parentOf, areaOf) {
  const top = typeof parentOf === 'function' ? pathOf(id, parentOf)[0] : id;
  return areaOf(top)?.areaId ?? null;
}

// From the top of the tree down to `id`.
function pathOf(id, parentOf) {
  const path = [ id ];
  let parent = parentOf(id);
  while (parent && !path.includes(parent)) {
    path.unshift(parent);
    parent = parentOf(parent);
  }
  return path;
}

// A shift-drag adds the widgets inside the rectangle. Ids already selected
// stay selected. A drag whose rectangle hits a single widget selects that
// widget, even when the layout around it also overlaps the rectangle.
// When the rectangle hits more than one widget, an ancestor wins over the
// widgets inside it, walking up until the outermost selected widget
// remains. The anchor is the last captured widget that is still selected,
// and the pins become the whole set.
//
// Only widgets from one top-level area are captured: the area of the
// current selection, else the area of `startId`, the widget the drag
// started on, else the area of the first captured widget. Layout columns
// are never captured, and the result is lifted to a common parent the way
// a meta-click is.
export function addCapturedWidgets(
  state = emptySelection(),
  ids = [],
  {
    parentOf, areaOf, isColumn, startId = null
  } = {}
) {
  let captured = unique((ids || []).filter(Boolean));
  if (typeof isColumn === 'function') {
    captured = captured.filter((id) => !isColumn(id));
  }
  if (typeof areaOf === 'function') {
    const anchor = state?.selectedWidgetIds?.[0] || startId || captured[0];
    const root = anchor ? rootAreaOf(anchor, parentOf, areaOf) : null;
    captured = captured.filter((id) => {
      return rootAreaOf(id, parentOf, areaOf) === root;
    });
  }
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
  const outermost = single
    ? preferWidget(merged, leaves[0], parentOf)
    : keepOutermost(merged, parentOf);
  const nextIds = liftToCommonParent(outermost, {
    parentOf,
    areaOf,
    isColumn
  }) || outermost;
  // The anchor is the last captured widget still selected, or what the
  // last captured widget was lifted to.
  const surviving = chosen.filter((id) => nextIds.includes(id));
  const last = chosen[chosen.length - 1];
  const anchor = surviving.length
    ? surviving[surviving.length - 1]
    : nextIds.find((id) => {
      return typeof parentOf === 'function' && isAncestor(id, last, parentOf);
    });
  return {
    selectedWidgetIds: nextIds,
    selectionAnchorId: anchor ?? state?.selectionAnchorId ?? null,
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

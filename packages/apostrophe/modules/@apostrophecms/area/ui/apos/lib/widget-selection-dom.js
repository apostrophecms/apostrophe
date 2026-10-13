import {
  applyWidgetSelection,
  selectionGesture
} from './widget-selection.js';

// The area and sibling ids for a widget, from the edit-mode DOM. The
// widget's own element is not an area, so the nearest area is the one
// that contains it, not an area nested inside it.
export function widgetContext(widgetId) {
  if (!widgetId || typeof document === 'undefined') {
    return null;
  }
  const el = document.querySelector(widgetSelector(widgetId));
  if (!el) {
    return null;
  }
  const area = el.closest('[data-apos-area]');
  if (!area) {
    return null;
  }
  const list = area.querySelector(':scope > .apos-areas-widgets-list');
  const itemIds = list
    ? Array.from(list.children)
      .map((child) => child.getAttribute('data-apos-widget-id'))
      .filter(Boolean)
    : [];
  return {
    el,
    areaId: area.getAttribute('data-apos-area'),
    itemIds,
    type: el.getAttribute('data-apos-widget-type')
  };
}

// The parent's guard is what the click lands on, so the event's own widget
// is the outer one. A click in a layout column would otherwise select the
// layout. elementsFromPoint still lists the widgets underneath, and the
// innermost of those is the one the pointer is actually on.
export function deepestWidgetId(x, y) {
  if (typeof document === 'undefined' || !document.elementsFromPoint) {
    return null;
  }
  const seen = new Set();
  const nodes = [];
  for (const el of document.elementsFromPoint(x, y)) {
    const widget = el.closest?.('[data-apos-widget-id]');
    if (!widget) {
      continue;
    }
    const id = widget.getAttribute('data-apos-widget-id');
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    nodes.push({
      id,
      el: widget
    });
  }
  let deepest = null;
  for (const node of nodes) {
    if (!deepest || deepest.el.contains(node.el)) {
      deepest = node;
    }
  }
  return deepest?.id || null;
}

export function nextSelectionFromClick({
  event = null,
  widgetId = null,
  fallbackAreaId = null,
  state
} = {}) {
  if (!widgetId) {
    return {
      next: applyWidgetSelection({ widgetId: null }),
      primaryId: null,
      areaId: null
    };
  }
  const gesture = selectionGesture(event);
  const id = innerWidgetId(event, widgetId);
  const target = widgetContext(id);
  const anchor = state.selectionAnchorId
    ? widgetContext(state.selectionAnchorId)
    : null;
  const areaId = target?.areaId || fallbackAreaId;
  const anchorAreaId = anchor?.areaId || null;
  const next = applyWidgetSelection({
    state,
    gesture,
    widgetId: id,
    areaId,
    anchorAreaId,
    areaItemIds: areaId && areaId === anchorAreaId
      ? (anchor?.itemIds || target?.itemIds || [])
      : (target?.itemIds || [])
  });
  const primaryId = next.selectedWidgetIds.includes(id)
    ? id
    : (next.selectedWidgetIds[next.selectedWidgetIds.length - 1] || null);
  const primaryAreaId = primaryId
    ? (widgetContext(primaryId)?.areaId || areaId)
    : null;
  return {
    next,
    primaryId,
    areaId: primaryAreaId
  };
}

export function widgetSelector(widgetId) {
  return `[data-apos-widget-id="${CSS.escape(widgetId)}"]`;
}

// A mouse click on the widget body addresses the innermost widget under the
// pointer, when that widget sits inside the one that received the event.
// Labels and toolbars name a widget on purpose, and keyboard events have no
// pointer to follow.
function innerWidgetId(event, widgetId) {
  if (!event || (event.type !== 'click' && event.type !== 'mousedown')) {
    return widgetId;
  }
  const target = event.target;
  if (target?.closest?.('.apos-area-widget-controls, .apos-widget-selection-toolbar')) {
    return widgetId;
  }
  const deepest = deepestWidgetId(event.clientX, event.clientY);
  if (!deepest || deepest === widgetId) {
    return widgetId;
  }
  const host = widgetContext(widgetId);
  const inner = widgetContext(deepest);
  if (host?.el && inner?.el && host.el.contains(inner.el)) {
    return deepest;
  }
  return widgetId;
}

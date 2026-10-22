import {
  applyWidgetSelection,
  selectionGesture
} from './widget-selection.js';

// A selection never reaches past a modal or an inline array item. Each is
// a scope of its own, and the page is the scope of everything else.
const SCOPE_SELECTOR = '[data-apos-modal], [data-apos-input-array-inline-item]';

export function selectionScope(el) {
  return el?.closest?.(SCOPE_SELECTOR) || document;
}

// The same widget can be on the page and in a modal at once, as in the
// widget editor's copy of a layout's columns, so a widget is only looked
// up in its scope.
export function widgetElement(widgetId, scope = document) {
  if (!widgetId || !scope) {
    return null;
  }
  for (const el of scope.querySelectorAll(widgetSelector(widgetId))) {
    if (selectionScope(el) === scope) {
      return el;
    }
  }
  return null;
}

// The scope `ids` were selected in, when the store does not know it:
// `scope` if every one of them is there, otherwise null.
export function scopeOfIds(ids, scope) {
  return ids.every((id) => widgetElement(id, scope)) ? scope : null;
}

// Every layout widget module, subclasses included, names the widget type
// of its columns.
export function isLayoutColumn(widgetId, scope = document) {
  const type = widgetElement(widgetId, scope)?.getAttribute('data-apos-widget-type');
  if (!type) {
    return false;
  }
  return Object.values(window.apos?.modules || {}).some((module) => {
    return module?.columnWidgetName === type;
  });
}

// The area and sibling ids for a widget, from the edit-mode DOM. The
// widget's own element is not an area, so the nearest area is the one
// that contains it, not an area nested inside it.
export function widgetContext(widgetId, scope = document) {
  if (!widgetId || typeof document === 'undefined') {
    return null;
  }
  const el = widgetElement(widgetId, scope);
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

// `el` is the element of the widget that received the event, and
// `stateScope` is the scope the current selection was made in, if known.
// A meta-click or shift-click in another scope is ignored.
export function nextSelectionFromClick({
  event = null,
  widgetId = null,
  el = null,
  fallbackAreaId = null,
  state,
  stateScope = null
} = {}) {
  if (!widgetId) {
    return {
      next: applyWidgetSelection({ widgetId: null }),
      primaryId: null,
      areaId: null,
      scope: null
    };
  }
  const scope = selectionScope(el);
  const gesture = multiGesture(event);
  if (
    gesture !== 'plain' &&
    state.selectedWidgetIds.length &&
    (stateScope || scopeOfIds(state.selectedWidgetIds, scope)) !== scope
  ) {
    return { ignored: true };
  }
  const id = innerWidgetId(event, widgetId, scope);
  const next = applyWidgetSelection({
    state,
    gesture,
    widgetId: id,
    parentOf: (child) => parentWidgetId(child, scope),
    areaOf: (child) => widgetContext(child, scope),
    isColumn: (child) => isLayoutColumn(child, scope)
  });
  if (next === state) {
    return { ignored: true };
  }
  // The click may have selected the widget's ancestor instead.
  const clicked = widgetElement(id, scope);
  const primaryId = next.selectedWidgetIds.includes(id)
    ? id
    : (
      next.selectedWidgetIds.find((selected) => {
        return widgetElement(selected, scope)?.contains(clicked);
      }) ||
      next.selectedWidgetIds[next.selectedWidgetIds.length - 1] ||
      null
    );
  return {
    next,
    primaryId,
    areaId: primaryId
      ? (widgetContext(primaryId, scope)?.areaId || fallbackAreaId)
      : null,
    scope
  };
}

export function widgetSelector(widgetId) {
  return `[data-apos-widget-id="${CSS.escape(widgetId)}"]`;
}

// Multi-select and the drag net belong to editing. The page preview
// leaves edit mode, but a modal is still an editing session.
export function isEditingContext(target) {
  if (typeof window !== 'undefined' && window.apos?.adminBar?.editMode) {
    return true;
  }
  if (!target?.closest) {
    return false;
  }
  return Boolean(target.closest('.apos-modal, [data-apos-schema-area]'));
}

// The nearest ancestor widget in `scope`. Foreign widgets are not
// selectable, so the walk continues through them to the next real parent.
export function parentWidgetId(widgetId, scope = document) {
  let current = widgetElement(widgetId, scope);
  while (current) {
    const parent = current.parentElement?.closest('[data-apos-widget-id]');
    if (!parent || selectionScope(parent) !== scope) {
      return null;
    }
    if (parent.getAttribute('data-apos-widget-foreign') !== '1') {
      return parent.getAttribute('data-apos-widget-id');
    }
    current = parent;
  }
  return null;
}

// Widget ids in `scope` whose boxes overlap `rect`, in document order. A
// shared edge is not an overlap. Foreign widgets are skipped: batch edits
// ignore them.
export function widgetIdsInRect(rect, scope = document) {
  if (typeof document === 'undefined' || !rect) {
    return [];
  }
  const boxes = [];
  for (const el of scope.querySelectorAll('[data-apos-widget-id]')) {
    if (
      el.getAttribute('data-apos-widget-foreign') === '1' ||
      selectionScope(el) !== scope
    ) {
      continue;
    }
    const id = el.getAttribute('data-apos-widget-id');
    if (!id) {
      continue;
    }
    const bounds = el.getBoundingClientRect();
    boxes.push({
      id,
      top: bounds.top,
      left: bounds.left,
      right: bounds.right,
      bottom: bounds.bottom
    });
  }
  return boxesInRect(boxes, rect);
}

export function boxesInRect(boxes, rect) {
  const target = normalizeRect(rect);
  if (!target) {
    return [];
  }
  return (boxes || [])
    .filter((box) => overlaps(box, target))
    .map((box) => box.id);
}

function normalizeRect(rect) {
  if (!rect) {
    return null;
  }
  const left = Math.min(rect.left, rect.right);
  const right = Math.max(rect.left, rect.right);
  const top = Math.min(rect.top, rect.bottom);
  const bottom = Math.max(rect.top, rect.bottom);
  if (right <= left || bottom <= top) {
    return null;
  }
  return {
    left,
    right,
    top,
    bottom
  };
}

function overlaps(box, rect) {
  return box.left < rect.right &&
    box.right > rect.left &&
    box.top < rect.bottom &&
    box.bottom > rect.top;
}

// Meta, ctrl, and shift build a multi-selection only while editing.
// Anywhere else they stay a plain click.
function multiGesture(event) {
  const gesture = selectionGesture(event);
  if (gesture === 'plain' || isEditingContext(event?.target)) {
    return gesture;
  }
  return 'plain';
}

// A mouse click on the widget body addresses the innermost widget under the
// pointer, when that widget sits inside the one that received the event.
// Labels and toolbars name a widget on purpose, and keyboard events have no
// pointer to follow.
function innerWidgetId(event, widgetId, scope) {
  if (!event || (event.type !== 'click' && event.type !== 'mousedown')) {
    return widgetId;
  }
  const target = event.target;
  if (target?.closest?.('.apos-area-widget-controls, .apos-widget-controls-multiselect')) {
    return widgetId;
  }
  const deepest = deepestWidgetId(event.clientX, event.clientY);
  if (!deepest || deepest === widgetId) {
    return widgetId;
  }
  const host = widgetElement(widgetId, scope);
  const inner = widgetElement(deepest, scope);
  if (host && inner && host.contains(inner)) {
    return deepest;
  }
  return widgetId;
}

import createApp, { pinia } from 'Modules/@apostrophecms/ui/lib/vue';
import { useWidgetStore } from 'Modules/@apostrophecms/ui/stores/widget.js';
import { addCapturedWidgets } from './widget-selection.js';
import {
  deepestWidgetId,
  isEditingContext,
  isLayoutColumn,
  parentWidgetId,
  scopeOfIds,
  selectionScope,
  widgetContext,
  widgetElement,
  widgetIdsInRect
} from './widget-selection-dom.js';

// Page-level multi-select: the controls, clearing the selection when edit
// mode ends, and the meta-drag rectangle that adds widgets.
export function installWidgetMarqueeSelection() {
  createWidgetControlsMultiselect();
  createMarqueeSelect();
  watchEditMode();
}

function createWidgetControlsMultiselect() {
  const component = apos.vueComponents.AposWidgetControlsMultiselect;
  if (!component) {
    return;
  }
  const el = document.createElement('div');
  document.body.appendChild(el);
  createApp(component).mount(el);
}

function watchEditMode() {
  apos.bus.$on('admin-bar-edit-mode', (editing) => {
    if (editing) {
      return;
    }
    const store = useWidgetStore(pinia);
    // A selection in a modal or an inline array item outlives edit mode.
    const scope = store.selectionScope ||
      scopeOfIds(store.selectedWidgetIds, document);
    if (scope !== document) {
      return;
    }
    const el = widgetElement(store.focusedWidget, scope);
    if (el?.closest('[data-apos-schema-area]')) {
      return;
    }
    if (store.selectedWidgetIds?.length) {
      store.setFocusedWidget(null);
    }
  });
}

// Meta-drag (or ctrl-drag) draws a rectangle and adds every widget it
// touches. While the rectangle is on screen the selection previews the
// net, including widgets that leave it. A drag that stays under a few
// pixels remains a meta-click.
function createMarqueeSelect() {
  const threshold = 4;
  let drag = null;
  let box = null;
  let previewFrame = 0;
  let swallowClick = false;

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('selectstart', onSelectStart);
  // An image or link starts a native drag within a few pixels and then
  // stops delivering moves, so the rectangle never grows.
  document.addEventListener('dragstart', onDragStart, true);

  function onPointerDown(event) {
    if (event.button !== 0 || (!event.metaKey && !event.ctrlKey)) {
      return;
    }
    if (!isEditingContext(event.target) || !canStartMarquee(event.target)) {
      return;
    }
    drag = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      active: false,
      inModal: Boolean(event.target.closest?.('.apos-modal')),
      scope: selectionScope(event.target),
      theme: event.target.closest?.('.apos-theme--primary-default') ||
        document.querySelector('.apos-theme--primary-default')
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function onDragStart(event) {
    if (drag) {
      event.preventDefault();
    }
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active) {
      if ((dx * dx) + (dy * dy) <= threshold * threshold) {
        return;
      }
      drag.active = true;
      drag.origin = selectionSnapshot(drag.scope);
      drag.startId = deepestWidgetId(drag.x, drag.y);
      window.getSelection?.().removeAllRanges();
      showBox(drag);
      try {
        event.target.setPointerCapture?.(drag.pointerId);
      } catch {
        // The pointer may already be captured, or the target may not
        // accept it. The window listeners still follow the gesture.
      }
    }
    event.preventDefault();
    drag.x2 = event.clientX;
    drag.y2 = event.clientY;
    placeBox(drag.x, drag.y, drag.x2, drag.y2);
    schedulePreview();
  }

  function onPointerUp(event) {
    if (drag && event.pointerId !== drag.pointerId) {
      return;
    }
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    if (previewFrame) {
      window.cancelAnimationFrame(previewFrame);
      previewFrame = 0;
    }
    const finished = drag;
    drag = null;
    hideBox();
    if (!finished?.active) {
      return;
    }
    swallowClick = true;
    // mouseup outside the window may never be followed by a click
    setTimeout(() => {
      swallowClick = false;
    }, 0);
    // The pointer was taken away. Put back the selection from before
    // the preview rather than keeping a rectangle that never finished.
    if (event.type === 'pointercancel') {
      writeSelection(finished.origin, finished.origin.scope);
      return;
    }
    finished.x2 = event.clientX;
    finished.y2 = event.clientY;
    previewSelection(finished);
  }

  function schedulePreview() {
    if (previewFrame) {
      return;
    }
    previewFrame = window.requestAnimationFrame(() => {
      previewFrame = 0;
      if (!drag?.active) {
        return;
      }
      previewSelection(drag);
    });
  }

  // Recompute the net from the selection held when the drag armed, so a
  // widget added by an earlier move is dropped when the rectangle leaves it.
  function previewSelection(current) {
    // A drag in another scope than the selection captures nothing.
    const { scope, origin } = current;
    const ids = origin.selectedWidgetIds.length && origin.scope !== scope
      ? []
      : widgetIdsInRect({
        left: current.x,
        top: current.y,
        right: current.x2,
        bottom: current.y2
      }, scope);
    const next = addCapturedWidgets(origin, ids, {
      parentOf: (id) => parentWidgetId(id, scope),
      areaOf: (id) => widgetContext(id, scope),
      isColumn: (id) => isLayoutColumn(id, scope),
      startId: current.startId
    });
    writeSelection(next, scope);
  }

  function selectionSnapshot(scope) {
    const store = useWidgetStore(pinia);
    const selectedWidgetIds = [ ...(store.selectedWidgetIds || []) ];
    return {
      selectedWidgetIds,
      selectionAnchorId: store.selectionAnchorId ?? null,
      pinnedWidgetIds: [ ...(store.pinnedWidgetIds || []) ],
      scope: store.selectionScope || scopeOfIds(selectedWidgetIds, scope)
    };
  }

  function writeSelection(next, scope) {
    const store = useWidgetStore(pinia);
    const selected = next?.selectedWidgetIds || [];
    const current = store.selectedWidgetIds || [];
    if (
      current.length === selected.length &&
      current.every((id, index) => id === selected[index])
    ) {
      return;
    }
    const primaryId = next.selectionAnchorId;
    const context = primaryId ? widgetContext(primaryId, scope) : null;
    const graphKey = context?.el?.closest('[data-apos-graph-key]')
      ?.getAttribute('data-apos-graph-key') ||
      apos.adminBar?.contextId ||
      null;
    store.setWidgetSelection(next, {
      primaryId,
      areaId: context?.areaId || null,
      graphKey,
      scope
    });
  }

  function onClick(event) {
    if (!swallowClick) {
      return;
    }
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function onSelectStart(event) {
    if (drag?.active) {
      event.preventDefault();
    }
  }

  function showBox(drag) {
    box = document.createElement('div');
    box.className = drag.inModal
      ? 'apos-widget-marquee apos-widget-marquee--modal'
      : 'apos-widget-marquee';
    // Tokens live on the theme, which is not an ancestor of document.body.
    // Copy the used ones so the stroke and fill resolve on the overlay.
    if (drag.theme) {
      const themeStyle = window.getComputedStyle(drag.theme);
      [ '--a-primary', '--a-primary-transparent-25' ].forEach((name) => {
        const value = themeStyle.getPropertyValue(name).trim();
        if (value) {
          box.style.setProperty(name, value);
        }
      });
    }
    document.body.appendChild(box);
  }

  function placeBox(x1, y1, x2, y2) {
    if (!box) {
      return;
    }
    box.style.left = `${Math.min(x1, x2)}px`;
    box.style.top = `${Math.min(y1, y2)}px`;
    box.style.width = `${Math.abs(x2 - x1)}px`;
    box.style.height = `${Math.abs(y2 - y1)}px`;
  }

  function hideBox() {
    box?.remove();
    box = null;
  }
}

function canStartMarquee(target) {
  if (!target?.closest) {
    return false;
  }
  return !target.closest(
    'input, textarea, [contenteditable], .apos-admin-bar, .apos-widget-controls-multiselect, .apos-area-widget-controls'
  );
}

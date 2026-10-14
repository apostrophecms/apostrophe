import { defineStore } from 'pinia';
import {
  ref, computed, nextTick
} from 'vue';

export const useWidgetStore = defineStore('widget', () => {
  const refs = ref({});
  const emphasizedWidgets = ref(new Set());
  const focusedWidget = ref(null);
  const focusedArea = ref(null);
  // More than one widget. `focusedWidget` stays the primary (last clicked)
  // so keyboard shortcuts keep working. `pinnedWidgetIds` is the selection
  // at the last click that was not a shift-click, so a shorter range can
  // shrink without dropping widgets that were toggled on their own.
  const selectedWidgetIds = ref([]);
  const selectionAnchorId = ref(null);
  const pinnedWidgetIds = ref([]);
  const selectionGraphKey = ref(null);
  // Set in the same turn a multi-selection replaces single-widget controls,
  // while focus is still inside them. The selection bar consumes it.
  const selectionToolbarFocus = ref(false);
  // Bumped after a batch change that does not change which ids are
  // selected, so the toolbar can re-read widget positions from the DOM.
  const selectionRevision = ref(0);
  const hoveredWidget = ref(null);
  const hoveredNonForeignWidget = ref(null);
  // Fields edited in place, per the `{% field %}` custom tag. They wear the
  // same breadcrumb trail a widget does, so they take their turn here
  const focusedField = ref(null);
  const hoveredField = ref(null);

  // The one thing on the page that wears a breadcrumb trail, since two labels
  // on screen at once are two things to read and one of them is stale. The
  // innermost thing the user is working in wins: the field of a widget over
  // the widget it belongs to, and whatever they are editing over whatever the
  // mouse is merely passing over, which is how widgets have always behaved
  const labeled = computed(() => {
    // Several selected widgets wear the highlight only. The breadcrumb
    // stays off all of them, and off whatever the pointer is passing over.
    const multi = selectedWidgetIds.value.length > 1;
    const order = [
      [ 'field', focusedField.value ],
      [ 'widget', multi ? null : focusedWidget.value ],
      [ 'field', hoveredField.value ],
      [ 'widget', (multi || focusedWidget.value) ? null : hoveredWidget.value ]
    ];
    const winner = order.find(([ type, id ]) => id);
    return winner
      ? {
        type: winner[0],
        id: winner[1]
      }
      : null;
  });

  function setFocusedArea(id, event) {
    if (event) {
      // prevent parent areas from changing the focusedArea
      event.stopPropagation();
    }

    focusedArea.value = id;
  }

  function addEmphasizedWidget(id) {
    emphasizedWidgets.value.add(id);
  }

  function removeEmphasizedWidget(id) {
    emphasizedWidgets.value.delete(id);
  }

  function setHoveredWidget(id, nonForeignId) {
    hoveredWidget.value = id;
    hoveredNonForeignWidget.value = nonForeignId;
  }

  function setHoveredField(id) {
    hoveredField.value = id;
    if (id) {
      // The field is inside the widget, so it is the innermost thing under
      // the mouse, and the widget stops behaving as though it were hovered
      hoveredWidget.value = null;
      hoveredNonForeignWidget.value = null;
    }
  }

  // Fields clear only their own state: by the time a field is told the mouse
  // has left it, the next field may already have claimed the trail
  function clearHoveredField(id) {
    if (hoveredField.value === id) {
      hoveredField.value = null;
    }
  }

  function setFocusedField(id) {
    focusedField.value = id;
  }

  function clearFocusedField(id) {
    if (focusedField.value === id) {
      focusedField.value = null;
    }
  }

  // A single widget, or none. Also the way a batch edit that leaves one
  // widget standing collapses back to the ordinary controls.
  async function setFocusedWidget(id, areaId, { scrollTo = false } = {}) {
    if (!id) {
      selectedWidgetIds.value = [];
      selectionAnchorId.value = null;
      pinnedWidgetIds.value = [];
      selectionGraphKey.value = null;
      selectionToolbarFocus.value = false;
      focusedWidget.value = null;
      setFocusedArea(null);
      return;
    }
    selectedWidgetIds.value = [ id ];
    selectionAnchorId.value = id;
    pinnedWidgetIds.value = [ id ];
    focusedWidget.value = id;
    setFocusedArea(areaId);

    if (scrollTo) {
      await nextTick();
      await scrollToWidget(id);
    }
  }

  function setWidgetSelection(next, {
    primaryId = null,
    areaId = null,
    graphKey = null
  } = {}) {
    const selected = [ ...(next?.selectedWidgetIds || []) ];
    const enteringMulti = selectedWidgetIds.value.length <= 1 && selected.length > 1;
    if (enteringMulti) {
      const active = (typeof document !== 'undefined') && document.activeElement;
      selectionToolbarFocus.value = Boolean(
        active?.closest?.('.apos-area-widget-controls--modify')
      );
    }
    selectedWidgetIds.value = selected;
    selectionAnchorId.value = selected.includes(next?.selectionAnchorId)
      ? next.selectionAnchorId
      : (selected[selected.length - 1] || null);
    pinnedWidgetIds.value = [ ...(next?.pinnedWidgetIds || []) ];
    if (!selected.length) {
      selectionGraphKey.value = null;
    } else if (graphKey) {
      selectionGraphKey.value = graphKey;
    }
    const primary = selected.includes(primaryId)
      ? primaryId
      : (selected[selected.length - 1] || null);
    focusedWidget.value = primary;
    setFocusedArea(primary ? areaId : null);
    selectionRevision.value += 1;
  }

  function clearSelectionToolbarFocus() {
    selectionToolbarFocus.value = false;
  }

  function bumpSelectionRevision() {
    selectionRevision.value += 1;
  }

  async function scrollToWidget(id) {
    const $el = document.querySelector(`[data-apos-widget-id="${id}"]`);
    if (!$el) {
      return;
    }
    if (!isElementInView($el)) {
      scrollToElement($el);
    }
    $el.focus({
      preventScroll: true
    });
  }

  // True if enough of `$el` is on screen for the user to see it: its top is
  // not hidden, and at least the first 120 pixels of it, or all of it if it
  // is smaller than that, are showing. Not "all of it": an element taller
  // than the screen could never pass that test
  function isElementInView($el) {
    const { top, bottom } = visibleBounds($el);
    const rect = $el.getBoundingClientRect();
    const visible = Math.min(rect.bottom, bottom) - Math.max(rect.top, top);
    return (rect.top >= top) && (visible >= Math.min(rect.height, 120));
  }

  // Scroll `$el` to the top of whatever scrolls it, below the admin bar if
  // that is the window. Nested scrollers are taken care of by the browser
  function scrollToElement($el, { behavior = 'smooth' } = {}) {
    const bufferSpace = 40;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const previous = $el.style.scrollMarginTop;
    $el.style.scrollMarginTop = `${scrollableAncestor($el) ? bufferSpace : visibleBounds($el).top + bufferSpace}px`;
    $el.scrollIntoView({
      block: 'start',
      behavior: reduceMotion ? 'auto' : behavior
    });
    $el.style.scrollMarginTop = previous;
  }

  // Draw the eye to something that just changed, e.g. on undo
  function flashElement($el) {
    const className = 'apos-change-target';
    $el.classList.remove(className);
    // Reading layout restarts the animation if it is already running
    $el.getBoundingClientRect();
    $el.classList.add(className);
    setTimeout(() => $el.classList.remove(className), 1500);
  }

  // The nearest ancestor of `$el` that scrolls, or null if that is the
  // window. Breakpoint preview mode scrolls the page inside a container
  function scrollableAncestor($el) {
    let el = $el.parentElement;
    while (el && (el !== document.body) && (el !== document.documentElement)) {
      const { overflowY } = window.getComputedStyle(el);
      if (/auto|scroll/.test(overflowY) && (el.scrollHeight > el.clientHeight)) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function visibleBounds($el) {
    const scroller = scrollableAncestor($el);
    if (scroller) {
      const { top, bottom } = scroller.getBoundingClientRect();
      return {
        top,
        bottom
      };
    }
    return {
      top: window.apos.adminBar?.height || 0,
      bottom: window.innerHeight
    };
  }

  function toId(id, namespace) {
    return `${id}:${namespace}`;
  }

  function get(id, namespace) {
    return refs.value[toId(id, namespace)] || null;
  };

  function set(id, namespace, data) {
    refs.value[toId(id, namespace)] = ref({ data: { value: data } });
    return refs.value[toId(id, namespace)];
  }

  function getOrSet(id, namespace, data) {
    return get(id, namespace) || set(id, namespace, data);
  }

  function updateWidget(id, namespace, data) {
    const widget = refs.value[toId(id, namespace)];
    if (!widget) {
      return null;
    }
    widget.data.value = data;
    return widget;
  }

  function remove(id, namespace) {
    delete refs.value[toId(id, namespace)];
    return true;
  }

  return {
    refs,
    emphasizedWidgets,
    focusedWidget,
    focusedArea,
    selectedWidgetIds,
    selectionAnchorId,
    pinnedWidgetIds,
    selectionGraphKey,
    selectionToolbarFocus,
    selectionRevision,
    hoveredWidget,
    hoveredNonForeignWidget,
    focusedField,
    hoveredField,
    labeled,
    addEmphasizedWidget,
    removeEmphasizedWidget,
    setHoveredWidget,
    setHoveredField,
    clearHoveredField,
    setFocusedField,
    clearFocusedField,
    setFocusedArea,
    setFocusedWidget,
    setWidgetSelection,
    clearSelectionToolbarFocus,
    bumpSelectionRevision,
    scrollToWidget,
    isElementInView,
    scrollToElement,
    flashElement,
    toId,
    get,
    set,
    getOrSet,
    updateWidget,
    remove
  };
});

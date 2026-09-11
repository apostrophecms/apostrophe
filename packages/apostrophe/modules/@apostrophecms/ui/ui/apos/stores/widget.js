import { defineStore } from 'pinia';
import {
  ref, computed, nextTick
} from 'vue';

export const useWidgetStore = defineStore('widget', () => {
  const refs = ref({});
  const emphasizedWidgets = ref(new Set());
  const focusedWidget = ref(null);
  const focusedArea = ref(null);
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
    const order = [
      [ 'field', focusedField.value ],
      [ 'widget', focusedWidget.value ],
      [ 'field', hoveredField.value ],
      [ 'widget', hoveredWidget.value ]
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

  async function setFocusedWidget(id, areaId, { scrollTo = false } = {}) {
    focusedWidget.value = id;
    setFocusedArea(id ? areaId : null);

    if (id && scrollTo) {
      await nextTick();
      await scrollToWidget(id, { awaitNextTick: true });
    }
  }

  async function scrollToWidget(id) {
    const $el = document.querySelector(`[data-apos-widget-id="${id}"]`);
    if (!$el) {
      return;
    }

    const headerHeight = window.apos.adminBar.height;
    const bufferSpace = 40;
    const rect = $el.getBoundingClientRect();
    const visibleTop = headerHeight + bufferSpace;
    const visibleBottom = window.innerHeight - bufferSpace;
    const isInView = rect.top >= visibleTop && rect.bottom <= visibleBottom;

    if (!isInView) {
      const scrollPos = rect.top - headerHeight - bufferSpace;
      window.scrollBy({
        top: scrollPos,
        behavior: 'smooth'
      });
    }

    $el.focus({
      preventScroll: true
    });
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
    scrollToWidget,
    toId,
    get,
    set,
    getOrSet,
    updateWidget,
    remove
  };
});

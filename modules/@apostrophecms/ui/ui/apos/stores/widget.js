import { defineStore } from 'pinia';
import { ref, nextTick } from 'vue';

export const useWidgetStore = defineStore('widget', () => {
  const refs = ref({});
  const emphasizedWidgets = ref(new Set());
  const focusedWidget = ref(null);
  const focusedArea = ref(null);
  const hoveredWidget = ref(null);
  const hoveredNonForeignWidget = ref(null);

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
    const targetTop = $el.getBoundingClientRect().top;
    const scrollPos = targetTop - headerHeight - bufferSpace;

    window.scrollBy({
      top: scrollPos,
      behavior: 'smooth'
    });

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
    addEmphasizedWidget,
    removeEmphasizedWidget,
    setHoveredWidget,
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

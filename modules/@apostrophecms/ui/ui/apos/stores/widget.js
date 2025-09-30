import { defineStore } from 'pinia';
import { ref, nextTick } from 'vue';

export const useWidgetStore = defineStore('widget', () => {
  const refs = ref({});
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

  function setHoveredWidget(id, nonForeignId) {
    hoveredWidget.value = id;
    hoveredNonForeignWidget.value = nonForeignId;
  }

  async function setFocusedWidget(id, areaId, { scrollTo = false } = {}) {
    focusedWidget.value = id;
    setFocusedArea(areaId);

    if (scrollTo) {
      await scrollToWidget(id, { awaitNextTick: true });
    }
  }

  async function scrollToWidget(id, { awaitNextTick = false }) {
    if (awaitNextTick) {
      await nextTick();
    }

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

  function update(id, namespace, data) {
    if (!refs.value[toId(id, namespace)]) {
      return null;
    }
    refs.value[toId(id, namespace)].data.value = data;
    return refs.value[toId(id, namespace)];
  }

  function remove(id, namespace) {
    delete refs.value[toId(id, namespace)];
    return true;
  }

  return {
    refs,
    focusedWidget,
    focusedArea,
    hoveredWidget,
    hoveredNonForeignWidget,
    setHoveredWidget,
    setFocusedArea,
    setFocusedWidget,
    scrollToWidget,
    toId,
    get,
    set,
    getOrSet,
    update,
    remove
  };
});

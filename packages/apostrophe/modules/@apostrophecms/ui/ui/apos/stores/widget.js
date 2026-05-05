import { defineStore } from 'pinia';
import { ref, nextTick } from 'vue';

export const useWidgetStore = defineStore('widget', () => {
  const refs = ref({});
  const emphasizedWidgets = ref(new Set());
  const focusedWidget = ref(null);
  const focusedArea = ref(null);
  const hoveredWidget = ref(null);
  const hoveredNonForeignWidget = ref(null);
  // Live, in-modal preview snapshots of widget data, keyed by widget id.
  // Published by AposWidgetEditor while the user is dragging style sliders
  // (style-only fast path, no SSR roundtrip). Consumed by widget editors
  // whose nested area lives behind a static `data-parent-options` JSON
  // attribute (e.g. AposAreaLayoutEditor) so that values which are
  // normally only fed in via SSR-rendered parent options can react in
  // real time. Cleared synchronously on modal close (save / cancel /
  // unmount) — callers fall back to the SSR-rendered parent options.
  const livePreviews = ref({});

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

  function setLivePreview(id, data) {
    if (!id) {
      return;
    }
    livePreviews.value = {
      ...livePreviews.value,
      [id]: data
    };
  }

  function clearLivePreview(id) {
    if (!id || !(id in livePreviews.value)) {
      return;
    }
    const next = { ...livePreviews.value };
    delete next[id];
    livePreviews.value = next;
  }

  function getLivePreview(id) {
    return id ? livePreviews.value[id] || null : null;
  }

  return {
    refs,
    emphasizedWidgets,
    focusedWidget,
    focusedArea,
    hoveredWidget,
    hoveredNonForeignWidget,
    livePreviews,
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
    remove,
    setLivePreview,
    clearLivePreview,
    getLivePreview
  };
});

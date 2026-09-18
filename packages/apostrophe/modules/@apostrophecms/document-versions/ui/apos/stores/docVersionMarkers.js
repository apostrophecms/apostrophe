import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * The changes the versions modal marks on each widget it shows, by the
 * modal's widget graph key. A store rather than a prop, because nested
 * areas mount as apps of their own, and keyed, because the widgets of the
 * page under the modal share their ids with the version's and must stay
 * unmarked.
 */
export const useDocVersionMarkersStore = defineStore('docVersionMarkers', () => {
  // `{ [graphKey]: { [widgetId]: { changes, ai } } }`: `changes` lists
  // `added`, `modified` or `deleted`, then `moved`; `ai` is a boolean
  const changes = ref({});

  function set(graphKey, widgetChanges) {
    changes.value = {
      ...changes.value,
      [graphKey]: widgetChanges
    };
  }

  function clear(graphKey) {
    const { [graphKey]: cleared, ...rest } = changes.value;
    changes.value = rest;
  }

  // `null` for a widget without a marker
  function get(graphKey, widgetId) {
    return changes.value[graphKey]?.[widgetId] || null;
  }

  return {
    set,
    clear,
    get
  };
});

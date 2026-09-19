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
  // `{ [graphKey]: { [widgetId]: { changes, ai, data } } }`: `changes`
  // lists `added`, `modified` or `deleted`, then `moved`; `ai` is a
  // boolean; `data`, when set, holds the properties of the marked widget
  // that its rendering needs and a nested widget's data lacks, since the
  // server sanitizes it: `_olderVersion`, and `content` with its marks
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

  // Whether `graphKey` is that of a versions modal
  function has(graphKey) {
    return Boolean(graphKey) && Object.hasOwn(changes.value, graphKey);
  }

  return {
    set,
    clear,
    get,
    has
  };
});

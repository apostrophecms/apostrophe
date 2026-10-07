import {
  onBeforeUnmount, onMounted, provide, watch
} from 'vue';
import { useWidgetGraphStore } from 'Modules/@apostrophecms/ui/stores/widgetGraph.js';
import { useDocVersionMarkersStore } from '../stores/docVersionMarkers.js';

/**
 * The change markers of the versions modal's body. The modal gets a widget
 * graph of its own, under which the markers store holds the changes of the
 * widgets of the version shown; a change outside any widget marks its
 * top-level field. A click on a widget's marker arrives over the bus,
 * since the widgets of nested areas render in apps of their own.
 *
 * @param {object} options
 * @param {string} options.docId
 * @param {import('vue').Ref<object>} options.widgetChanges
 *   The changes of the marked widgets by `_id`, see `useDocVersionView`
 * @param {import('vue').Ref<object>} options.docMeta
 *   The `aposMeta` of the version shown
 * @param {(target: { widgetId: string, moved: boolean }) => void} options.onReveal
 *   Called when a widget's marker asks for its changes
 */
export function useDocVersionMarkers({
  docId, widgetChanges, docMeta, onReveal
}) {
  // The modal's own widget graph: its widgets share their ids with those of
  // the page under it. Nested areas, apps of their own, find the key on the
  // modal element
  const graphKey = `document-versions:${docId}`;
  provide('aposGraphKey', graphKey);

  const widgetGraphStore = useWidgetGraphStore();
  const markersStore = useDocVersionMarkersStore();

  // Known from the start, so that what renders in the modal renders for it
  markersStore.set(graphKey, {});
  watch(widgetChanges, changes => {
    markersStore.set(graphKey, changes);
  });

  // A change outside any widget marks its top-level field
  function isFieldModified(field) {
    return Boolean(docMeta.value[field.name]?.['@apostrophecms/schema:highlight']);
  }

  // AI's part in the changes of a top-level field, `changed` or
  // `assisted`; `false` when AI had none
  function getFieldAi(field) {
    return docMeta.value[field.name]?.['@apostrophecms/document-versions:ai'] || false;
  }

  function onWidgetMarker({ graphKey: key, widgetId }) {
    if (key === graphKey) {
      onReveal({
        widgetId,
        moved: Boolean(widgetChanges.value[widgetId]?.changes.includes('moved'))
      });
    }
  }

  onMounted(() => {
    apos.bus.$on('doc-version-marker', onWidgetMarker);
  });

  onBeforeUnmount(() => {
    apos.bus.$off('doc-version-marker', onWidgetMarker);
    markersStore.clear(graphKey);
    widgetGraphStore.destroyGraph(graphKey);
  });

  return {
    graphKey,
    isFieldModified,
    getFieldAi
  };
}

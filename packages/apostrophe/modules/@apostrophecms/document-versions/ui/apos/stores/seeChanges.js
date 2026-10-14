import { defineStore } from 'pinia';
import { ref } from 'vue';
import widgetChangesLib from '../lib/widget-changes.js';
import { useDocVersionMarkersStore } from './docVersionMarkers.js';

/**
 * See Changes: the changes of the draft of the document on the page since
 * its last publication. The context bar turns the mode on and off; this
 * store holds what the mode shows. The widgets of the page find their
 * markers under the page's graph key, the context document's `_id`.
 */
export const useSeeChangesStore = defineStore('seeChanges', () => {
  const active = ref(false);
  const docId = ref(null);
  // `{ rows, counts, baseline }`, see `getDraftChanges`
  const payload = ref(null);

  // Fetches the changes of `id`, the context document, and marks its
  // widgets. Resolves `false`, with the user told, when they could not be
  // loaded
  async function load(id) {
    const markersStore = useDocVersionMarkersStore();
    const { action } = apos.modules['@apostrophecms/document-versions'];
    let response;
    try {
      response = await apos.http.get(`${action}/draft-changes`, {
        busy: true,
        qs: {
          docId: id,
          annotate: 1
        }
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      apos.notify('apostrophe:seeChangesNotLoaded', {
        type: 'error',
        icon: 'alert-circle-icon'
      });
      return false;
    }
    const { doc, ...rest } = response;
    if (docId.value && (docId.value !== id)) {
      markersStore.clear(docId.value);
    }
    markersStore.set(id, widgetChangesLib.getWidgetChanges(doc));
    active.value = true;
    docId.value = id;
    payload.value = rest;
    return true;
  }

  function clear() {
    if (docId.value) {
      useDocVersionMarkersStore().clear(docId.value);
    }
    active.value = false;
    docId.value = null;
    payload.value = null;
  }

  return {
    active,
    docId,
    payload,
    load,
    clear
  };
});

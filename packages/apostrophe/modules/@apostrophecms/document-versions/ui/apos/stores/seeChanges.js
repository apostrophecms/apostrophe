import { defineStore } from 'pinia';
import { ref } from 'vue';
import widgetChangesLib from '../lib/widget-changes.js';
import { useDocVersionMarkersStore } from './docVersionMarkers.js';

/**
 * See Changes: the changes of the draft of the document on the page since
 * its last publication. The context bar turns the mode on and off and
 * mirrors it as `active`; this store holds what the mode shows. The widgets
 * of the page find their markers under the page's graph key, the context
 * document's `_id`.
 */
export const useSeeChangesStore = defineStore('seeChanges', () => {
  const active = ref(false);
  const docId = ref(null);
  // `{ rows, counts, baseline }`, see `getDraftChanges`
  const payload = ref(null);
  // The markers of the page's widgets by `_id`, see `getWidgetChanges`
  const widgetChanges = ref({});

  let requestId = 0;

  // Fetches the changes of `id`, the context document, and marks its
  // widgets. Resolves `false`, with the user told, when they could not be
  // loaded. Only the most recent call may update the state: one that a
  // later call or `clear()` superseded resolves `true` and changes nothing
  async function load(id) {
    const request = ++requestId;
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
      if (request !== requestId) {
        return true;
      }
      // eslint-disable-next-line no-console
      console.error(e);
      apos.notify('apostrophe:seeChangesNotLoaded', {
        type: 'error',
        icon: 'alert-circle-icon'
      });
      return false;
    }
    if (request !== requestId) {
      return true;
    }
    const { doc, ...rest } = response;
    if (docId.value && (docId.value !== id)) {
      markersStore.clear(docId.value);
    }
    widgetChanges.value = widgetChangesLib.getWidgetChanges(doc);
    markersStore.set(id, widgetChanges.value);
    docId.value = id;
    payload.value = rest;
    return true;
  }

  function setActive(value) {
    active.value = value;
  }

  function clear() {
    requestId++;
    if (docId.value) {
      useDocVersionMarkersStore().clear(docId.value);
    }
    docId.value = null;
    payload.value = null;
    widgetChanges.value = {};
  }

  return {
    active,
    docId,
    payload,
    widgetChanges,
    setActive,
    load,
    clear
  };
});

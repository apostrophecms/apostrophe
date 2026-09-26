import { ref } from 'vue';
import widgetChangesLib from '../lib/widget-changes.js';

/**
 * The version shown in the modal body: the document as schema fields,
 * marked by the server with its changes since the version before it, and
 * the changes of every marked widget by `_id`. The marked document is for
 * display only: it holds the widgets the version deleted, so it must never
 * be saved; `fetchVersion` loads the version as stored. Only the most
 * recent `show()` call may update the state, so a slow response for a
 * version the user has already moved away from is dropped.
 *
 * @param {{ action: string }} options
 *   `action` is the versions module's REST base URL
 */
export function useDocVersionView({ action }) {
  const docFields = ref({ data: {} });
  // `{ [widgetId]: { changes, ai, data } }`, see `getWidgetChanges`
  const widgetChanges = ref({});
  // Tells the schema components to take the new document
  const generation = ref(0);

  let requestId = 0;

  function fetchVersion(versionId) {
    return apos.http.get(`${action}/${versionId}`, { busy: true });
  }

  // Resolves `true` when the view now shows `versionId`, `false` when a
  // later call superseded this one. Request errors are thrown, unless the
  // call was superseded meanwhile. With `consolidate`, `versionId` being
  // the newest version of a consolidated version, the changes are those of
  // all its versions.
  async function show(versionId, { consolidate = false } = {}) {
    const id = ++requestId;
    let response;
    try {
      response = await apos.http.get(`${action}/${versionId}`, {
        busy: true,
        qs: {
          annotate: 1,
          ...(consolidate && { consolidate: 1 })
        }
      });
    } catch (e) {
      if (id !== requestId) {
        return false;
      }
      throw e;
    }
    if (id !== requestId) {
      return false;
    }
    widgetChanges.value = widgetChangesLib.getWidgetChanges(response.doc);
    docFields.value = { data: { ...response.doc } };
    generation.value++;
    return true;
  }

  return {
    docFields,
    widgetChanges,
    generation,
    show,
    fetchVersion
  };
}

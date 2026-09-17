import { ref } from 'vue';

/**
 * The version shown in the modal body: its full record and the document as
 * schema fields. Only the most recent `show()` call may update the state, so
 * a slow response for a version the user has already moved away from is
 * dropped.
 *
 * @param {{ action: string }} options
 *   `action` is the versions module's REST base URL
 */
export function useDocVersionView({ action }) {
  const version = ref(null);
  const docFields = ref({ data: {} });
  // Tells the schema components to take the new document
  const generation = ref(0);

  let requestId = 0;

  function fetchVersion(versionId) {
    return apos.http.get(`${action}/${versionId}`, { busy: true });
  }

  // Resolves `true` when the view now shows `versionId`, `false` when a
  // later call superseded this one. Request errors are thrown, unless the
  // call was superseded meanwhile.
  async function show(versionId) {
    const id = ++requestId;
    let response;
    try {
      response = await fetchVersion(versionId);
    } catch (e) {
      if (id !== requestId) {
        return false;
      }
      throw e;
    }
    if (id !== requestId) {
      return false;
    }
    version.value = response;
    docFields.value = { data: { ...response.doc } };
    generation.value++;
    return true;
  }

  return {
    version,
    docFields,
    generation,
    show,
    fetchVersion
  };
}

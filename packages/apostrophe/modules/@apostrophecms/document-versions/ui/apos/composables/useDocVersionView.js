import { ref } from 'vue';

/**
 * The version shown in the modal body: its full record, the document as
 * schema fields, and the schema of a side-by-side comparison when one is
 * on. Only the most recent `show()` call may update the state, so a slow
 * response for a version the user has already moved away from is dropped.
 *
 * @param {{ action: string }} options
 *   `action` is the versions module's REST base URL
 */
export function useDocVersionView({ action }) {
  const version = ref(null);
  const docFields = ref({ data: {} });
  const compareSchema = ref(null);
  const displayComparison = ref(false);
  // Tells the schema components to take the new document
  const generation = ref(0);

  let requestId = 0;

  function fetchVersion(versionId) {
    return apos.http.get(`${action}/${versionId}`, { busy: true });
  }

  function fetchComparison(versionId, compareId) {
    return apos.http.get(`${action}/compare/${versionId}/${compareId}`, { busy: true });
  }

  // Resolves `true` when the view now shows `versionId` (compared with
  // `compareId` when given), `false` when a later call superseded this one.
  // Request errors are thrown, unless the call was superseded meanwhile.
  async function show(versionId, compareId = null) {
    const id = ++requestId;
    let response;
    try {
      response = compareId
        ? await fetchComparison(versionId, compareId)
        : await fetchVersion(versionId);
    } catch (e) {
      if (id !== requestId) {
        return false;
      }
      throw e;
    }
    if (id !== requestId) {
      return false;
    }
    if (compareId) {
      compareSchema.value = response.schema
        .filter(field => field.name !== 'archived')
        .map(field => ({
          ...field,
          readOnly: true
        }));
      version.value = response.version;
      docFields.value = { data: { ...response.document } };
      displayComparison.value = true;
    } else {
      compareSchema.value = null;
      version.value = response;
      docFields.value = { data: { ...response.doc } };
      displayComparison.value = false;
    }
    generation.value++;
    return true;
  }

  return {
    version,
    docFields,
    compareSchema,
    displayComparison,
    generation,
    show,
    fetchVersion
  };
}

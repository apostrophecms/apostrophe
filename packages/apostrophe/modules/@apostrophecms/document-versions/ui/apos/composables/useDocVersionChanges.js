import { ref } from 'vue';

/**
 * The change list of one version, or of a consolidated version: the rows
 * and counts the `changes` route returns. Only the most recent `load()`
 * call may update the state, so a slow response for a version the user has
 * already left is dropped.
 *
 * @param {{ action: string }} options
 *   `action` is the versions module's REST base URL
 */
export function useDocVersionChanges({ action }) {
  const rows = ref([]);
  const counts = ref(null);

  let requestId = 0;

  // Resolves `true` when the state now holds the changes of `id`, `false`
  // when a later call superseded this one. Request errors are
  // thrown, unless the call was superseded meanwhile. With `consolidate`,
  // `id` is the newest version of a consolidated version.
  async function load(id, { consolidate = false } = {}) {
    const request = ++requestId;
    let response;
    try {
      response = await apos.http.get(`${action}/${id}/changes`, {
        busy: true,
        qs: consolidate ? { consolidate: 1 } : {}
      });
    } catch (e) {
      if (request !== requestId) {
        return false;
      }
      throw e;
    }
    if (request !== requestId) {
      return false;
    }
    rows.value = response.rows;
    counts.value = response.counts;
    return true;
  }

  return {
    rows,
    counts,
    load
  };
}

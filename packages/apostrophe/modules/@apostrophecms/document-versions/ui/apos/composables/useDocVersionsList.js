import { computed, ref } from 'vue';
import { asyncTaskQueue } from 'Modules/@apostrophecms/ui/utils';

/**
 * The paged version list of one document. Consecutive versions one author
 * saved with and without AI arrive as one consolidated version: the newest
 * one's fields plus `versionIds`, every version it stands for.
 * `load()` fetches the first page and `loadMore()` appends the next one.
 * Appends run one at a time in order, and a `load()` discards whatever was
 * in flight before it, so the list never receives a page twice or out of
 * order.
 *
 * @param {{ action: string, docId: string }} options
 *   `action` is the versions module's REST base URL
 */
export function useDocVersionsList({ action, docId }) {
  const versions = ref([]);
  // The `before` of the next page, `null` when there is none
  const next = ref(null);
  const isLoading = ref(false);
  const loaded = ref(false);
  const loadMorePending = ref(0);
  const isLoadingMore = computed(() => loadMorePending.value > 0);
  const hasMore = computed(() => next.value !== null);

  // Bumped by every `load()` so a stale append is dropped
  let generation = 0;
  const queue = asyncTaskQueue();

  function fetchPage(before) {
    return apos.http.get(action, {
      busy: !before,
      qs: {
        docId,
        consolidate: 1,
        ...(before && { before })
      }
    });
  }

  function applyPage(response, append) {
    const results = response.results || [];
    versions.value = append
      ? [ ...versions.value, ...results ]
      : results;
    next.value = response.next;
  }

  async function load() {
    generation++;
    const gen = generation;
    queue.clear();
    isLoading.value = true;
    try {
      const response = await fetchPage(null);
      if (gen !== generation) {
        return;
      }
      applyPage(response, false);
    } finally {
      if (gen === generation) {
        isLoading.value = false;
        loaded.value = true;
      }
    }
  }

  // Resolves once the next page is appended, or right away when there is
  // nothing to do: no first page yet, no page left, or an append already
  // queued
  async function loadMore() {
    if (!loaded.value || !hasMore.value || queue.hasTasks()) {
      return;
    }
    const gen = generation;
    loadMorePending.value++;
    try {
      await queue.add(async () => {
        if (gen !== generation || !hasMore.value) {
          return;
        }
        const response = await fetchPage(next.value);
        if (gen !== generation) {
          return;
        }
        applyPage(response, true);
      });
    } catch (e) {
      if (e.message !== 'queue:cleared') {
        throw e;
      }
    } finally {
      loadMorePending.value--;
    }
  }

  function cancel() {
    generation++;
    queue.clear();
  }

  return {
    versions,
    hasMore,
    isLoading,
    isLoadingMore,
    loaded,
    load,
    loadMore,
    cancel
  };
}

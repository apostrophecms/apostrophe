import { computed, ref } from 'vue';
import { asyncTaskQueue } from 'Modules/@apostrophecms/ui/utils';

/**
 * The paged version list of one document. `load()` fetches the first page
 * and `loadMore()` appends the next one. Appends run one at a time in
 * order, and a `load()` discards whatever was in flight before it, so the
 * list never receives a page twice or out of order.
 *
 * @param {{ action: string, docId: string }} options
 *   `action` is the versions module's REST base URL
 */
export function useDocVersionsList({ action, docId }) {
  const versions = ref([]);
  const currentPage = ref(0);
  const totalPages = ref(0);
  const isLoading = ref(false);
  const loaded = ref(false);
  const loadMorePending = ref(0);
  const isLoadingMore = computed(() => loadMorePending.value > 0);
  const hasMore = computed(() => currentPage.value < totalPages.value);

  // Bumped by every `load()` so a stale append is dropped
  let generation = 0;
  const queue = asyncTaskQueue();

  function fetchPage(page) {
    return apos.http.get(action, {
      busy: page === 1,
      qs: {
        docId,
        page
      }
    });
  }

  function applyPage(response, append) {
    const results = response.results || [];
    versions.value = append
      ? [ ...versions.value, ...results ]
      : results;
    currentPage.value = response.currentPage;
    totalPages.value = response.pages;
  }

  async function load() {
    generation++;
    const gen = generation;
    queue.clear();
    isLoading.value = true;
    try {
      const response = await fetchPage(1);
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
        const response = await fetchPage(currentPage.value + 1);
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
    currentPage,
    totalPages,
    hasMore,
    isLoading,
    isLoadingMore,
    loaded,
    load,
    loadMore,
    cancel
  };
}

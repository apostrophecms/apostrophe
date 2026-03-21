import {
  computed, inject, ref
} from 'vue';
import { debounceAsync, asyncTaskQueue } from 'Modules/@apostrophecms/ui/utils';

const DEBOUNCE_TIMEOUT = 300;

/**
 * Manages data fetching and pagination for the recently-edited document manager.
 *
 * Uses two separate concurrency mechanisms:
 * - `debounceAsync` coalesces page-1 reloads (used by `reload()`)
 * - `asyncTaskQueue` serializes loadMore requests only
 *
 * @param {object} options
 * @param {import('vue').ComputedRef<object>} options.moduleOptions
 * @param {import('vue').Ref<object>} options.filterState
 * @param {import('vue').Ref<string>} options.searchQuery
 * @param {import('vue').ComputedRef<string[]>} options.choiceFilterNames
 */
export function useRecentlyEditedFetch({
  moduleOptions, filterState, searchQuery, choiceFilterNames
}) {
  const $t = inject('i18n');

  const items = ref([]);
  const currentPage = ref(1);
  const totalPages = ref(1);
  const isLoading = ref(false);
  const loadMorePending = ref(0);
  const isLoadingMore = computed(() => loadMorePending.value > 0);
  const filterChoices = ref({});

  // Generation counter: incremented on every reload so that
  // in-flight loadMore() calls from a stale dataset are discarded.
  let generation = 0;
  // Multiselect filter names to exclude from the choices request
  // parameter during the next page-1 fetch.
  let pendingExcludeChoices = [];

  // Serial queue for loadMore calls, ensuring they are processed
  // one at a time in order.
  const queue = asyncTaskQueue();

  function formatLocale(aposLocale) {
    const code = aposLocale?.split(':')[0];
    const label = apos.i18n.locales[code]?.label;
    return label ? `${label} (${code})` : code;
  }

  function enrichItem(item) {
    const typeConfig = moduleOptions.value.managedTypes
      ?.find(type => type.name === item.type);
    return {
      ...item,
      title: item.title || $t(typeConfig?.label || item.type),
      _lastEditor: item.updatedBy?.title || item.updatedBy?.username || '',
      _localeLabel: formatLocale(item.aposLocale)
    };
  }

  async function fetchPage(page = 1, overrides = {}) {
    const qs = {
      page,
      ...overrides
    };
    for (const [ key, val ] of Object.entries(filterState.value)) {
      if (val != null && val !== '' && !(Array.isArray(val) && !val.length)) {
        qs[key] = val;
      }
    }
    if (searchQuery.value) {
      qs.autocomplete = searchQuery.value;
    }
    if (!overrides.perPage && page === 1 && choiceFilterNames.value.length) {
      const requestChoices = choiceFilterNames.value
        .filter(n => !pendingExcludeChoices.includes(n));
      if (requestChoices.length) {
        qs.choices = requestChoices;
      }
    }
    return apos.http.get(moduleOptions.value.action, {
      qs,
      draft: true
    });
  }

  function applyPage1Results(response) {
    items.value = (response.results || []).map(enrichItem);
    currentPage.value = response.currentPage;
    totalPages.value = response.pages;
    // Merge only keys present in the response — excluded multiselect
    // filters retain their previous choices.
    const incoming = response.choices || {};
    const merged = { ...filterChoices.value };
    for (const [ key, val ] of Object.entries(incoming)) {
      if (choicesChanged(val, merged[key])) {
        merged[key] = val;
      }
    }
    filterChoices.value = merged;
    isLoading.value = false;
  }

  const debouncedFetch = debounceAsync(
    () => fetchPage(1),
    DEBOUNCE_TIMEOUT,
    { onSuccess: applyPage1Results }
  );

  function reload({ immediate = false, excludeChoices = [] } = {}) {
    generation++;
    queue.clear();
    pendingExcludeChoices = excludeChoices;
    isLoading.value = true;
    return immediate ? debouncedFetch.skipDelay() : debouncedFetch();
  }

  function loadMore() {
    loadMorePending.value++;
    const gen = generation;
    // Queue will reject pending request if another loadMore is in progress,
    // so we catch and ignore errors.
    queue.add(async () => {
      if (gen !== generation) {
        return;
      }
      if (currentPage.value >= totalPages.value) {
        return;
      }
      const response = await fetchPage(currentPage.value + 1);
      if (gen !== generation) {
        return;
      }
      items.value = [
        ...items.value,
        ...(response.results || []).map(enrichItem)
      ];
      currentPage.value = response.currentPage;
      totalPages.value = response.pages;
    })
      .catch(() => {})
      .finally(() => {
        loadMorePending.value--;
      });
  }

  function cancel() {
    debouncedFetch.cancel();
    queue.clear();
  }

  return {
    items,
    currentPage,
    totalPages,
    isLoading,
    isLoadingMore,
    filterChoices,
    reload,
    loadMore,
    fetchPage,
    cancel
  };
}

function choicesChanged(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return a !== b;
  }
  if (a.length !== b.length) {
    return true;
  }
  return a.some((choice, i) => choice.value !== b[i]?.value);
}

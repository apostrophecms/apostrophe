import {
  computed, inject, ref, watch
} from 'vue';
import { debounceAsync } from 'Modules/@apostrophecms/ui/utils';

const DEBOUNCE_TIMEOUT = 300;

/**
 * Manages data fetching, filtering, pagination, and content refresh
 * for the recently-edited document manager.
 *
 * @param {string} moduleName
 * @returns {object} Reactive data, computed properties, and action functions
 */
export function useRecentlyEditedData(moduleName) {
  const $t = inject('i18n');

  const moduleOptions = computed(() => apos.modules[moduleName]);
  const managerFilters = computed(() => moduleOptions.value.filters || []);
  const choiceFilterNames = computed(() => managerFilters.value.map(f => f.name));
  const moduleLabels = computed(() => ({
    singular: moduleOptions.value.label,
    plural: moduleOptions.value.pluralLabel
  }));

  const hasActiveFilters = computed(() => {
    return Object.values(filterState.value)
      .some(value => value !== null && value !== undefined && value !== '');
  });

  const emptyDisplay = computed(() => {
    if (hasActiveFilters.value) {
      return {
        icon: 'magnify-icon',
        title: 'apostrophe:recentlyEditedEmptyFiltered',
        message: 'apostrophe:recentlyEditedEmptyFilteredHint'
      };
    }
    return {
      icon: 'file-document-multiple-outline-icon',
      title: {
        key: 'apostrophe:recentlyEditedEmpty',
        count: moduleOptions.value.rollingWindowDays || 30
      }
    };
  });

  const items = ref([]);
  const currentPage = ref(1);
  const totalPages = ref(1);
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const filterChoices = ref({});
  const searchQuery = ref('');
  // Build initial filter state from the server-defined filters,
  // so every filter is present from the start.
  const filterState = ref(
    Object.fromEntries(
      (moduleOptions.value.filters || []).map(f => [ f.name, f.def ?? null ])
    )
  );

  // Generation counter: incremented on every page-1 load so that
  // in-flight loadMore() calls from a stale dataset are discarded.
  let loadGeneration = 0;

  const activeFilterTags = computed(() => {
    return Object.entries(filterState.value)
      .filter(([ , value ]) => value !== null && value !== undefined && value !== '')
      .map(([ name, value ]) => {
        const filter = managerFilters.value.find(f => f.name === name);
        const choice = filterChoices.value[name]?.find(c => c.value === value);
        return {
          name,
          label: filter?.label || name,
          valueLabel: translateLabel(choice?.label ?? value)
        };
      });
  });

  function translateLabel(label) {
    if (label && typeof label === 'object') {
      return $t(label);
    }
    if (typeof label === 'string' && label.length) {
      return $t(label);
    }
    return label;
  }

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

  async function fetchPage(page = 1) {
    const qs = { page };
    for (const [ key, val ] of Object.entries(filterState.value)) {
      if (val != null && val !== '') {
        qs[key] = val;
      }
    }
    if (searchQuery.value) {
      qs.autocomplete = searchQuery.value;
    }
    if (page === 1 && choiceFilterNames.value.length) {
      qs.choices = choiceFilterNames.value;
    }
    return apos.http.get(moduleOptions.value.action, {
      qs,
      draft: true
    });
  }

  // Shallow comparison of filter choices to avoid unnecessary reactivity
  // when the API returns identical choice data.
  function choicesChanged(incoming, current) {
    const incomingKeys = Object.keys(incoming);
    const currentKeys = Object.keys(current);
    if (incomingKeys.length !== currentKeys.length) {
      return true;
    }
    return incomingKeys.some(key => {
      const a = incoming[key];
      const b = current[key];
      if (!Array.isArray(a) || !Array.isArray(b)) {
        return a !== b;
      }
      if (a.length !== b.length) {
        return true;
      }
      return a.some((choice, i) => choice.value !== b[i]?.value);
    });
  }

  function applyPage1Results(response) {
    loadGeneration++;
    items.value = (response.results || []).map(enrichItem);
    currentPage.value = response.currentPage;
    totalPages.value = response.pages;
    const incoming = response.choices || {};
    if (choicesChanged(incoming, filterChoices.value)) {
      filterChoices.value = incoming;
    }
    isLoading.value = false;
  }

  const debouncedLoad = debounceAsync(
    () => fetchPage(1),
    DEBOUNCE_TIMEOUT,
    { onSuccess: applyPage1Results }
  );

  function reload({ immediate = false } = {}) {
    isLoading.value = true;
    return immediate ? debouncedLoad.skipDelay() : debouncedLoad();
  }

  async function loadMore() {
    if (isLoadingMore.value || currentPage.value >= totalPages.value) {
      return;
    }

    const gen = loadGeneration;
    isLoadingMore.value = true;

    try {
      const response = await fetchPage(currentPage.value + 1);
      if (gen !== loadGeneration) {
        return;
      }
      items.value = [
        ...items.value,
        ...(response.results || []).map(enrichItem)
      ];
      currentPage.value = response.currentPage;
      totalPages.value = response.pages;
    } finally {
      isLoadingMore.value = false;
    }
  }

  function updateFilters(nextState) {
    filterState.value = nextState;
  }

  function clearFilter(name) {
    filterState.value = {
      ...filterState.value,
      [name]: null
    };
  }

  function clearAllFilters() {
    filterState.value = Object.fromEntries(
      managerFilters.value.map(f => [ f.name, null ])
    );
  }

  function onContentChanged() {
    reload({ immediate: true });
  }

  function onSearch(_query) {
    // Search wiring deferred to Phase 4.
  }

  function cancel() {
    debouncedLoad.cancel();
  }

  // Reload on any filter change via the unified debouncedLoad.
  // No inline state mutations — applyPage1Results handles everything atomically.
  watch(filterState, () => {
    reload();
  }, { deep: true });

  return {
    moduleOptions,
    managerFilters,
    moduleLabels,
    emptyDisplay,
    items,
    currentPage,
    totalPages,
    isLoading,
    isLoadingMore,
    filterChoices,
    searchQuery,
    filterState,
    activeFilterTags,
    reload,
    loadMore,
    updateFilters,
    clearFilter,
    clearAllFilters,
    hasActiveFilters,
    onContentChanged,
    onSearch,
    cancel
  };
}

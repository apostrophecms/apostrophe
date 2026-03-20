import {
  computed, inject, ref, watch
} from 'vue';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import { debounceAsync } from 'Modules/@apostrophecms/ui/utils';

const DEBOUNCE_TIMEOUT = 300;

/**
 * Manages data fetching, filtering, pagination, batch operations and content
 * refresh for the recently-edited document manager.
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

  const modalStore = useModalStore();

  // Batch operations are available only when both a specific type
  // and locale are selected, making the list equivalent to a
  // standard single-type manager.
  const batchOperations = computed(() => {
    const typeName = filterState.value._docType;
    if (!typeName || !filterState.value._locale) {
      return [];
    }
    return apos.modules[typeName]?.batchOperations || [];
  });

  // Map recently-edited filter state to the format batch operation
  // `if` conditions expect (e.g. `{ archived: false }`).
  const batchFilterValues = computed(() => ({
    archived: filterState.value._status === 'archived'
  }));

  const checked = ref([]);
  const allPiecesSelection = ref({
    isSelected: false,
    total: 0
  });

  const selectAllChoice = computed(() => {
    const checkCount = checked.value.length;
    const pageNotFullyChecked = items.value
      .some(item => !checked.value.includes(item._id));
    return {
      value: 'checked',
      indeterminate: checkCount > 0 && pageNotFullyChecked
    };
  });

  const selectAllState = computed(() => {
    if (checked.value.length && !selectAllChoice.value.indeterminate) {
      return 'checked';
    }
    if (checked.value.length && selectAllChoice.value.indeterminate) {
      return 'indeterminate';
    }
    return 'empty';
  });

  function selectAll() {
    if (!checked.value.length) {
      checked.value = items.value.map(item => item._id);
      // With infinite scroll all items may already be loaded,
      // so mark the full set as selected to show the banner.
      if (items.value.length >= allPiecesSelection.value.total) {
        allPiecesSelection.value.isSelected = true;
      }
      return;
    }
    allPiecesSelection.value.isSelected = false;
    checked.value = [];
  }

  async function selectAllPieces() {
    const response = await fetchPage(1, {
      perPage: allPiecesSelection.value.total,
      project: { _id: 1 },
      lean: 1
    });
    const allIds = (response.results || []).map(item => item._id);
    checked.value = allIds;
    allPiecesSelection.value.isSelected = true;
  }

  function setAllPiecesSelection({
    isSelected, total, docs
  }) {
    if (typeof isSelected === 'boolean') {
      allPiecesSelection.value.isSelected = isSelected;
    }
    if (typeof total === 'number') {
      allPiecesSelection.value.total = total;
    }
    if (docs) {
      checked.value = docs.map(d => d._id || d);
    }
  }

  async function handleBatchAction({
    label, action, requestOptions = {}, messages
  }) {
    const typeName = filterState.value._docType;
    const typeAction = apos.modules[typeName]?.action;
    if (!action || !typeAction) {
      return;
    }
    try {
      await apos.http.post(`${typeAction}/${action}`, {
        body: {
          ...requestOptions,
          _ids: checked.value,
          messages,
          type: checked.value.length === 1
            ? moduleLabels.value.singular
            : moduleLabels.value.plural
        }
      });
    } catch (error) {
      apos.notify('apostrophe:errorBatchOperationNoti', {
        interpolate: { operation: label },
        type: 'danger'
      });
    }
    allPiecesSelection.value.isSelected = false;
    checked.value = [];
    reload({ immediate: true });
  }

  // True when no specific locale filter is selected ("Any"),
  // meaning docs from multiple locales are listed simultaneously.
  const crossLocale = computed(() => {
    return !filterState.value._locale;
  });

  // Sync locale filter → modal store locale, so apos.http auto-appends
  // the correct aposLocale to all requests (including child modals).
  // This matches standard manager behavior — the context bar may
  // rewrite the browser URL to the filtered locale, but it reverts
  // when the modal closes (modal pops from stack).
  watch(() => filterState.value._locale, (newLocale) => {
    const id = modalStore.activeModal?.id;
    if (id) {
      modalStore.updateModalData(id, {
        locale: newLocale || apos.i18n.locale,
        crossLocale: !newLocale
      });
    }
  }, { immediate: true });

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

  async function fetchPage(page = 1, overrides = {}) {
    const qs = {
      page,
      ...overrides
    };
    for (const [ key, val ] of Object.entries(filterState.value)) {
      if (val != null && val !== '') {
        qs[key] = val;
      }
    }
    if (searchQuery.value) {
      qs.autocomplete = searchQuery.value;
    }
    if (!overrides.perPage && page === 1 && choiceFilterNames.value.length) {
      qs.choices = choiceFilterNames.value;
    }
    return apos.http.get(moduleOptions.value.action, {
      qs,
      draft: true
    });
  }

  async function fetchTotalCount() {
    const { count } = await fetchPage(1, { count: 1 });
    return count || 0;
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

  async function applyPage1Results(response) {
    loadGeneration++;
    items.value = (response.results || []).map(enrichItem);
    currentPage.value = response.currentPage;
    totalPages.value = response.pages;
    const incoming = response.choices || {};
    if (choicesChanged(incoming, filterChoices.value)) {
      filterChoices.value = incoming;
    }
    isLoading.value = false;
    // Update total count for the select-all banner when batch
    // operations are available (single type + locale selected).
    if (batchOperations.value.length) {
      const total = await fetchTotalCount();
      setAllPiecesSelection({
        isSelected: false,
        total
      });
    }
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
    checked.value = [];
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
    crossLocale,
    reload,
    loadMore,
    updateFilters,
    clearFilter,
    clearAllFilters,
    hasActiveFilters,
    onContentChanged,
    onSearch,
    cancel,
    batchOperations,
    batchFilterValues,
    checked,
    allPiecesSelection,
    selectAllState,
    selectAll,
    selectAllPieces,
    setAllPiecesSelection,
    handleBatchAction
  };
}

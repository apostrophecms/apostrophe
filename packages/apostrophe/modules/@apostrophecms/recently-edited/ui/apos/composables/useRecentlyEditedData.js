import {
  computed, inject, ref, watch
} from 'vue';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import { useRecentlyEditedFilters } from './useRecentlyEditedFilters.js';
import { useRecentlyEditedFetch } from './useRecentlyEditedFetch.js';
import { useRecentlyEditedBatch } from './useRecentlyEditedBatch.js';

/**
 * Orchestrates filter state, data fetching, batch operations and
 * cross-composable wiring for the recently-edited document manager.
 *
 * @param {string} moduleName
 */
export function useRecentlyEditedData(moduleName) {
  const $t = inject('i18n');
  const modalStore = useModalStore();

  // --- Module-level setup ---

  const moduleOptions = computed(() => apos.modules[moduleName]);
  const managerFilters = computed(() => moduleOptions.value.filters || []);
  const choiceFilterNames = computed(() => managerFilters.value.map(f => f.name));
  const moduleLabels = computed(() => ({
    singular: moduleOptions.value.label,
    plural: moduleOptions.value.pluralLabel
  }));
  const searchQuery = ref('');

  // --- Compose sub-composables ---

  const {
    filterState,
    hasActiveFilters,
    updateFilters,
    clearFilter,
    clearAllFilters
  } = useRecentlyEditedFilters(managerFilters);

  const {
    items,
    currentPage,
    totalPages,
    isLoading,
    isLoadingMore,
    filterChoices,
    reload,
    loadMore,
    fetchPage,
    cancel: fetchCancel
  } = useRecentlyEditedFetch({
    moduleOptions,
    filterState,
    searchQuery,
    choiceFilterNames
  });

  const {
    batchOperations,
    batchFilterValues,
    checked,
    allPiecesSelection,
    selectAllState,
    selectAll,
    selectAllPieces,
    setAllPiecesSelection,
    handleBatchAction,
    refreshTotalCount
  } = useRecentlyEditedBatch({
    filterState,
    moduleOptions,
    items,
    fetchPage,
    moduleLabels,
    reload
  });

  // --- Cross-composable wiring ---

  // Reload on filter changes. Determine which multiselect filters
  // changed so their choices are excluded from the API request.
  watch(filterState, (next, prev) => {
    const excludeChoices = managerFilters.value
      .filter(f => f.inputType === 'checkbox')
      .filter(f => !arraysEqual(next[f.name], prev?.[f.name]))
      .map(f => f.name);
    checked.value = [];
    reload({ excludeChoices });
  }, { deep: true });

  // Sync locale filter → modal store locale, so apos.http auto-appends
  // the correct aposLocale to all requests (including child modals).
  watch(() => filterState.value._locale, (newLocale) => {
    const id = modalStore.activeModal?.id;
    if (!id) {
      return;
    }
    const multiLocale = Object.keys(apos.i18n.locales || {}).length > 1;
    const effectiveLocale = Array.isArray(newLocale)
      ? (newLocale.length === 1 ? newLocale[0] : null)
      : newLocale;
    modalStore.updateModalData(id, {
      locale: effectiveLocale || apos.i18n.locale,
      crossLocale: multiLocale && !effectiveLocale
    });
  }, { immediate: true });

  // Refresh batch total count after each page-1 reload completes.
  watch(isLoading, (loading) => {
    if (!loading) {
      refreshTotalCount();
    }
  });

  // --- Computed properties ---

  const crossLocale = computed(() => {
    const locale = filterState.value._locale;
    if (Object.keys(apos.i18n.locales || {}).length <= 1) {
      return false;
    }
    if (Array.isArray(locale)) {
      return locale.length !== 1;
    }
    return !locale;
  });

  const emptyDisplay = computed(() => {
    const hasSearch = !!searchQuery.value;
    if (hasActiveFilters.value || hasSearch) {
      return {
        icon: 'magnify-icon',
        title: hasSearch
          ? 'apostrophe:recentlyEditedEmptySearched'
          : 'apostrophe:recentlyEditedEmptyFiltered',
        message: hasSearch
          ? 'apostrophe:recentlyEditedEmptySearchedHint'
          : 'apostrophe:recentlyEditedEmptyFilteredHint'
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

  const activeFilterTags = computed(() => {
    const tags = [];
    for (const [ name, value ] of Object.entries(filterState.value)) {
      if (value === null || value === undefined || value === '') {
        continue;
      }
      const filter = managerFilters.value.find(f => f.name === name);
      const filterLabel = filter?.label || name;
      const choices = filterChoices.value[name];

      // Array values (checkbox/combo): one tag per selected item.
      if (Array.isArray(value)) {
        if (!value.length) {
          continue;
        }
        for (const v of value) {
          const choice = choices?.find(c => c.value === v);
          tags.push({
            name,
            value: v,
            label: filterLabel,
            valueLabel: translateLabel(choice?.label ?? v)
          });
        }
        continue;
      }

      // Scalar values (select/radio).
      const choice = choices?.find(c => c.value === value);
      tags.push({
        name,
        label: filterLabel,
        valueLabel: translateLabel(choice?.label ?? value)
      });
    }
    return tags;
  });

  // --- Actions ---

  function onContentChanged() {
    reload({ immediate: true });
  }

  function onSearch(query) {
    searchQuery.value = query;
    checked.value = [];
    reload();
  }

  const hasActiveSearch = computed(() => !!searchQuery.value);

  function clearSearch() {
    searchQuery.value = '';
    checked.value = [];
    reload();
  }

  function cancel() {
    fetchCancel();
  }

  // --- Helpers ---

  function translateLabel(label) {
    if (label && typeof label === 'object') {
      return $t(label);
    }
    if (typeof label === 'string' && label.length) {
      return $t(label);
    }
    return label;
  }

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
    hasActiveSearch,
    clearSearch,
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

// Shallow array comparison (order-insensitive, value-based).
function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return a === b;
  }
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [ ...a ].sort();
  const sortedB = [ ...b ].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

import { computed, ref } from 'vue';

/**
 * Manages batch selection and operations for the recently-edited
 * document manager.
 *
 * @param {object} options
 * @param {import('vue').Ref<object>} options.filterState - reactive filter state
 * @param {import('vue').ComputedRef<object>} options.moduleOptions - module config
 * @param {import('vue').Ref<Array>} options.items - current page items
 * @param {Function} options.fetchPage - fetches a page of results
 * @param {import('vue').ComputedRef<object>} options.moduleLabels - singular/plural
 *  labels
 * @param {Function} options.reload - triggers a page-1 reload
 */
export function useRecentlyEditedBatch({
  filterState, items, fetchPage, moduleLabels, reload
}) {
  function getSelectedTypeName() {
    const typeValue = filterState.value._docType;
    return Array.isArray(typeValue)
      ? (typeValue.length === 1 ? typeValue[0] : null)
      : typeValue;
  }

  function getBatchModule(typeName) {
    const pageModule = apos.modules['@apostrophecms/page'];
    if (pageModule?.validPageTypes?.includes(typeName)) {
      return pageModule;
    }
    return apos.modules[typeName];
  }

  // Batch operations are available only when a single concrete type
  // and locale are selected, making the list equivalent to a
  // standard single-type manager.
  const batchOperations = computed(() => {
    const typeName = getSelectedTypeName();
    if (!typeName || !filterState.value._locale) {
      return [];
    }
    return getBatchModule(typeName)?.batchOperations || [];
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
    const typeName = getSelectedTypeName();
    const batchModule = typeName && getBatchModule(typeName);
    if (!action || !batchModule?.action) {
      return;
    }
    try {
      await apos.http.post(`${batchModule.action}/${action}`, {
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

  async function fetchTotalCount() {
    const { count } = await fetchPage(1, { count: 1 });
    return count || 0;
  }

  // Refresh the select-all total count. Called by the orchestrator
  // after page-1 results are applied when batch operations are available.
  async function refreshTotalCount() {
    if (!batchOperations.value.length) {
      return;
    }
    try {
      const total = await fetchTotalCount();
      setAllPiecesSelection({
        isSelected: false,
        total
      });
    } catch {
      // count fetch may fail if filters changed mid-flight.
    }
  }

  return {
    batchOperations,
    batchFilterValues,
    checked,
    allPiecesSelection,
    selectAllChoice,
    selectAllState,
    selectAll,
    selectAllPieces,
    setAllPiecesSelection,
    handleBatchAction,
    refreshTotalCount
  };
}

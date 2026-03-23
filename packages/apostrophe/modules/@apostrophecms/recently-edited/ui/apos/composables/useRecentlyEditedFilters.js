import { computed, ref } from 'vue';

/**
 * Manages filter state for the recently-edited document manager.
 *
 * @param {import('vue').ComputedRef<Array>} managerFilters - computed ref of
 *  filter definitions
 * @param {Object} [initialFilters={}] - Optional initial filter values.
 *  When provided (non-empty), fully replaces the default filter state
 *  (filter `def` values are NOT used). Values should be arrays and are
 *  coerced to scalar/array based on the filter's inputType.
 */
export function useRecentlyEditedFilters(managerFilters, initialFilters = {}) {
  const hasInitial = Object.keys(initialFilters).length > 0;
  const filterState = ref(
    Object.fromEntries(
      (managerFilters.value || []).map(f => {
        if (!hasInitial) {
          return [ f.name, filterDefault(f) ];
        }
        return [ f.name, coerceInitialValue(f, initialFilters[f.name]) ];
      })
    )
  );

  const hasActiveFilters = computed(() => {
    return Object.values(filterState.value)
      .some(value => {
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return value !== null && value !== undefined && value !== '';
      });
  });

  function updateFilter(name, value) {
    filterState.value = {
      ...filterState.value,
      [name]: value
    };
  }

  function updateFilters(nextState) {
    filterState.value = nextState;
  }

  function clearFilter(name, value) {
    const filter = managerFilters.value.find(f => f.name === name);
    const current = filterState.value[name];
    // For array-valued filters, remove just the specified value.
    if (Array.isArray(current) && value !== undefined) {
      filterState.value = {
        ...filterState.value,
        [name]: current.filter(v => v !== value)
      };
      return;
    }
    filterState.value = {
      ...filterState.value,
      [name]: filterDefault(filter || {})
    };
  }

  function clearAllFilters() {
    filterState.value = Object.fromEntries(
      managerFilters.value.map(f => [ f.name, filterDefault(f) ])
    );
  }

  return {
    filterState,
    hasActiveFilters,
    updateFilter,
    updateFilters,
    clearFilter,
    clearAllFilters
  };
}

function filterDefault(filter) {
  if (filter.def !== undefined) {
    return filter.def;
  }
  return (filter.inputType || 'select') === 'checkbox' ? [] : null;
}

// Coerce an initial filter value based on the filter's inputType.
// When initialFilters is active, absent keys get empty defaults (not `def`).
function coerceInitialValue(filter, value) {
  const isCheckbox = (filter.inputType || 'select') === 'checkbox';
  if (value === undefined || value === null) {
    return isCheckbox ? [] : null;
  }
  const arr = Array.isArray(value) ? value : [ value ];
  if (isCheckbox) {
    return arr;
  }
  // Scalar filter: use value only if exactly one item
  return arr.length === 1 ? arr[0] : null;
}

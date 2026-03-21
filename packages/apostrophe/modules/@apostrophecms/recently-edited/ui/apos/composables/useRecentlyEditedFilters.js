import { computed, ref } from 'vue';

/**
 * Manages filter state for the recently-edited document manager.
 *
 * @param {import('vue').ComputedRef<Array>} managerFilters - computed ref of
 *  filter definitions
 */
export function useRecentlyEditedFilters(managerFilters) {
  const filterState = ref(
    Object.fromEntries(
      (managerFilters.value || []).map(f => [ f.name, filterDefault(f) ])
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

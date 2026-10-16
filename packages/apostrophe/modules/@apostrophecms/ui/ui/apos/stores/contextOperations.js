import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * The state of context operations of `type: 'toggle'`, by `action`.
 * Whatever owns the state an operation turns on and off sets it here, so
 * every menu offering the operation shows it, however it changed.
 */
export const useContextOperationsStore = defineStore('contextOperations', () => {
  const checked = ref({});

  function setChecked(action, value) {
    checked.value = {
      ...checked.value,
      [action]: Boolean(value)
    };
  }

  function isChecked(action) {
    return checked.value[action] === true;
  }

  return {
    setChecked,
    isChecked
  };
});

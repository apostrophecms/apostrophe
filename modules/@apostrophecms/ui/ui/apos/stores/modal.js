import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useModalStore = defineStore('modal', () => {
  const stack = ref([]);

  function add(modal) {
    stack.value.push(modal);
  }

  function getAt(index) {
    const last = stack.value.length - 1;
    const target = index < 0
      ? last + 1 + index
      : index > stack.value.length
        ? last
        : index;

    const modal = stack.value[target] || {};

    return modal;
  }

  return {
    stack,
    add,
    getAt
  };
});

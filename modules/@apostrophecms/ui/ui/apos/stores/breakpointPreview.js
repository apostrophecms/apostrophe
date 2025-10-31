import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useBreakpointPreviewStore = defineStore('breakpointPreview', () => {
  const mode = ref(null);

  function setMode(val) {
    mode.value = val;
  }

  return {
    mode,
    setMode
  };
});

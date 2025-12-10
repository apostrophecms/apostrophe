import { _themeClass } from '../composables/AposTheme.js';

// Provides computed classes for decorating top-level Apos vue apps with a UI
// theme
export default {
  computed: {
    themeClass() {
      return _themeClass();
    }
  }
};

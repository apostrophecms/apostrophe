// Provides computed classes for decorating top-level Apos vue apps with a UI theme

export default {
  computed: {
    themeClass() {
      const classes = [];
      classes.push(`apos-theme--primary-${window.apos.ui.theme.primary}`);
      return classes;
    }
  }
};

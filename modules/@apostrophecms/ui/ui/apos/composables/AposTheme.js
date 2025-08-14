import { computed } from 'vue';

export function useAposTheme() {
  const themeClass = computed(_themeClass);
  return { themeClass };
};

export function _themeClass() {
  const classes = [];
  classes.push(`apos-theme--primary-${window.apos.ui.theme.primary}`);
  return classes;
}

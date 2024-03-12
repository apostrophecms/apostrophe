import { computed } from 'vue';

export function useAposTheme () {
  const themeClass = computed(() => {
    const classes = [];
    classes.push(`apos-theme--primary-${window.apos.ui.theme.primary}`);
    return classes;
  });

  return { themeClass };
};

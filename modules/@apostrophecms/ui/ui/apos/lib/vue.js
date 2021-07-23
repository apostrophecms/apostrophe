import Vue from 'vue';
import VueClickOutsideElement from 'vue-click-outside-element';
import LocalizedVTooltip from './localized-v-tooltip';
import tooltipOptions from './tooltip-options';
import VueAposI18Next from './i18next';

Vue.use(LocalizedVTooltip, tooltipOptions);
Vue.use(VueClickOutsideElement);
Vue.use(VueAposI18Next, {
  // Module aliases are not available yet when this code executes
  i18n: apos.modules['@apostrophecms/i18n']
});

export default Vue;

import Vue from 'vue';
import VueClickOutsideElement from 'vue-click-outside-element';
import { VTooltip } from 'v-tooltip';
import tooltipConfig from './tooltip';
import VueAposI18Next from './i18next';

tooltipConfig.updateOptions(VTooltip);
Vue.directive('tooltip', VTooltip);
Vue.use(VueClickOutsideElement);
Vue.use(VueAposI18Next, {
  // Module aliases are not available yet when this code executes
  i18n: apos.modules['@apostrophecms/i18n']
});

export default Vue;

import Vue from 'vue';
import VueClickOutsideElement from 'vue-click-outside-element';
import { VTooltip } from 'v-tooltip';
import tooltipConfig from './tooltip';

tooltipConfig.updateOptions(VTooltip);
Vue.directive('tooltip', VTooltip);
Vue.use(VueClickOutsideElement);

export default Vue;

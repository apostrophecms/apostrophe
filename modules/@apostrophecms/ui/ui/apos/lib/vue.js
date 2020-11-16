import Vue from 'vue';
import { VTooltip } from 'v-tooltip';
import tooltipConfig from './tooltip';

tooltipConfig.updateOptions(VTooltip);
Vue.directive('tooltip', VTooltip);

export default Vue;

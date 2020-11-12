import Vue from 'apostrophe/vue';
import PortalVue from 'portal-vue';
import { VTooltip } from 'v-tooltip';
import tooltipConfig from 'Modules/@apostrophecms/ui/lib/tooltip';

tooltipConfig.updateOptions(VTooltip);
Vue.directive('tooltip', VTooltip);
Vue.use(PortalVue);

export default function() {
  const theAposModals = new Vue({
    el: '#apos-modals',
    computed: {
      apos () {
        return window.apos;
      }
    },
    methods: {
      async confirm(confirmContent) {
        return this.execute(apos.modal.components.confirm, {
          confirmContent
        });
      },
      execute(componentName, props) {
        return this.$refs.modals.execute(componentName, props);
      }
    },
    template: `<component
      ref="modals"
      :is="apos.modal.components.the"
      :modals="apos.modal.modals"
    />`
  });
  apos.modal.execute = theAposModals.execute;
  apos.confirm = theAposModals.confirm;
};

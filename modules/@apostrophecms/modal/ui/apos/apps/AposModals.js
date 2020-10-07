import Vue from 'apostrophe/vue';
import PortalVue from 'portal-vue';
Vue.use(PortalVue);

export default function() {
  return new Vue({
    el: '#apos-modals',
    computed: {
      apos () {
        return window.apos;
      }
    },
    template: '<component :is="apos.modal.components.the" :modals="apos.modal.modals" />'
  });
};
